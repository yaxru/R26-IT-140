"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { generateAssessmentToken } from "@/lib/stress/api";
import {
  Activity,
  Copy,
  Check,
  ChevronRight,
  BrainCircuit,
  Fingerprint,
  Stethoscope,
  RefreshCw,
} from "lucide-react";

const SCROLLBAR =
  "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#D4D4D4] dark:[&::-webkit-scrollbar-thumb]:bg-zinc-800 hover:[&::-webkit-scrollbar-thumb]:bg-[#C6C6C6] dark:hover:[&::-webkit-scrollbar-thumb]:bg-zinc-700 [&::-webkit-scrollbar-thumb]:rounded-none";

interface FlaggedWorker {
  operator_id: string;
  is_flagged: boolean;
  flag_reason: string | null;
  flagged_at: string | null;
  updated_at: string;
  operators: { worker_id: string; name: string };
}

type FlagRow = Omit<FlaggedWorker, "operators"> & {
  operators:
    | NonNullable<FlaggedWorker["operators"]>
    | NonNullable<FlaggedWorker["operators"]>[];
};

interface StressAssessment {
  session_id: string;
  worker_id: string;
  pss10_score: number;
  pss10_classification: string;
  avg_game_pressure: number | null;
  pressure_gap: number | null;
  response_time_ms: number;
  model_output: number | null;
  model_confidence: number | null;
  created_at: string;
}

function hasPreviousFlag(flag: FlaggedWorker) {
  return Boolean(flag.flagged_at && flag.flag_reason);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | string | null | undefined, digits = 0) {
  if (n == null) return "—";
  // Removed the * 100 because the data is already a percentage
  return Number(n).toFixed(digits);
}

// Reusable Kpi Tile
const KpiTile = ({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: "green" | "amber" | "none";
}) => {
  const valueColor =
    accent === "green"
      ? "text-[#1A7C4B] dark:text-[#47966F]"
      : accent === "amber"
        ? "text-[#CE8E33] dark:text-[#D7A45A]"
        : "text-[#242424] dark:text-zinc-100";
  return (
    <div className="flex-1 border-r border-b border-[#EAEAEA] dark:border-zinc-800 p-5 flex flex-col justify-center bg-white dark:bg-[#111113]">
      <p className="text-[10px] font-medium tracking-widest text-[#9A9A9A] uppercase mb-1.5">
        {label}
      </p>
      <p
        className={`text-xl font-bold tabular-nums leading-none tracking-tight ${valueColor}`}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[10px] text-[#9A9A9A] dark:text-zinc-500 mt-1.5 uppercase tracking-wide truncate">
          {sub}
        </p>
      )}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SupervisorStressDashboard() {
  const supabase = createClient();
  const [flaggedWorkers, setFlaggedWorkers] = useState<FlaggedWorker[]>([]);
  const [assessments, setAssessments] = useState<
    Record<string, StressAssessment>
  >({});
  const [loading, setLoading] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState<FlaggedWorker | null>(
    null,
  );

  // Link Generation States
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [generatedLinks, setGeneratedLinks] = useState<Record<string, string>>(
    {},
  );
  const [linkErrors, setLinkErrors] = useState<Record<string, string>>({});
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);

    // Fetch active flags and prior flags retained for the supervisor's history.
    const { data: flags, error: flagsError } = await supabase
      .from("operator_flags")
      .select(
        `
        operator_id,
        is_flagged,
        flag_reason,
        flagged_at,
        updated_at,
        operators (worker_id, name)
      `,
      )
      .order("flagged_at", { ascending: false });

    // 2. Fetch recent assessments to cross-reference
    const { data: asmtData } = await supabase
      .from("stress_assessments")
      .select("*")
      .order("created_at", { ascending: false });

    if (flagsError) {
      console.error("Failed to fetch operator flags:", flagsError);
    } else if (flags) {
      const retainedFlags = (flags as FlagRow[]).flatMap((flag) => {
        const operator = Array.isArray(flag.operators)
          ? flag.operators[0]
          : flag.operators;
        if (!operator) return [];

        const normalizedFlag = {
          ...flag,
          operators: operator,
        } as FlaggedWorker;
        return normalizedFlag.is_flagged || hasPreviousFlag(normalizedFlag)
          ? [normalizedFlag]
          : [];
      });
      setFlaggedWorkers(retainedFlags);
    }

    // Map the LATEST assessment to each worker_id
    if (asmtData) {
      const asmtMap: Record<string, StressAssessment> = {};
      asmtData.forEach((a) => {
        if (!asmtMap[a.worker_id]) asmtMap[a.worker_id] = a;
      });
      setAssessments(asmtMap);
    }

    setLoading(false);
  };

  const generateAssessmentLink = async (
    workerId: string,
    workerName: string,
    opId: string,
  ) => {
    setGeneratingFor(opId);
    setLinkErrors((prev) => {
      const next = { ...prev };
      delete next[opId];
      return next;
    });
    try {
      const token = await generateAssessmentToken(workerId, workerName);
      const assessmentUrl = new URL("/assessment", window.location.origin);
      assessmentUrl.searchParams.set("token", token);
      setGeneratedLinks((prev) => ({ ...prev, [opId]: assessmentUrl.href }));
    } catch (error) {
      console.error("Error generating link:", error);
      setLinkErrors((prev) => ({
        ...prev,
        [opId]:
          error instanceof Error
            ? error.message
            : "Unable to generate assessment link.",
      }));
    } finally {
      setGeneratingFor(null);
    }
  };

  const copyToClipboard = (link: string, opId: string) => {
    navigator.clipboard.writeText(link);
    setCopiedLink(opId);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const handleClearFlag = async (operatorId: string) => {
    try {
      const { error } = await supabase
        .from("operator_flags")
        .update({
          is_flagged: false,
          updated_at: new Date().toISOString(),
        })
        .eq("operator_id", operatorId);
      if (error) throw error;

      setFlaggedWorkers((prev) =>
        prev.map((flag) =>
          flag.operator_id === operatorId
            ? { ...flag, is_flagged: false }
            : flag,
        ),
      );
      setSelectedWorker(null);
    } catch (error) {
      console.error("Failed to clear flag", error);
    }
  };

  return (
    <div className="flex flex-col flex-1 h-screen min-h-0 bg-[#F8F8F8] dark:bg-[#030C08] text-[#242424] dark:text-zinc-200 font-sans">
      {/* ── Top bar ──────────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-[#EAEAEA] dark:border-zinc-800 px-6 py-4 flex items-center justify-between bg-white dark:bg-[#111113]">
        <div>
        
          <h1 className="text-lg font-bold text-[#242424] dark:text-zinc-100 tracking-tight">
            Cognitive Load Diagnostics
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-[11px] text-[#5F5F5F] dark:text-zinc-400 max-w-sm text-right hidden sm:block font-mono uppercase tracking-widest">
            Protocol: Isolate &gt; Assess &gt; Reallocate
          </p>
        </div>
      </header>

      {/* ── Main Content: 50/50 Split Grid ─────────────────────────── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 min-h-0">
        {/* LEFT COLUMN: Flagged Queue */}
        <div className="flex flex-col border-r border-[#EAEAEA] dark:border-zinc-800 bg-[#FAFAFA] dark:bg-[#0a0a0c]">
          <div className="shrink-0 px-6 py-4 border-b border-[#EAEAEA] dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-[#111113]">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#5F5F5F] dark:text-zinc-400 flex items-center gap-2">
             
              Action Queue ({flaggedWorkers.filter((flag) => flag.is_flagged).length} active)
            </h2>
            <button
              onClick={fetchDashboardData}
              className="text-[10px] font-mono text-[#9A9A9A] hover:text-[#242424] dark:hover:text-zinc-200 uppercase tracking-widest transition-colors flex items-center gap-1.5"
            >
              <RefreshCw size={10} /> Refresh
            </button>
          </div>

          <div className={`flex-1 overflow-y-auto ${SCROLLBAR}`}>
            {loading ? (
              <div className="p-8 flex justify-center">
                <span className="text-xs text-[#9A9A9A] animate-pulse uppercase tracking-wider font-mono">
                  Loading diagnostics...
                </span>
              </div>
            ) : flaggedWorkers.length === 0 ? (
              <div className="p-12 flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-[#E6F1EC] dark:bg-[#0A321E] flex items-center justify-center mb-4 border border-[#B9D7C8] dark:border-[#104A2D]">
                  <Check className="w-6 h-6 text-[#1A7C4B]" />
                </div>
                <h3 className="font-bold text-sm tracking-wide">
                  NO FLAGGED WORKERS
                </h3>
                <p className="text-xs text-[#9A9A9A] mt-2 max-w-sm">
                  There are no active or retained previous flags to display.
                  This does not mean operators were assessed today.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#EAEAEA] dark:divide-zinc-800/60 border-b border-[#EAEAEA] dark:border-zinc-800">
                {flaggedWorkers.map((flag) => {
                  const report = assessments[flag.operators.worker_id];
                  const isActiveFlag = flag.is_flagged;
                  const isPreviousFlag = !isActiveFlag && hasPreviousFlag(flag);

                  const flagTime = new Date(
                    flag.flagged_at || flag.updated_at || 0,
                  ).getTime();
                  const reportTime = report
                    ? new Date(report.created_at).getTime()
                    : 0;

                  const isTestUpToDate =
                    report && reportTime >= flagTime - 60000;
                  const isSelected =
                    selectedWorker?.operator_id === flag.operator_id;

                  return (
                    <div
                      key={flag.operator_id}
                      className={`p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors ${
                        isSelected
                          ? "bg-[#FDFBF8] dark:bg-amber-950/10 border-l-[3px] border-l-[#CE8E33]"
                          : "bg-white dark:bg-[#111113] border-l-[3px] border-l-transparent hover:bg-[#F8F8F8] dark:hover:bg-zinc-900"
                      }`}
                    >
                      {/* Operator Info */}
                      <div>
                        <div className="flex items-center gap-3 mb-1.5">
                          <span className="font-bold text-sm tracking-tight text-[#242424] dark:text-zinc-100">
                            {flag.operators.name}
                          </span>
                          <span className="text-[10px] font-mono bg-[#FAFAFA] dark:bg-zinc-800/50 px-2 py-0.5 text-[#5F5F5F] dark:text-zinc-400 border border-[#EAEAEA] dark:border-zinc-700">
                            {flag.operators.worker_id}
                          </span>
                          {isTestUpToDate && (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-[#1A7C4B] dark:text-[#47966F] bg-[#E6F1EC] dark:bg-[#0A321E]/40 border border-[#B9D7C8] dark:border-[#104A2D] px-1.5 py-0.5">
                              Report Ready
                            </span>
                          )}
                          {isPreviousFlag && (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-[#5F5F5F] dark:text-zinc-400 bg-[#F8F8F8] dark:bg-zinc-800/40 border border-[#EAEAEA] dark:border-zinc-700 px-1.5 py-0.5">
                              Previous Flag
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#CE8E33] dark:text-[#E1BA82] flex items-center gap-1.5 font-medium">
                          Alert: {flag.flag_reason}
                        </p>
                        {isPreviousFlag && flag.flagged_at && (
                          <p className="mt-1 text-[10px] text-[#9A9A9A]">
                            Flagged: {new Date(flag.flagged_at).toLocaleString()}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="shrink-0 flex items-center">
                        {isTestUpToDate ? (
                          <button
                            onClick={() => setSelectedWorker(flag)}
                            className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-2 border ${
                              isSelected
                                ? "bg-[#CE8E33] text-white border-[#CE8E33]"
                                : "bg-white dark:bg-zinc-900 text-[#242424] dark:text-zinc-200 border-[#EAEAEA] dark:border-zinc-700 hover:bg-[#FAFAFA] dark:hover:bg-zinc-800"
                            }`}
                          >
                            <BrainCircuit size={14} />
                            View Report
                          </button>
                        ) : !generatedLinks[flag.operator_id] ? (
                          <div className="flex flex-col items-end gap-1.5">
                            {linkErrors[flag.operator_id] && (
                              <p
                                role="alert"
                                className="max-w-xs text-right text-[10px] text-red-600 dark:text-red-400"
                              >
                                {linkErrors[flag.operator_id]}
                              </p>
                            )}
                            {report && !isTestUpToDate && (
                              <span className="text-[9px] text-[#A77329] font-medium uppercase tracking-widest">
                                Old test detected. Retest required.
                              </span>
                            )}
                            {isPreviousFlag && !report && (
                              <span className="max-w-xs text-right text-[10px] text-[#9A9A9A]">
                                No assessment was completed for this earlier
                                flag. Generate a link to send the worker.
                              </span>
                            )}
                            <button
                              onClick={() =>
                                generateAssessmentLink(
                                  flag.operators.worker_id,
                                  flag.operators.name,
                                  flag.operator_id,
                                )
                              }
                              disabled={generatingFor === flag.operator_id}
                              className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest bg-[#242424] dark:bg-zinc-200 text-white dark:text-[#0d0d0f] hover:bg-black dark:hover:bg-white transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                              {generatingFor === flag.operator_id
                                ? "Generating..."
                                : "Generate Test Link"}
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <input
                              type="text"
                              readOnly
                              value={generatedLinks[flag.operator_id]}
                              className="w-full sm:w-48 px-3 py-2 text-[10px] font-mono bg-[#FAFAFA] dark:bg-zinc-900/50 border border-[#EAEAEA] dark:border-zinc-700 border-r-0 text-[#5F5F5F] dark:text-zinc-400 focus:outline-none"
                            />
                            <button
                              onClick={() =>
                                copyToClipboard(
                                  generatedLinks[flag.operator_id],
                                  flag.operator_id,
                                )
                              }
                              className="px-3 py-2 bg-[#E6F1EC] dark:bg-[#0A321E]/60 text-[#1A7C4B] dark:text-[#47966F] border border-[#B9D7C8] dark:border-[#104A2D] hover:bg-[#1A7C4B] hover:text-white transition-colors"
                              title="Copy Link"
                            >
                              {copiedLink === flag.operator_id ? (
                                <Check size={14} />
                              ) : (
                                <Copy size={14} />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

       {/* RIGHT COLUMN: Diagnostic Results Panel */}
        <div className="flex flex-col bg-white dark:bg-[#111113]">
          
          <div className="shrink-0 px-6 py-4 border-b border-[#EAEAEA] dark:border-zinc-800 bg-[#FAFAFA] dark:bg-[#0a0a0c]">
            <p className="text-[10px] font-bold tracking-widest text-[#9A9A9A] dark:text-zinc-500 uppercase">
              Operator Diagnostic Profile
            </p>
          </div>

          {!selectedWorker ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-[#111113]">
              <div className="w-12 h-12 bg-[#F8F8F8] dark:bg-zinc-900 border border-[#EAEAEA] dark:border-zinc-800 flex items-center justify-center mb-4">
                <Activity className="w-5 h-5 text-[#9A9A9A]" />
              </div>
              <h3 className="font-bold text-xs uppercase tracking-widest text-[#5F5F5F] dark:text-zinc-400">
                Awaiting Selection
              </h3>
              <p className="text-[11px] text-[#9A9A9A] mt-2 max-w-sm leading-relaxed">
                Select an operator with a &quot;Report Ready&quot; badge from the queue to view their cognitive load and motor-function diagnostic results.
              </p>
            </div>
          ) : (
            (() => {
              const report = assessments[selectedWorker.operators.worker_id];
              if (!report) return null;

              const hasPrediction = report.model_output != null;
              const isStressed = hasPrediction && Number(report.model_output) === 1;

              // DSS Logic mapped directly from the backend intervention_recommendation function
              const dssRecommendation = (() => {
                if (!hasPrediction) return "Assessment Needed";
                const out = Number(report.model_output);
                const pss = report.pss10_classification;
                if (out === 1 && pss === "High") return "Escalate to Counsellor";
                if (out === 1 || pss === "Moderate" || pss === "High") return "Welfare Check";
                return "Monitor";
              })();

              // Contextual explanation for the Dual-source stress score Output
              const dssContext = (() => {
                if (!hasPrediction) {
                  return "This assessment has no model result. Generate a new assessment before making a decision about the flag.";
                }
                if (dssRecommendation === "Escalate to Counsellor") {
                  return "Critical cognitive overload and high psychological stress detected. Immediate removal from the line and referral to occupational health or counselling is required.";
                }
                if (dssRecommendation === "Welfare Check") {
                  return "Moderate fatigue or stress indicators detected. Recommend a scheduled break, a direct welfare check by the supervisor, or a temporary reallocation to a low-strain station.";
                }
                return "Cognitive and motor functions are within standard operating variance. The initial flag was likely caused by mechanical issues or external line delays. Clear flag and return to duty.";
              })();

              return (
                <div className={`flex-1 overflow-y-auto flex flex-col ${SCROLLBAR}`}>
                  
                  {/* Result Header */}
                  <div className={`p-6 border-b border-[#EAEAEA] dark:border-zinc-800 ${isStressed ? "bg-[#FDFBF8] dark:bg-[#1A1510]" : "bg-[#E6F1EC]/30 dark:bg-[#0A321E]/10"}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h2 className="text-xl font-bold text-[#242424] dark:text-zinc-100 tracking-tight">
                          {selectedWorker.operators.name}
                        </h2>
                        <span className="text-[10px] font-mono text-[#5F5F5F] dark:text-zinc-400">
                          {selectedWorker.operators.worker_id} · Tested: {new Date(report.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest border ${
                        !hasPrediction
                          ? "text-[#5F5F5F] border-[#D4D4D4] bg-white dark:bg-[#111113]"
                          : isStressed
                            ? "text-[#CE8E33] border-[#CE8E33] bg-white dark:bg-[#111113]"
                            : "text-[#1A7C4B] border-[#1A7C4B] bg-white dark:bg-[#111113]"
                      }`}>
                        {!hasPrediction ? "Assessment Needed" : isStressed ? "Fatigue Detected" : "Optimal State"}
                      </span>
                    </div>

                    {/* DSS Recommendation Block */}
                    <div className="mt-4 bg-white dark:bg-[#111113] border border-[#EAEAEA] dark:border-zinc-800 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity size={12} className={dssRecommendation === "Monitor" ? "text-[#1A7C4B]" : "text-[#CE8E33]"} />
                        <p className="text-[9px] font-bold tracking-widest text-[#9A9A9A] uppercase">DSS Output Instruction</p>
                      </div>
                      <p className={`text-sm font-bold uppercase tracking-wide ${dssRecommendation === "Monitor" ? "text-[#1A7C4B] dark:text-[#47966F]" : dssRecommendation === "Assessment Needed" ? "text-[#5F5F5F] dark:text-zinc-400" : "text-[#CE8E33] dark:text-[#D7A45A]"}`}>
                        {dssRecommendation}
                      </p>
                      <p className="text-[11px] text-[#5F5F5F] dark:text-zinc-400 mt-1.5 leading-relaxed">
                        {dssContext}
                      </p>
                    </div>
                  </div>

                  {/* 2x2 Bento Grid for Metrics */}
                  <div className="grid grid-cols-2">
                    <KpiTile 
                      label="Psychometric Score" 
                      value={report.pss10_score != null ? `${report.pss10_score} / 40` : "—"} 
                      sub={`Class: ${report.pss10_classification || "Unknown"}`} 
                      accent={report.pss10_score != null && Number(report.pss10_score) > 20 ? "amber" : "none"} 
                    />
                    <KpiTile 
                      label="AI Confidence" 
                      value={`${fmt(report.model_confidence, 2)}%`}
                      sub="Prediction Accuracy"
                    />
                    <KpiTile 
                      label="Motor Response" 
                      value={report.response_time_ms != null ? `${report.response_time_ms} ms` : "—"} 
                      sub="Avg target acquisition time" 
                      accent={report.response_time_ms != null && Number(report.response_time_ms) > 800 ? "amber" : "none"} 
                    />
                    <KpiTile 
                      label="Pressure Variance" 
                      value={report.pressure_gap != null ? Number(report.pressure_gap).toFixed(2) : "—"}
                      sub="Deviation from baseline"
                    />
                  </div>

                  {/* Bottom Action Area */}
                  <div className="p-6 mt-auto bg-[#FAFAFA] dark:bg-[#0a0a0c] border-t border-[#EAEAEA] dark:border-zinc-800">
                    <p className="text-[10px] font-bold tracking-widest text-[#9A9A9A] dark:text-zinc-500 uppercase mb-3">
                      Required Supervisor Action
                    </p>

                    {/* Quick Link Regenerator within Action Area */}
                    {generatedLinks[selectedWorker.operator_id] && (
                      <div className="flex items-center mb-4">
                        <input
                          type="text"
                          readOnly
                          value={generatedLinks[selectedWorker.operator_id]}
                          className="w-full px-3 py-2 text-[10px] font-mono bg-white dark:bg-[#111113] border border-[#EAEAEA] dark:border-zinc-800 border-r-0 text-[#5F5F5F] dark:text-zinc-400 focus:outline-none"
                        />
                        <button
                          onClick={() => copyToClipboard(generatedLinks[selectedWorker.operator_id], selectedWorker.operator_id)}
                          className="px-4 py-2 bg-[#E6F1EC] dark:bg-[#0A321E]/60 text-[#1A7C4B] dark:text-[#47966F] border border-[#B9D7C8] dark:border-[#104A2D] hover:bg-[#1A7C4B] hover:text-white transition-colors"
                        >
                          {copiedLink === selectedWorker.operator_id ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                    )}

                    {selectedWorker.is_flagged ? (
                      <div className="flex gap-3">
                        {isStressed ? (
                          <>
                            <button className="flex-1 bg-[#242424] dark:bg-zinc-200 text-white dark:text-[#0d0d0f] hover:bg-black dark:hover:bg-white text-[11px] font-bold uppercase tracking-widest py-3 border border-transparent transition-colors flex items-center justify-center gap-2">
                              <Stethoscope size={14} /> Send to Medical
                            </button>
                            <Link href="/worker-reallocation" className="flex-1 bg-white dark:bg-[#111113] text-[#242424] dark:text-zinc-200 hover:bg-[#F8F8F8] dark:hover:bg-zinc-900 text-[11px] font-bold uppercase tracking-widest py-3 border border-[#EAEAEA] dark:border-zinc-700 transition-colors flex items-center justify-center gap-2">
                              <Fingerprint size={14} /> Reallocate Line
                            </Link>
                          </>
                        ) : !hasPrediction ? (
                          <p className="flex-1 text-xs text-[#9A9A9A]">
                            Generate a new assessment before changing this flag.
                          </p>
                        ) : (
                          <button
                            onClick={() => handleClearFlag(selectedWorker.operator_id)}
                            className="flex-1 bg-[#1A7C4B] hover:bg-[#15633C] text-white text-[11px] font-bold uppercase tracking-widest py-3 border border-transparent transition-colors flex items-center justify-center gap-2"
                          >
                            <Check size={14} /> Clear Flag & Return
                          </button>
                        )}

                        <button
                          onClick={() => generateAssessmentLink(selectedWorker.operators.worker_id, selectedWorker.operators.name, selectedWorker.operator_id)}
                          className="flex-[0.5] bg-white dark:bg-[#111113] text-[#242424] dark:text-zinc-200 hover:bg-[#F8F8F8] dark:hover:bg-zinc-900 text-[11px] font-bold uppercase tracking-widest py-3 border border-[#EAEAEA] dark:border-zinc-700 transition-colors flex items-center justify-center gap-2"
                        >
                          <BrainCircuit size={14} /> Retake Test
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-[#9A9A9A]">
                        Historical record only. It does not indicate an active
                        flag or an assessment completed today.
                      </p>
                    )}
                  </div>

                </div>
              );
            })()
          )}
        </div>
      </div>
    </div>
  );
}
