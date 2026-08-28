"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertTriangle, Activity, Link as LinkIcon, Copy, Check, ChevronRight } from "lucide-react";

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
  const [generatedLinks, setGeneratedLinks] = useState<Record<string, string>>({});
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
      .select(`
        operator_id,
        is_flagged,
        flag_reason,
        updated_at,
        operators (worker_id, name)
      `)
      .eq("is_flagged", true)
      .order("updated_at", { ascending: false });

    if (data && !error) {
      // @ts-ignore - Supabase join typing
      setFlaggedWorkers(data);
    }
    setLoading(false);
  };

  const generateAssessmentLink = async (workerId: string, workerName: string, opId: string) => {
    setGeneratingFor(opId);
    try {
      // Hitting the Flask backend dev route to generate the secure JWT token
      const res = await fetch(`http://localhost:8003/api/stress-detection/dev/token?worker_id=${workerId}&worker_name=${encodeURIComponent(workerName)}`);
      if (!res.ok) throw new Error("Failed to generate token");
      
      const data = await res.json();
      
      setGeneratedLinks(prev => ({
        ...prev,
        [opId]: data.test_url
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
    <main className="min-h-screen bg-[#F8F8F8] dark:bg-[#030C08] p-6 lg:p-10 flex flex-col text-[#242424] dark:text-zinc-200 font-sans">
      
      {/* Header */}
      <header className="mb-10">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#9A9A9A] dark:text-zinc-500 mb-2">
          Management · Welfare & Reallocation
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-[#242424] dark:text-zinc-100">
          Flagged Operator Monitoring
        </h1>
        <p className="text-sm text-[#5F5F5F] dark:text-zinc-400 mt-2 max-w-2xl leading-relaxed">
          Operators listed below have triggered a real-time productivity flag. Generate a secure cognitive assessment link to evaluate fatigue before executing a line reallocation.
        </p>
      </header>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Column: The Flagged List */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-2 mb-2">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#5F5F5F] dark:text-zinc-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#CE8E33]" />
              Requires Attention ({flaggedWorkers.length})
            </h2>
            <button 
              onClick={fetchFlaggedWorkers}
              className="text-[10px] font-mono text-[#9A9A9A] hover:text-[#242424] uppercase tracking-widest transition-colors"
            >
              Refresh List
            </button>
          </div>

          {loading ? (
            <div className="bg-white dark:bg-[#111113] border border-[#EAEAEA] dark:border-zinc-800 p-8 flex justify-center">
              <span className="text-xs text-[#9A9A9A] animate-pulse">Loading flagged operators...</span>
            </div>
          ) : flaggedWorkers.length === 0 ? (
            <div className="bg-white dark:bg-[#111113] border border-[#EAEAEA] dark:border-zinc-800 p-12 flex flex-col items-center text-center">
              <Check className="w-8 h-8 text-[#1A7C4B] mb-3" />
              <h3 className="font-bold text-sm">No Active Flags</h3>
              <p className="text-xs text-[#9A9A9A] mt-1">All operators are currently meeting their dynamic piece targets.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {flaggedWorkers.map((flag) => (
                <div key={flag.operator_id} className="bg-white dark:bg-[#111113] border border-[#EAEAEA] dark:border-zinc-800 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-[#CE8E33]/30">
                  
                  {/* Operator Info */}
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-bold text-lg">{flag.operators.name}</span>
                      <span className="text-[10px] font-mono bg-[#F8F8F8] dark:bg-zinc-800 px-2 py-0.5 text-[#5F5F5F] dark:text-zinc-400">
                        {flag.operators.worker_id}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-[#CE8E33] dark:text-[#D7A45A] flex items-center gap-1.5">
                      Flag Reason: {flag.flag_reason}
                    </p>
                    <p className="text-[10px] text-[#9A9A9A] mt-1">
                      Flagged at: {new Date(flag.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="shrink-0">
                    {!generatedLinks[flag.operator_id] ? (
                      <button
                        onClick={() => generateAssessmentLink(flag.operators.worker_id, flag.operators.name, flag.operator_id)}
                        disabled={generatingFor === flag.operator_id}
                        className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold uppercase tracking-wider bg-[#242424] hover:bg-black dark:bg-white dark:hover:bg-zinc-200 dark:text-black text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {generatingFor === flag.operator_id ? "Generating..." : "Generate Assessment"}
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input 
                          type="text" 
                          readOnly 
                          value={generatedLinks[flag.operator_id]} 
                          className="w-full sm:w-48 px-3 py-2 text-[10px] font-mono bg-[#F8F8F8] dark:bg-zinc-900 border border-[#EAEAEA] dark:border-zinc-800 text-[#9A9A9A] focus:outline-none"
                        />
                        <button
                          onClick={() => copyToClipboard(generatedLinks[flag.operator_id], flag.operator_id)}
                          className="p-2 bg-[#E6F1EC] dark:bg-[#0A321E] text-[#1A7C4B] dark:text-[#47966F] hover:opacity-80 transition-opacity"
                          title="Copy Link"
                        >
                          {copiedLink === flag.operator_id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
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
           <div className="bg-[#111113] text-white border border-zinc-800 p-6 flex flex-col h-full">
              <div className="w-8 h-8 bg-zinc-800 flex items-center justify-center mb-4">
                <Activity className="w-4 h-4 text-zinc-300" />
              </div>
              <h3 className="font-bold text-sm mb-2 uppercase tracking-widest text-zinc-400">Assessment Protocol</h3>
              <p className="text-xs text-zinc-400 leading-relaxed mb-6">
                When an operator's physical output drops below the AI target, they are flagged here. 
                Before running the reallocation algorithm to move them, send them a cognitive assessment to determine if the drop is due to mental fatigue or mechanical issues.
              </p>
              
              <div className="mt-auto space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full border border-zinc-700 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-mono">1</span>
                  </div>
                  <p className="text-[11px] text-zinc-500">Review the flagged operator list.</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full border border-zinc-700 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-mono">2</span>
                  </div>
                  <p className="text-[11px] text-zinc-500">Generate a secure JWT link.</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full border border-zinc-700 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-mono">3</span>
                  </div>
                  <p className="text-[11px] text-zinc-500">Send link to operator's mobile device. Data will feed directly into the HR dashboard.</p>
                </div>
              </div>
           </div>
        </div>

      </div>
    </main>
  );
}