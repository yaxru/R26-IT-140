"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  AlertTriangle,
  Activity,
  Copy,
  Check,
  ChevronRight,
  BrainCircuit,
  Fingerprint,
  Stethoscope
} from "lucide-react";

const SCROLLBAR = "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#D4D4D4] dark:[&::-webkit-scrollbar-thumb]:bg-zinc-800 hover:[&::-webkit-scrollbar-thumb]:bg-[#C6C6C6] dark:hover:[&::-webkit-scrollbar-thumb]:bg-zinc-700 [&::-webkit-scrollbar-thumb]:rounded-none";

interface FlaggedWorker {
  operator_id: string;
  is_flagged: boolean;
  flag_reason: string;
  updated_at: string;
  operators: {
    worker_id: string;
    name: string;
  };
}

interface StressAssessment {
  session_id: string;
  worker_id: string;
  pss10_score: number;
  pss10_classification: string;
  avg_game_pressure: number;
  pressure_gap: number;
  response_time_ms: number;
  model_output: number;
  model_confidence: number;
  created_at: string;
}

function fmt(n: number | null | undefined, digits = 0) {
  if (n == null) return "—";
  return (n * 100).toFixed(digits);
}

export default function SupervisorStressDashboard() {
  const supabase = createClient();
  const [flaggedWorkers, setFlaggedWorkers] = useState<FlaggedWorker[]>([]);
  const [assessments, setAssessments] = useState<Record<string, StressAssessment>>({});
  const [loading, setLoading] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState<FlaggedWorker | null>(null);

  // Link Generation States
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [generatedLinks, setGeneratedLinks] = useState<Record<string, string>>({});
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    
    // 1. Fetch Flagged Workers
    const { data: flags, error: flagsError } = await supabase
      .from("operator_flags")
      .select(`
        operator_id,
        is_flagged,
        flag_reason,
        updated_at,
        operators (worker_id, name)
      `)
      .eq("is_flagged", true)
      .order("updated_at", { ascending: false });

    // 2. Fetch recent assessments to cross-reference completed tests
    const { data: asmtData } = await supabase
      .from("stress_assessments")
      .select("*")
      .order("created_at", { ascending: false });

    if (flags && !flagsError) {
      // @ts-ignore - Supabase join typing
      setFlaggedWorkers(flags);
    }

    // Map the latest assessment to each worker_id
    if (asmtData) {
      const asmtMap: Record<string, StressAssessment> = {};
      asmtData.forEach((a) => {
        if (!asmtMap[a.worker_id]) asmtMap[a.worker_id] = a;
      });
      setAssessments(asmtMap);
    }
    
    setLoading(false);
  };

  const generateAssessmentLink = async (workerId: string, workerName: string, opId: string) => {
    setGeneratingFor(opId);
    try {
      // Backend generation for the assessment protocol
      const res = await fetch(
        `http://localhost:8003/api/stress-detection/dev/token?worker_id=${workerId}&worker_name=${encodeURIComponent(workerName)}`,
      );
      if (!res.ok) throw new Error("Failed to generate link");

      const data = await res.json();
      setGeneratedLinks((prev) => ({ ...prev, [opId]: data.test_url }));
    } catch (error) {
      console.error("Error generating link:", error);
    } finally {
      setGeneratingFor(null);
    }
  };

  const copyToClipboard = (link: string, opId: string) => {
    navigator.clipboard.writeText(link);
    setCopiedLink(opId);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  // Reusable Kpi Tile for the Results Panel
  const KpiTile = ({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: string; accent?: "green" | "amber" | "none" }) => {
    const valueColor = accent === "green" ? "text-[#1A7C4B] dark:text-[#47966F]" : accent === "amber" ? "text-[#CE8E33] dark:text-[#D7A45A]" : "text-[#242424] dark:text-zinc-100";
    return (
      <div className="flex-1 border-r border-b border-[#EAEAEA] dark:border-zinc-800 p-5 flex flex-col justify-center bg-white dark:bg-[#111113]">
        <p className="text-[10px] font-medium tracking-widest text-[#9A9A9A] uppercase mb-1.5">{label}</p>
        <p className={`text-xl font-bold tabular-nums leading-none tracking-tight ${valueColor}`}>{value}</p>
        {sub && <p className="text-[10px] text-[#9A9A9A] dark:text-zinc-500 mt-1.5 uppercase tracking-wide truncate">{sub}</p>}
      </div>
    );
  };

  return (
    <div className="flex flex-col flex-1 h-screen min-h-0 bg-[#F8F8F8] dark:bg-[#030C08] text-[#242424] dark:text-zinc-200 font-sans">
      
      {/* ── Top bar ──────────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-[#EAEAEA] dark:border-zinc-800 px-6 py-4 flex items-center justify-between bg-white dark:bg-[#111113]">
        <div>
          <p className="text-[10px] font-medium tracking-widest text-[#9A9A9A] dark:text-zinc-500 uppercase mb-0.5">
            Management · Welfare & Diagnostics
          </p>
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
              <AlertTriangle size={14} className="text-[#CE8E33]" />
              Action Queue ({flaggedWorkers.length})
            </h2>
            <button
              onClick={fetchDashboardData}
              className="text-[10px] font-mono text-[#9A9A9A] hover:text-[#242424] dark:hover:text-zinc-200 uppercase tracking-widest transition-colors"
            >
              Refresh ↻
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
                <h3 className="font-bold text-sm tracking-wide">SYSTEM OPTIMAL</h3>
                <p className="text-xs text-[#9A9A9A] mt-2 max-w-sm">
                  All operators are tracking within normal efficiency variances. No cognitive assessments required.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#EAEAEA] dark:divide-zinc-800/60 border-b border-[#EAEAEA] dark:border-zinc-800">
                {flaggedWorkers.map((flag) => {
                  const hasCompletedTest = !!assessments[flag.operators.worker_id];
                  const isSelected = selectedWorker?.operator_id === flag.operator_id;

                  return (
                    <div
                      key={flag.operator_id}
                      className={`p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors ${
                        isSelected ? "bg-[#FDFBF8] dark:bg-amber-950/10 border-l-[3px] border-l-[#CE8E33]" : "bg-white dark:bg-[#111113] border-l-[3px] border-l-transparent hover:bg-[#F8F8F8] dark:hover:bg-zinc-900"
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
                          {hasCompletedTest && (
                             <span className="text-[9px] font-bold uppercase tracking-wider text-[#1A7C4B] dark:text-[#47966F] bg-[#E6F1EC] dark:bg-[#0A321E]/40 border border-[#B9D7C8] dark:border-[#104A2D] px-1.5 py-0.5">
                               Report Ready
                             </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#CE8E33] dark:text-[#E1BA82] flex items-center gap-1.5 font-medium">
                          Alert: {flag.flag_reason}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="shrink-0 flex items-center">
                        {hasCompletedTest ? (
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
                          <button
                            onClick={() => generateAssessmentLink(flag.operators.worker_id, flag.operators.name, flag.operator_id)}
                            disabled={generatingFor === flag.operator_id}
                            className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest bg-[#242424] dark:bg-zinc-200 text-white dark:text-[#0d0d0f] hover:bg-black dark:hover:bg-white transition-colors flex items-center gap-2 disabled:opacity-50"
                          >
                            {generatingFor === flag.operator_id ? "Generating..." : "Generate Test Link"}
                            <ChevronRight size={14} />
                          </button>
                        ) : (
                          <div className="flex items-center">
                            <input
                              type="text"
                              readOnly
                              value={generatedLinks[flag.operator_id]}
                              className="w-full sm:w-48 px-3 py-2 text-[10px] font-mono bg-[#FAFAFA] dark:bg-zinc-900/50 border border-[#EAEAEA] dark:border-zinc-700 border-r-0 text-[#5F5F5F] dark:text-zinc-400 focus:outline-none"
                            />
                            <button
                              onClick={() => copyToClipboard(generatedLinks[flag.operator_id], flag.operator_id)}
                              className="px-3 py-2 bg-[#E6F1EC] dark:bg-[#0A321E]/60 text-[#1A7C4B] dark:text-[#47966F] border border-[#B9D7C8] dark:border-[#104A2D] hover:bg-[#1A7C4B] hover:text-white transition-colors"
                              title="Copy Link"
                            >
                              {copiedLink === flag.operator_id ? <Check size={14} /> : <Copy size={14} />}
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
                Select an operator with a "Report Ready" badge from the queue to view their cognitive load and motor-function diagnostic results.
              </p>
            </div>
          ) : (
            (() => {
              const report = assessments[selectedWorker.operators.worker_id];
              if (!report) return null; // Fallback safeguard

              const isStressed = report.model_output === 1;

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
                        isStressed ? "text-[#CE8E33] border-[#CE8E33] bg-white dark:bg-[#111113]" : "text-[#1A7C4B] border-[#1A7C4B] bg-white dark:bg-[#111113]"
                      }`}>
                        {isStressed ? "Fatigue Detected" : "Optimal State"}
                      </span>
                    </div>

                    <p className="text-[11px] text-[#5F5F5F] dark:text-zinc-400 leading-relaxed max-w-md">
                      {isStressed 
                        ? "The diagnostic model has flagged cognitive overload and motor-function decay. Recommend immediate station reallocation or scheduled break to prevent bottleneck cascade."
                        : "Cognitive assessment indicates standard operating variance. No severe mental fatigue detected. Flag was likely triggered by mechanical or external factors."
                      }
                    </p>
                  </div>

                  {/* 2x2 Bento Grid for Metrics */}
                  <div className="grid grid-cols-2">
                    <KpiTile 
                      label="Psychometric Score" 
                      value={report.pss10_score != null ? `${report.pss10_score} / 40` : "—"} 
                      sub={`Class: ${report.pss10_classification || "Unknown"}`} 
                      accent={report.pss10_score != null && report.pss10_score > 20 ? "amber" : "none"} 
                    />
                    <KpiTile 
                      label="AI Confidence" 
                      value={`${fmt(report.model_confidence, 1)}%`} 
                      sub="Prediction Accuracy" 
                    />
                    <KpiTile 
                      label="Motor Response" 
                      value={report.response_time_ms != null ? `${report.response_time_ms} ms` : "—"} 
                      sub="Avg target acquisition time" 
                      accent={report.response_time_ms != null && report.response_time_ms > 800 ? "amber" : "none"} 
                    />
                    <KpiTile 
                      label="Pressure Variance" 
                      value={report.pressure_gap != null ? report.pressure_gap.toFixed(2) : "—"} 
                      sub="Deviation from baseline" 
                    />
                  </div>

                  {/* Bottom Action Area */}
                  <div className="p-6 mt-auto bg-[#FAFAFA] dark:bg-[#0a0a0c] border-t border-[#EAEAEA] dark:border-zinc-800">
                    <p className="text-[10px] font-bold tracking-widest text-[#9A9A9A] dark:text-zinc-500 uppercase mb-3">
                      Required Supervisor Action
                    </p>
                    <div className="flex gap-3">
                      {isStressed ? (
                        <button className="flex-1 bg-[#242424] dark:bg-zinc-200 text-white dark:text-[#0d0d0f] hover:bg-black dark:hover:bg-white text-[11px] font-bold uppercase tracking-widest py-3 border border-transparent transition-colors flex items-center justify-center gap-2">
                          <Stethoscope size={14} /> Send to Medical
                        </button>
                      ) : (
                        <button className="flex-1 bg-[#1A7C4B] hover:bg-[#15633C] text-white text-[11px] font-bold uppercase tracking-widest py-3 border border-transparent transition-colors flex items-center justify-center gap-2">
                          <Check size={14} /> Clear Flag & Return
                        </button>
                      )}
                      <button className="flex-1 bg-white dark:bg-[#111113] text-[#242424] dark:text-zinc-200 hover:bg-[#F8F8F8] dark:hover:bg-zinc-900 text-[11px] font-bold uppercase tracking-widest py-3 border border-[#EAEAEA] dark:border-zinc-700 transition-colors flex items-center justify-center gap-2">
                        <Fingerprint size={14} /> Reallocate Line
                      </button>
                    </div>
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