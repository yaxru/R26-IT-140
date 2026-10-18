"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchPredictionHistory } from "../lib/api";
import type { PredictionHistoryItem } from "../lib/api";

function formatRunDate(value: string) {
  return new Date(value).toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function formatHours(value: number) { return `${value.toFixed(2)} h`; }

export default function PredictionHistoryPanel() {
  const [history, setHistory] = useState<PredictionHistoryItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try { setHistory(await fetchPredictionHistory(50)); setError(""); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Prediction history is unavailable."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, []);

  return (
    <main className="min-h-screen bg-[#F8F8F8] dark:bg-[#030C08] flex flex-col text-[#242424] dark:text-zinc-200">

      {/* ── Header ── */}
      <section className="bg-white dark:bg-[#111113] border-b border-[#EAEAEA] dark:border-zinc-800 px-6 lg:px-8 py-6 flex items-start justify-between gap-4 shrink-0">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-widest text-[#9A9A9A] dark:text-zinc-500 mb-1">
            Research / Stored Evidence
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#242424] dark:text-zinc-100">Prediction History</h1>
          <p className="text-xs text-[#5F5F5F] dark:text-zinc-400 mt-1.5 leading-relaxed">
            Review the input profile and model outcome for every saved production estimate.
          </p>
        </div>
        <div className="flex items-center gap-4 shrink-0 mt-1">
          <button type="button" onClick={() => void refresh()} disabled={loading}
            className="text-[10px] font-mono font-bold text-[#1A7C4B] dark:text-[#47966F] hover:underline disabled:opacity-40 uppercase tracking-widest">
            {loading ? "Refreshing…" : "Refresh history"}
          </button>
          <Link href="/production-time" className="text-[10px] font-mono text-[#9A9A9A] hover:text-[#242424] dark:hover:text-zinc-200 uppercase tracking-widest">
            ← Overview
          </Link>
        </div>
      </section>

      {/* ── Table ── */}
      <section className="flex-1 bg-white dark:bg-[#111113] flex flex-col">
        <div className="px-6 py-4 border-b border-[#EAEAEA] dark:border-zinc-800 bg-[#F8F8F8] dark:bg-zinc-900/40 flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#5F5F5F] dark:text-zinc-400">
            Supabase / prediction_runs · Stored batch estimates ordered newest to oldest
          </div>
          <span className="text-[10px] font-mono text-[#9A9A9A] dark:text-zinc-500">{history.length} RUNS LOADED</span>
        </div>

        {error ? (
          <div className="p-6 border border-[#CE8E33]/30 bg-[#FDFBF8] dark:bg-amber-950/20 mx-6 mt-6">
            <p className="text-xs font-bold text-[#A77329] dark:text-[#D7A45A] mb-1">History is not available yet.</p>
            <p className="text-xs font-mono text-[#9A9A9A]">{error}</p>
          </div>
        ) : loading && history.length === 0 ? (
          <div className="p-8 text-center text-xs font-mono text-[#9A9A9A] uppercase tracking-widest">Loading stored predictions…</div>
        ) : history.length === 0 ? (
          <div className="p-8 text-center text-xs font-mono text-[#9A9A9A] uppercase tracking-widest">No saved predictions yet. Run an estimate first.</div>
        ) : (
          <div className="overflow-x-auto flex-1 min-w-0">
            <table className="w-full text-sm border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-[#EAEAEA] dark:border-zinc-800">
                  {["Run time", "Batch", "Team", "Productivity", "Efficiency", "Delay outlook", "Base time", "Completion"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[9px] font-bold uppercase tracking-widest text-[#9A9A9A] dark:text-zinc-500 bg-[#F8F8F8] dark:bg-zinc-900/30">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAEAEA] dark:divide-zinc-800">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-[#F8F8F8] dark:hover:bg-zinc-900/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="text-xs font-bold text-[#242424] dark:text-zinc-100">{formatRunDate(item.created_at)}</p>
                      <p className="text-[10px] font-mono text-[#9A9A9A] dark:text-zinc-500 mt-0.5">{item.department}</p>
                    </td>
                    <td className="px-5 py-3.5 text-xs font-mono text-[#5F5F5F] dark:text-zinc-400">{item.batch_qty.toLocaleString()} units</td>
                    <td className="px-5 py-3.5 text-xs font-mono text-[#5F5F5F] dark:text-zinc-400">Team {item.team}</td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono font-bold text-sm text-[#242424] dark:text-zinc-100">
                        {(item.predicted_productivity * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 border ${
                        item.efficiency_level === "High"
                          ? "bg-[#E6F1EC] text-[#1A7C4B] border-[#1A7C4B]/20 dark:bg-[#0A321E] dark:text-[#47966F]"
                          : item.efficiency_level === "Medium"
                            ? "bg-[#FDFBF8] text-[#CE8E33] border-[#CE8E33]/20 dark:bg-amber-950/30 dark:text-[#D7A45A]"
                            : "bg-[#F1F1F1] text-[#5F5F5F] border-[#9A9A9A]/20 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}>
                        {item.efficiency_level}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-[#5F5F5F] dark:text-zinc-400">{item.delay_prediction}</td>
                    <td className="px-5 py-3.5 text-xs font-mono text-[#5F5F5F] dark:text-zinc-400">{formatHours(item.base_time_hours)}</td>
                    <td className="px-5 py-3.5 text-xs font-mono font-bold text-[#242424] dark:text-zinc-100">{formatHours(item.estimated_time_hours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
