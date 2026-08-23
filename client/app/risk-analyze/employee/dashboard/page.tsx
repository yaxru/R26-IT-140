"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type Notification, type SubmitResponse, type LaborEntry } from "@/lib/risk-analyze/api";
import { clearEmployeeSession, getEmployeeSession, saveEmployeeSession } from "@/lib/risk-analyze/session";
import CountdownRing from "@/app/risk-analyze/components/CountdownRing";
import EfficiencyGauge from "@/app/risk-analyze/components/EfficiencyGauge";

const PROCESS_SECONDS = 20;
const LOCK_SECONDS = 20;
const DEFAULT_SMV = 8;
const DEFAULT_MANPOWER = 1;
const DEFAULT_OPERATOR_SKILL = "B";
const SAVED_OUTPUTS_KEY = "risk-analyze.saved-outputs";
const DAILY_TARGET = 1500;
const SHIFT_LENGTH_HOURS = 8;

const DOWNTIME_REASONS = [
  "Mechanical Failure",
  "Supply Delay",
  "Power Outage",
  "Absenteeism",
  "Rework / Quality Issue",
  "Other",
];

type Stage = "idle" | "processing" | "result" | "locked";

const DEMO_EMPLOYEE = {
  token: "",
  user: {
    id: 1,
    name: "Demo Employee",
    role: "labor" as const,
    employee_code: "DEMO",
    submission_count: 0,
    is_flagged: false,
  },
};

export default function EmployeeDashboard() {
  const router = useRouter();
  const session = useMemo(() => getEmployeeSession() ?? DEMO_EMPLOYEE, []);

  const [ready, setReady] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [processingLeft, setProcessingLeft] = useState(PROCESS_SECONDS);
  const [lockLeft, setLockLeft] = useState(LOCK_SECONDS);
  const [lastResult, setLastResult] = useState<SubmitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isFlagged, setIsFlagged] = useState(session?.user.is_flagged ?? false);
  const [recentEntries, setRecentEntries] = useState<LaborEntry[]>([]);
  const [savedOutputs, setSavedOutputs] = useState<string[]>([]);

  // form fields
  const [output, setOutput] = useState("");
  const [workingMinutes, setWorkingMinutes] = useState("60");
  const [shift, setShift] = useState("day");
  const [machineStatus, setMachineStatus] = useState("ok");
  const [downtimeReason, setDowntimeReason] = useState("");

  const processIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const apiDoneRef = useRef(false);
  const timerDoneRef = useRef(false);
  const apiResultRef = useRef<SubmitResponse | null>(null);
  const apiErrorRef = useRef<string | null>(null);

  // ---------------- Lock countdown (between submissions) ----------------
  const startLockCountdown = useCallback((fromSeconds: number = LOCK_SECONDS) => {
    setStage("locked");
    setLockLeft(fromSeconds);
    const start = Date.now();
    if (lockIntervalRef.current) clearInterval(lockIntervalRef.current);
    lockIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const left = Math.max(0, fromSeconds - elapsed);
      setLockLeft(left);
      if (left <= 0) {
        if (lockIntervalRef.current) clearInterval(lockIntervalRef.current);
        setStage("idle");
        setOutput("");
        setDowntimeReason("");
      }
    }, 250);
  }, []);

  // ---------------- Auth guard + initial load ----------------
  useEffect(() => {
    const storedOutputs = localStorage.getItem(SAVED_OUTPUTS_KEY);
    if (storedOutputs) {
      setSavedOutputs(JSON.parse(storedOutputs));
    }

    (async () => {
      try {
        const latest = await api.get<LaborEntry | null>(
          `/laborers/latest/${session.user.id}`
        );
        if (latest) {
          const elapsedMs = Date.now() - new Date(latest.created_at).getTime();
          const remaining = LOCK_SECONDS - Math.floor(elapsedMs / 1000);
          if (remaining > 0) {
            startLockCountdown(remaining);
          }
        }
      } catch {
        /* no previous entry yet — fine */
      }

      try {
        const notifs = await api.get<Notification[]>(
          `/notifications/employee/${session.user.id}`
        );
        setNotifications(notifs);
      } catch {
        /* ignore */
      }

      try {
        const analysis = await api.get<{ history: LaborEntry[] }>(
          `/analysis/${session.user.id}`
        );
        setRecentEntries((analysis.history || []).slice(-5).reverse());
      } catch {
        /* ignore */
      }

      setReady(true);
    })();

    return () => {
      if (processIntervalRef.current) clearInterval(processIntervalRef.current);
      if (lockIntervalRef.current) clearInterval(lockIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------- Live efficiency preview ----------------
  const previewEfficiency = useMemo(() => {
    const o = parseFloat(output);
    const w = parseFloat(workingMinutes);
    if (!o || !w) return null;
    const eff = (o * DEFAULT_SMV) / (DEFAULT_MANPOWER * w) * 100;
    return Number.isFinite(eff) ? eff : null;
  }, [output, workingMinutes]);

  const requiresDowntimeReason = previewEfficiency !== null && previewEfficiency < 60;

  // ---------------- Processing countdown + API call ----------------
  function maybeFinishProcessing() {
    if (!apiDoneRef.current || !timerDoneRef.current) return;

    if (apiErrorRef.current) {
      setError(apiErrorRef.current);
      setStage("idle");
      return;
    }

    const res = apiResultRef.current!;
    setLastResult(res);
    setError(null);

    if (res.flagged) {
      setIsFlagged(true);
      if (session) {
        saveEmployeeSession({
          ...session,
          user: { ...session.user, is_flagged: true, submission_count: res.submission_count },
        });
      }
    }
    if (res.notification) {
      setNotifications((prev) => [
        {
          id: Date.now(),
          laborer_id: session!.user.id,
          audience: "employee",
          type: "FLAG",
          message: res.notification!,
          is_read: false,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    }
    setRecentEntries((prev) => [res.entry, ...prev].slice(0, 5));
    setStage("result");
    startLockCountdown(LOCK_SECONDS);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (stage !== "idle" || !session) return;

    if (!output || !workingMinutes) {
      setError("Fill in output and working minutes.");
      return;
    }
    if (requiresDowntimeReason && !downtimeReason) {
      setError("Efficiency is looking low for this entry — pick a downtime reason before submitting.");
      return;
    }

    const nextSavedOutputs = [output, ...savedOutputs].slice(0, 5);
    setSavedOutputs(nextSavedOutputs);
    localStorage.setItem(SAVED_OUTPUTS_KEY, JSON.stringify(nextSavedOutputs));

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
      const res = await api.post<SubmitResponse>("/laborers", {
        laborers_id: session.user.id,
        output: Number(output),
        smv: DEFAULT_SMV,
        manpower: DEFAULT_MANPOWER,
        working_minutes: Number(workingMinutes),
        date: new Date().toISOString().slice(0, 10),
        shift,
        operator_skill: DEFAULT_OPERATOR_SKILL,
        machine_status: machineStatus,
        downtime_reason: downtimeReason || undefined,
      });
      apiResultRef.current = res;
      apiDoneRef.current = true;
    } catch (err) {
      apiErrorRef.current = err instanceof ApiError ? err.message : "Couldn't submit — check your connection and try again.";
      apiDoneRef.current = true;
    }
    maybeFinishProcessing();
  }

  function handleLogout() {
    clearEmployeeSession();
    router.push("/risk-analyze/employee/login");
  }

  if (!ready || !session) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <span className="mono text-[var(--ink-muted)]">Loading job card…</span>
      </main>
    );
  }

  const { user } = session;
  const shiftHour = Math.min(savedOutputs.length + 1, SHIFT_LENGTH_HOURS);

  return (
    <main className="min-h-screen px-5 py-10 md:py-14">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-start justify-between mb-8">
          <div>
            <div className="eyebrow text-[var(--amber)] mb-1">Employee · {user.employee_code}</div>
            <h1 className="display text-3xl text-white">Hi, {user.name.split(" ")[0]}</h1>
          </div>
          <button
            onClick={handleLogout}
            className="mono text-xs text-[var(--ink-muted)] hover:text-white border border-[var(--ink-line)] rounded-full px-3 py-1.5"
          >
            Log out
          </button>
        </header>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="panel px-4 py-3">
            <div className="eyebrow text-[var(--ink-muted)] mb-1">Daily target</div>
            <div className="mono text-lg text-white">{DAILY_TARGET.toLocaleString()} pcs</div>
          </div>
          <div className="panel px-4 py-3">
            <div className="eyebrow text-[var(--ink-muted)] mb-1">Shift hour</div>
            <div className="mono text-lg text-white">{shiftHour} / {SHIFT_LENGTH_HOURS}</div>
          </div>
        </div>

        {isFlagged && (
          <div className="mb-6 panel-raised border-l-4 border-l-[var(--red)] px-5 py-4 flex gap-3 items-start">
            <span className="text-xl">⚑</span>
            <div>
              <div className="text-sm font-semibold text-white mb-1">You&apos;re flagged for review</div>
              <p className="text-sm text-[var(--ink-muted)]">
                Your floor manager has been notified after low efficiency in your early submissions.
                This is about support, not punishment — someone will check in with you.
              </p>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-[1fr_360px] gap-6">
          {/* ---------------- Job Card ---------------- */}
          <div className="job-card">
            <div className="punch-holes">
              {Array.from({ length: 10 }).map((_, i) => (
                <span key={i} />
              ))}
            </div>
            <div className="job-card__body">
              {stage === "idle" && (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <div className="eyebrow text-[var(--card-muted)] mb-1">Digital Job Card</div>
                      <h2 className="display text-xl">Log this hour</h2>
                    </div>
                    <span className="mono text-xs text-[var(--card-muted)]">
                      {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Output (pcs)">
                        <input
                          type="number"
                          min="0"
                          className="job-input"
                          value={output}
                          onChange={(e) => setOutput(e.target.value)}
                          required
                        />
                      </Field>
                      <Field label="Working minutes">
                        <input
                          type="number"
                          min="1"
                          className="job-input"
                          value={workingMinutes}
                          onChange={(e) => setWorkingMinutes(e.target.value)}
                          required
                        />
                      </Field>
                      <Field label="Shift">
                        <select className="job-input" value={shift} onChange={(e) => setShift(e.target.value)}>
                          <option value="day">Day</option>
                          <option value="night">Night</option>
                        </select>
                      </Field>
                      <Field label="Machine status" full>
                        <select
                          className="job-input"
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
                        className={`text-sm rounded-lg px-3 py-2 mono ${
                          requiresDowntimeReason
                            ? "bg-[var(--red-soft)] text-[#a5352a]"
                            : "bg-[var(--green-soft)] text-[#1f6b41]"
                        }`}
                      >
                        Live estimate: {previewEfficiency.toFixed(1)}% efficiency
                      </div>
                    )}

                    {requiresDowntimeReason && (
                      <Field label="Downtime reason (required — efficiency is low)">
                        <select
                          className="job-input border-[var(--red)]"
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

                    {error && (
                      <div className="text-sm text-[#a5352a] bg-[var(--red-soft)] rounded-lg px-3 py-2">
                        {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      className="mt-2 bg-[var(--ink)] text-white rounded-lg py-3 font-semibold tracking-wide hover:bg-black transition-colors"
                    >
                      Submit hourly log
                    </button>
                  </form>

                  <div className="mt-6 border-t border-[var(--card-line)] pt-5">
                    <div className="eyebrow text-[var(--card-muted)] mb-3">Saved outputs</div>
                    {savedOutputs.length === 0 ? (
                      <p className="text-sm text-[var(--card-muted)]">No outputs saved yet.</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {savedOutputs.map((savedOutput, index) => (
                          <div
                            key={`${savedOutput}-${index}`}
                            className="flex items-center justify-between gap-3 border-b border-[var(--card-line)] pb-2 last:border-b-0 last:pb-0"
                          >
                            <div>
                              <div className="mono text-sm font-semibold">{Number(savedOutput).toFixed(0)} pcs</div>
                              <div className="text-xs text-[var(--card-muted)]">
                                Saved locally
                              </div>
                            </div>
                            <span className="tag tag-medium">PENDING</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {stage === "processing" && (
                <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
                  <CountdownRing
                    secondsLeft={processingLeft}
                    totalSeconds={PROCESS_SECONDS}
                    label="Analyzing submission"
                    tone="amber"
                  />
                  <p className="text-sm text-[var(--card-muted)] max-w-xs">
                    Running the variance check and predictive model against your entry…
                  </p>
                </div>
              )}

              {(stage === "result" || stage === "locked") && lastResult && (
                <ResultView result={lastResult} stage={stage} lockLeft={lockLeft} />
              )}
            </div>
          </div>

          {/* ---------------- Side rail ---------------- */}
          <div className="flex flex-col gap-5">
            <div className="panel p-5">
              <div className="eyebrow text-[var(--ink-muted)] mb-3">Your notifications</div>
              {notifications.length === 0 ? (
                <p className="text-sm text-[var(--ink-muted)]">
                  Nothing yet — clean shift so far.
                </p>
              ) : (
                <ul className="flex flex-col gap-3 max-h-64 overflow-y-auto scrollbar-thin pr-1">
                  {notifications.map((n) => (
                    <li key={n.id} className="text-sm border-l-2 border-l-[var(--red)] pl-3">
                      <p className="text-white leading-snug">{n.message}</p>
                      <span className="text-xs text-[var(--ink-muted)]">
                        {new Date(n.created_at).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="panel p-5">
              <div className="eyebrow text-[var(--ink-muted)] mb-3">Recent hours</div>
              {recentEntries.length === 0 ? (
                <p className="text-sm text-[var(--ink-muted)]">No entries logged yet today.</p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {recentEntries.map((entry) => (
                    <li key={entry.id} className="flex items-center justify-between text-sm">
                      <span className="mono text-[var(--ink-muted)]">
                        {entry.time?.slice(0, 5) ?? "--:--"}
                      </span>
                      <StatusTag status={entry.status} />
                      <span className="mono text-white">{Number(entry.efficiency).toFixed(1)}%</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
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
      <span className="text-xs font-semibold text-[var(--card-muted)] uppercase tracking-wide">
        {label}
      </span>
      {children}
    </label>
  );
}

function StatusTag({ status }: { status: string }) {
  const cls = status === "HIGH" ? "tag-high" : status === "MEDIUM" ? "tag-medium" : "tag-low";
  return <span className={`tag ${cls}`}>{status}</span>;
}

function ResultView({
  result,
  stage,
  lockLeft,
}: {
  result: SubmitResponse;
  stage: Stage;
  lockLeft: number;
}) {
  const { entry, prediction, risk, flagged_now } = result;
  return (
    <div className="flex flex-col items-center text-center gap-5 py-4">
      <div className="eyebrow text-[var(--card-muted)]">Submission logged</div>
      <EfficiencyGauge value={Number(entry.efficiency)} />

      {flagged_now && (
        <div className="w-full bg-[var(--red-soft)] text-[#a5352a] rounded-lg px-4 py-3 text-sm font-medium">
          ⚑ You&apos;ve been flagged for review — your floor manager has been notified.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 w-full text-left">
        <MiniStat label="Predicted output" value={`${Number(prediction.predicted_output).toFixed(0)} pcs`} />
        <MiniStat label="Model class" value={prediction.efficiency_class} />
        <MiniStat
          label="Batch completion"
          value={prediction.batch_completion_time != null ? `${prediction.batch_completion_time.toFixed(0)} min` : "—"}
        />
        <MiniStat
          label="Risk"
          value={`${risk.risk_level} · ${risk.risk_score.toFixed(1)}%`}
          tone={risk.risk_level === "HIGH" ? "red" : risk.risk_level === "MEDIUM" ? "amber" : "green"}
        />
      </div>

      <div className="w-full border-t border-[var(--card-line)] pt-4 mt-1">
        {stage === "locked" ? (
          <div className="flex flex-col items-center gap-2">
            <CountdownRing secondsLeft={lockLeft} totalSeconds={LOCK_SECONDS} label="Next entry unlocks in" tone="blue" size={100} />
          </div>
        ) : (
          <p className="text-sm text-[var(--card-muted)]">Preparing your next entry…</p>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "red" | "amber" | "green" }) {
  const color = tone === "red" ? "#a5352a" : tone === "amber" ? "#8a5a11" : tone === "green" ? "#1f6b41" : "var(--card-ink)";
  return (
    <div className="bg-white/50 rounded-lg px-3 py-2.5 border border-[var(--card-line)]">
      <div className="text-[10px] uppercase tracking-wide text-[var(--card-muted)] mb-0.5">{label}</div>
      <div className="mono font-semibold" style={{ color }}>{value}</div>
    </div>
  );
}
