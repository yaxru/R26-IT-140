"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ErrorBanner } from "../components/ErrorBanner";
import { CountdownBar } from "../components/CountdownBar";
import { ResultSummary } from "../components/ResultSummary";
import { FlaggedOperatorsCard } from "../components/FlaggedOperatorsCard";
import { RiskFeedCard } from "../components/RiskFeedCard";
import type {
  DowntimeReason,
  FlaggedOperator,
  JobCardSubmitResponse,
  RiskNotification,
} from "../types";

const RISK_API_BASE =
  process.env.NEXT_PUBLIC_RISK_API_URL ?? "http://localhost:8001";
const STATIONS_API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const PROCESS_SECONDS = 20;
const LOCK_SECONDS = 20;
const POLL_MS = 20_000;

function describeFetchError(error: unknown, serviceName: string): string {
  if (error instanceof TypeError && error.message.toLowerCase().includes("fetch")) {
    return `${serviceName} is unavailable at ${RISK_API_BASE}. Start the backend with "uvicorn main:app --reload --port 8001".`;
  }
  return error instanceof Error ? error.message : `Could not reach ${serviceName}.`;
}

const DOWNTIME_REASONS: DowntimeReason[] = [
  "Mechanical Failure",
  "Supply Delay",
  "Power Outage",
  "Absenteeism",
  "Rework / Quality Issue",
  "Other",
];

type Stage = "form" | "processing" | "result";

export default function JobCardPage() {
  const supabase = createClient();

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [stage, setStage] = useState<Stage>("form");
  const [processingLeft, setProcessingLeft] = useState(PROCESS_SECONDS);
  const [lockLeft, setLockLeft] = useState(LOCK_SECONDS);
  const [lastResult, setLastResult] = useState<JobCardSubmitResponse | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [flaggedOperators, setFlaggedOperators] = useState<FlaggedOperator[]>([]);
  const [flagsError, setFlagsError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<RiskNotification[]>([]);
  const [clearingId, setClearingId] = useState<string | null>(null);
  const [stationOptions, setStationOptions] = useState<string[]>([]);

  // form fields
  const [operatorId, setOperatorId] = useState("");
  const [stationId, setStationId] = useState("");
  const [output, setOutput] = useState("");
  const [smv, setSmv] = useState("8");
  const [manpower, setManpower] = useState("1");
  const [workingMinutes, setWorkingMinutes] = useState("60");
  const [shift, setShift] = useState("day");
  const [operatorSkill, setOperatorSkill] = useState("B");
  const [machineStatus, setMachineStatus] = useState("ok");
  const [downtimeReason, setDowntimeReason] = useState("");

  const processIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const apiDoneRef = useRef(false);
  const timerDoneRef = useRef(false);
  const apiResultRef = useRef<JobCardSubmitResponse | null>(null);
  const apiErrorRef = useRef<string | null>(null);

  // ---------------- Flags + notifications (poll) ----------------
  const loadFlagsAndNotifications = useCallback(async () => {
    const headers = await getAuthHeaders();
    try {
      const res = await fetch(`${RISK_API_BASE}/flags`, { headers });
      if (!res.ok) throw new Error(`Failed to load flags (${res.status})`);
      setFlaggedOperators(await res.json());
      setFlagsError(null);
    } catch (e) {
      setFlagsError(
        describeFetchError(e, "The risk_analyze service")
      );
    }

    try {
      const res = await fetch(`${RISK_API_BASE}/notifications?audience=supervisor`, {
        headers,
      });
      if (res.ok) setNotifications(await res.json());
    } catch {
      /* the flags error banner already covers "service unreachable" */
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch + poll, not a derived-state loop
    loadFlagsAndNotifications();
    const id = setInterval(loadFlagsAndNotifications, POLL_MS);
    return () => clearInterval(id);
  }, [loadFlagsAndNotifications]);

  // Optional: pull station IDs from worker_reallocation for a datalist —
  // silently skip if that service isn't running.
  useEffect(() => {
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${STATIONS_API_BASE}/stations`, { headers });
        if (!res.ok) return;
        const data: { station_id: string }[] = await res.json();
        setStationOptions(data.map((s) => s.station_id));
      } catch {
        /* fine — station becomes a free-text field */
      }
    })();
  }, [getAuthHeaders]);

  useEffect(() => {
    return () => {
      if (processIntervalRef.current) clearInterval(processIntervalRef.current);
      if (lockIntervalRef.current) clearInterval(lockIntervalRef.current);
    };
  }, []);

  // ---------------- Live efficiency preview ----------------
  const previewEfficiency = useMemo(() => {
    const o = parseFloat(output);
    const s = parseFloat(smv);
    const m = parseFloat(manpower);
    const w = parseFloat(workingMinutes);
    if (!o || !s || !m || !w) return null;
    const eff = ((o * s) / (m * w)) * 100;
    return Number.isFinite(eff) ? eff : null;
  }, [output, smv, manpower, workingMinutes]);

  const requiresDowntimeReason = previewEfficiency !== null && previewEfficiency < 60;

  const existingFlag = useMemo(
    () => flaggedOperators.find((f) => f.operator_id === operatorId.trim()),
    [flaggedOperators, operatorId]
  );

  // ---------------- Lock countdown (between submissions) ----------------
  const startLockCountdown = useCallback(() => {
    setLockLeft(LOCK_SECONDS);
    const start = Date.now();
    if (lockIntervalRef.current) clearInterval(lockIntervalRef.current);
    lockIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const left = Math.max(0, LOCK_SECONDS - elapsed);
      setLockLeft(left);
      if (left <= 0) {
        if (lockIntervalRef.current) clearInterval(lockIntervalRef.current);
        setStage("form");
        setOperatorId("");
        setOutput("");
        setDowntimeReason("");
        setLastResult(null);
      }
    }, 250);
  }, []);

  // ---------------- Processing countdown + API call ----------------
  function maybeFinishProcessing() {
    if (!apiDoneRef.current || !timerDoneRef.current) return;

    if (apiErrorRef.current) {
      // don't make them wait out the timer for an error we already know about
      return;
    }

    const res = apiResultRef.current!;
    setLastResult(res);
    setFormError(null);
    setStage("result");
    loadFlagsAndNotifications();
    startLockCountdown();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (stage !== "form") return;

    if (!operatorId.trim() || !output || !smv || !manpower || !workingMinutes) {
      setFormError("Operator ID, output, SMV, manpower and working minutes are all required.");
      return;
    }
    if (requiresDowntimeReason && !downtimeReason) {
      setFormError("Efficiency is looking low for this entry — pick a downtime reason before submitting.");
      return;
    }

    setStage("processing");
    setProcessingLeft(PROCESS_SECONDS);
    apiDoneRef.current = false;
    timerDoneRef.current = false;
    apiResultRef.current = null;
    apiErrorRef.current = null;

    const start = Date.now();
    processIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const left = Math.max(0, PROCESS_SECONDS - elapsed);
      setProcessingLeft(left);
      if (left <= 0) {
        if (processIntervalRef.current) clearInterval(processIntervalRef.current);
        timerDoneRef.current = true;
        maybeFinishProcessing();
      }
    }, 250);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${RISK_API_BASE}/job-card`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          operator_id: operatorId.trim(),
          station_id: stationId.trim() || null,
          output: Number(output),
          smv: Number(smv),
          manpower: Number(manpower),
          working_minutes: Number(workingMinutes),
          shift,
          operator_skill: operatorSkill,
          machine_status: machineStatus,
          downtime_reason: downtimeReason || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(body.detail ?? "Failed to submit job card");
      }

      apiResultRef.current = await res.json();
      apiDoneRef.current = true;
      maybeFinishProcessing();
    } catch (err) {
      apiErrorRef.current =
        describeFetchError(err, "The risk_analyze service");
      apiDoneRef.current = true;
      // surface immediately rather than making them wait out the timer
      if (processIntervalRef.current) clearInterval(processIntervalRef.current);
      setFormError(apiErrorRef.current);
      setStage("form");
    }
  }

  async function handleClearFlag(id: string) {
    setClearingId(id);
    try {
      const headers = await getAuthHeaders();
      await fetch(`${RISK_API_BASE}/flags/${encodeURIComponent(id)}/clear`, {
        method: "PUT",
        headers,
      });
      await loadFlagsAndNotifications();
    } finally {
      setClearingId(null);
    }
  }

  async function handleMarkRead(id: number) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    const headers = await getAuthHeaders();
    fetch(`${RISK_API_BASE}/notifications/${id}/read`, { method: "PUT", headers }).catch(() => {});
  }

  return (
    <div className="px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-mono tracking-widest text-zinc-400 dark:text-zinc-500 uppercase">
            Digital Job Card
          </p>
          <h1 className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Hourly Efficiency Log
          </h1>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 uppercase ${
            stage === "form"
              ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-200 dark:ring-emerald-900/60"
              : "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 ring-1 ring-amber-200 dark:ring-amber-900/60"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 ${stage === "form" ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`}
          />
          {stage === "form" ? "Ready" : stage === "processing" ? "Analyzing" : "Locked"}
        </span>
      </div>

      {flagsError && <ErrorBanner message={flagsError} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ---------------- Job Card ---------------- */}
        <div className="lg:col-span-2 bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800/60 p-6">
          {stage === "form" && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Operator ID" full>
                  <input
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-600 transition-colors font-mono"
                    placeholder="OP-025"
                    value={operatorId}
                    onChange={(e) => setOperatorId(e.target.value)}
                    required
                  />
                </Field>

                {existingFlag && (
                  <div className="col-span-2 -mt-2 text-[10px] font-mono text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50 px-3 py-2">
                    ⚑ {existingFlag.operator_id} is already flagged: {existingFlag.flag_reason}
                  </div>
                )}

                <Field label="Station ID" full>
                  <input
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-600 transition-colors font-mono"
                    placeholder="Station-05"
                    list="station-options"
                    value={stationId}
                    onChange={(e) => setStationId(e.target.value)}
                  />
                  <datalist id="station-options">
                    {stationOptions.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </Field>

                <Field label="Output (pcs)">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-600 transition-colors"
                    value={output}
                    onChange={(e) => setOutput(e.target.value)}
                    required
                  />
                </Field>
                <Field label="SMV">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-600 transition-colors"
                    value={smv}
                    onChange={(e) => setSmv(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Manpower">
                  <input
                    type="number"
                    min="1"
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-600 transition-colors"
                    value={manpower}
                    onChange={(e) => setManpower(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Working minutes">
                  <input
                    type="number"
                    min="1"
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-600 transition-colors"
                    value={workingMinutes}
                    onChange={(e) => setWorkingMinutes(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Shift">
                  <select className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-600 transition-colors" value={shift} onChange={(e) => setShift(e.target.value)}>
                    <option value="day">Day</option>
                    <option value="night">Night</option>
                  </select>
                </Field>
                <Field label="Operator skill grade">
                  <select
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-600 transition-colors"
                    value={operatorSkill}
                    onChange={(e) => setOperatorSkill(e.target.value)}
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                  </select>
                </Field>
                <Field label="Machine status" full>
                  <select
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-600 transition-colors"
                    value={machineStatus}
                    onChange={(e) => setMachineStatus(e.target.value)}
                  >
                    <option value="ok">Running OK</option>
                    <option value="maintenance">Under maintenance</option>
                    <option value="breakdown">Breakdown</option>
                  </select>
                </Field>
              </div>

              {previewEfficiency !== null && (
                <div
                  className={`text-[11px] font-mono px-3 py-2 ${
                    requiresDowntimeReason
                      ? "bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400"
                      : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  Live estimate: {previewEfficiency.toFixed(1)}% efficiency
                </div>
              )}

              {requiresDowntimeReason && (
                <Field label="Downtime reason (required — efficiency is low)" full>
                  <select
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-600 transition-colors ring-1 ring-orange-300 dark:ring-orange-800"
                    value={downtimeReason}
                    onChange={(e) => setDowntimeReason(e.target.value)}
                    required
                  >
                    <option value="">Select a reason…</option>
                    {DOWNTIME_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              {formError && <ErrorBanner message={formError} />}

              <button
                type="submit"
                className="mt-2 w-full py-3 text-sm font-semibold tracking-wide bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-100 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
              >
                Submit hourly log
              </button>
            </form>
          )}

          {stage === "processing" && (
            <div className="flex flex-col items-center text-center">
              <CountdownBar
                secondsLeft={processingLeft}
                totalSeconds={PROCESS_SECONDS}
                label="Analyzing submission"
                accent="amber"
              />
              <p className="text-[11px] font-mono text-zinc-400 dark:text-zinc-600 max-w-xs -mt-2">
                Running the variance check and predictive model against this entry…
              </p>
            </div>
          )}

          {stage === "result" && lastResult && (
            <div className="flex flex-col gap-4">
              <ResultSummary result={lastResult} />
              <div className="border-t border-zinc-100 dark:border-zinc-800/60 pt-2">
                <CountdownBar
                  secondsLeft={lockLeft}
                  totalSeconds={LOCK_SECONDS}
                  label="Next entry unlocks in"
                />
              </div>
            </div>
          )}
        </div>

        {/* ---------------- Side rail ---------------- */}
        <div className="flex flex-col gap-4">
          <FlaggedOperatorsCard
            operators={flaggedOperators}
            onClear={handleClearFlag}
            clearingId={clearingId}
          />
          <RiskFeedCard notifications={notifications} onMarkRead={handleMarkRead} />
        </div>
      </div>

      <p className="text-center text-[10px] font-mono text-zinc-400 dark:text-zinc-700 pb-4">
        StitchFlow · Real-Time Risk Detection v1.0 · Flags check the first 3
        submissions per operator
      </p>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${full ? "col-span-2" : ""}`}>
      <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
        {label}
      </span>
      {children}
    </label>
  );
}
