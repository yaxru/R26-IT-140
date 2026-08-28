"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  AlertTriangle,
  Activity,
  Link as LinkIcon,
  Copy,
  Check,
  ChevronRight,
} from "lucide-react";

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

export default function SupervisorStressDashboard() {
  const supabase = createClient();
  const [flaggedWorkers, setFlaggedWorkers] = useState<FlaggedWorker[]>([]);
  const [loading, setLoading] = useState(true);

  // Link Generation States
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [generatedLinks, setGeneratedLinks] = useState<Record<string, string>>(
    {},
  );
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  useEffect(() => {
    fetchFlaggedWorkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchFlaggedWorkers = async () => {
    setLoading(true);
    // Fetch workers who are currently flagged, joined with their name and ID
    const { data, error } = await supabase
      .from("operator_flags")
      .select(
        `
        operator_id,
        is_flagged,
        flag_reason,
        updated_at,
        operators (worker_id, name)
      `,
      )
      .eq("is_flagged", true)
      .order("updated_at", { ascending: false });

    if (data && !error) {
      // @ts-ignore - Supabase join typing
      setFlaggedWorkers(data);
    }
    setLoading(false);
  };

  const generateAssessmentLink = async (
    workerId: string,
    workerName: string,
    opId: string,
  ) => {
    setGeneratingFor(opId);
    try {
      // Hitting the Flask backend dev route to generate the secure JWT token
      const res = await fetch(
        `http://localhost:8003/api/stress-detection/dev/token?worker_id=${workerId}&worker_name=${encodeURIComponent(workerName)}`,
      );
      if (!res.ok) throw new Error("Failed to generate token");

      const data = await res.json();

      setGeneratedLinks((prev) => ({
        ...prev,
        [opId]: data.test_url,
      }));
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

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 bg-[#F8F8F8] dark:bg-[#030C08] text-[#242424] dark:text-zinc-200 font-sans">
      {/* ── Top bar ──────────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-[#EAEAEA] dark:border-zinc-800 px-6 py-4 flex items-center justify-between bg-white dark:bg-[#0d0d0f]">
        <div>
          <p className="text-[10px] font-medium tracking-widest text-[#9A9A9A] dark:text-zinc-500 uppercase mb-0.5">
            Management · Welfare & Reallocation
          </p>
          <h1 className="text-lg font-bold text-[#242424] dark:text-zinc-100 tracking-tight">
            Flagged Operator Monitoring
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-xs text-[#5F5F5F] dark:text-zinc-400 max-w-sm text-right hidden sm:block">
            Generate secure cognitive assessment links before executing line
            reallocations.
          </p>
        </div>
      </header>

      {/* ── Main Content ─────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6 lg:p-8">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {/* Left Column: The Flagged List */}
          <div className="xl:col-span-2 space-y-4">
            <div className="flex items-center justify-between border-b border-[#EAEAEA] dark:border-zinc-800 pb-2 mb-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#5F5F5F] dark:text-zinc-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#CE8E33]" />
                Requires Attention ({flaggedWorkers.length})
              </h2>
              <button
                onClick={fetchFlaggedWorkers}
                className="text-[10px] font-mono text-[#9A9A9A] hover:text-[#242424] dark:hover:text-zinc-200 uppercase tracking-widest transition-colors"
              >
                Refresh List
              </button>
            </div>

            {loading ? (
              <div className="bg-white dark:bg-[#0d0d0f] border border-[#EAEAEA] dark:border-zinc-800 p-8 flex justify-center">
                <span className="text-xs text-[#9A9A9A] animate-pulse uppercase tracking-wider font-mono">
                  Loading flagged operators...
                </span>
              </div>
            ) : flaggedWorkers.length === 0 ? (
              <div className="bg-white dark:bg-[#0d0d0f] border border-[#EAEAEA] dark:border-zinc-800 p-12 flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-[#E6F1EC] dark:bg-[#0A321E] flex items-center justify-center mb-4 border border-[#B9D7C8] dark:border-[#104A2D]">
                  <Check className="w-6 h-6 text-[#1A7C4B]" />
                </div>
                <h3 className="font-bold text-sm tracking-wide">
                  NO ACTIVE FLAGS
                </h3>
                <p className="text-xs text-[#9A9A9A] mt-2 max-w-sm">
                  All operators are currently meeting their dynamic piece
                  targets without alarming deviations.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {flaggedWorkers.map((flag) => (
                  <div
                    key={flag.operator_id}
                    className="bg-white dark:bg-[#0d0d0f] border border-[#EAEAEA] dark:border-zinc-800 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:border-[#CE8E33]/40 dark:hover:border-[#CE8E33]/40"
                  >
                    {/* Operator Info */}
                    <div>
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className="font-bold text-base tracking-tight">
                          {flag.operators.name}
                        </span>
                        <span className="text-[10px] font-mono bg-[#F8F8F8] dark:bg-zinc-800/50 px-2 py-0.5 text-[#5F5F5F] dark:text-zinc-400 border border-[#EAEAEA] dark:border-zinc-700">
                          {flag.operators.worker_id}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-[#CE8E33] dark:text-[#E1BA82] flex items-center gap-1.5">
                        Flag Reason: {flag.flag_reason}
                      </p>
                      <p className="text-[10px] text-[#9A9A9A] mt-1.5 font-mono">
                        FLAGGED:{" "}
                        {new Date(flag.updated_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="shrink-0">
                      {!generatedLinks[flag.operator_id] ? (
                        <button
                          onClick={() =>
                            generateAssessmentLink(
                              flag.operators.worker_id,
                              flag.operators.name,
                              flag.operator_id,
                            )
                          }
                          disabled={generatingFor === flag.operator_id}
                          className="w-full sm:w-auto px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest bg-[#242424] hover:bg-black dark:bg-zinc-100 dark:hover:bg-white dark:text-[#0d0d0f] text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {generatingFor === flag.operator_id
                            ? "GENERATING..."
                            : "GENERATE ASSESSMENT"}
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <div className="flex items-center">
                          <input
                            type="text"
                            readOnly
                            value={generatedLinks[flag.operator_id]}
                            className="w-full sm:w-56 px-3 py-2 text-[10px] font-mono bg-[#F8F8F8] dark:bg-zinc-900/50 border border-[#EAEAEA] dark:border-zinc-800 border-r-0 text-[#9A9A9A] focus:outline-none"
                          />
                          <button
                            onClick={() =>
                              copyToClipboard(
                                generatedLinks[flag.operator_id],
                                flag.operator_id,
                              )
                            }
                            className="p-2 bg-[#E6F1EC] dark:bg-[#0A321E]/60 text-[#1A7C4B] dark:text-[#47966F] border border-[#B9D7C8] dark:border-[#104A2D] hover:bg-[#1A7C4B] hover:text-white dark:hover:bg-[#1A7C4B] dark:hover:text-white transition-colors"
                            title="Copy Link"
                          >
                            {copiedLink === flag.operator_id ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Information Panel */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-[#0d0d0f] border border-[#EAEAEA] dark:border-zinc-800 p-6 flex flex-col h-full">
              <div className="w-8 h-8 bg-[#F8F8F8] dark:bg-zinc-900 border border-[#EAEAEA] dark:border-zinc-800 flex items-center justify-center mb-5">
                <Activity className="w-4 h-4 text-[#242424] dark:text-zinc-300" />
              </div>
              <h3 className="font-bold text-[11px] mb-2 uppercase tracking-widest text-[#242424] dark:text-zinc-300">
                Assessment Protocol
              </h3>
              <p className="text-xs text-[#5F5F5F] dark:text-zinc-400 leading-relaxed mb-6">
                When an operator's physical output drops below the AI target,
                they are flagged here. Before running the reallocation algorithm
                to move them, send them a cognitive assessment to determine if
                the drop is due to mental fatigue or mechanical issues.
              </p>

              <div className="mt-auto space-y-4 pt-6 border-t border-[#EAEAEA] dark:border-zinc-800">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 border border-[#CE8E33] dark:border-[#A77329] bg-[#FDFBF8] dark:bg-amber-950/20 text-[#CE8E33] dark:text-[#E1BA82] flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-mono font-bold">1</span>
                  </div>
                  <p className="text-[11px] text-[#5F5F5F] dark:text-zinc-400 pt-1">
                    Review the flagged operator list.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 border border-[#CE8E33] dark:border-[#A77329] bg-[#FDFBF8] dark:bg-amber-950/20 text-[#CE8E33] dark:text-[#E1BA82] flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-mono font-bold">2</span>
                  </div>
                  <p className="text-[11px] text-[#5F5F5F] dark:text-zinc-400 pt-1">
                    Generate a secure JWT link.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 border border-[#CE8E33] dark:border-[#A77329] bg-[#FDFBF8] dark:bg-amber-950/20 text-[#CE8E33] dark:text-[#E1BA82] flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-mono font-bold">3</span>
                  </div>
                  <p className="text-[11px] text-[#5F5F5F] dark:text-zinc-400 pt-0.5 leading-relaxed">
                    Send link to operator's mobile device. Data will feed
                    directly into the HR dashboard.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
