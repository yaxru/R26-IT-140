"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchPredictionHistory, checkHealth } from "./lib/api";
import type { PredictionHistoryItem } from "./lib/api";

function formatRunDate(value: string) {
  return new Date(value).toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function ProductionTimePage() {
  const [history, setHistory] = useState<PredictionHistoryItem[]>([]);
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");

  useEffect(() => {
    fetchPredictionHistory(5).then(setHistory).catch(() => setHistory([]));
    checkHealth().then(() => setApiStatus("online")).catch(() => setApiStatus("offline"));
  }, []);

  const latest = history[0];

  return (
    <main className="min-h-screen bg-[#F8F8F8] dark:bg-[#030C08] flex flex-col text-[#242424] dark:text-zinc-200">

      {/* ── Header strip ── */}
      <section className="border-b border-[#EAEAEA] dark:border-zinc-800 bg-white dark:bg-[#111113] flex flex-col lg:flex-row shrink-0">
        <div className="lg:w-1/2 p-6 lg:p-8 border-b lg:border-b-0 lg:border-r border-[#EAEAEA] dark:border-zinc-800 flex flex-col justify-center">
          
          <h1 className="text-xl font-bold tracking-tight text-[#242424] dark:text-zinc-100">
            Production Time Prediction
          </h1>
          <p className="text-xs text-[#5F5F5F] dark:text-zinc-400 mt-2 max-w-sm leading-relaxed">
            A concise view of the latest model signal, stored evidence and next supervisor action.
          </p>
        </div>

        {/* KPI strip */}
        <div className="lg:w-1/2 grid grid-cols-3">
          <div className="border-r border-[#EAEAEA] dark:border-zinc-800 flex flex-col justify-center px-6 py-5">
            <p className="text-[10px] uppercase tracking-widest text-[#9A9A9A] dark:text-zinc-500 mb-1">Model</p>
            <p className="font-mono text-2xl font-bold text-[#242424] dark:text-zinc-100">RF / 500</p>
            <p className="text-[11px] text-[#9A9A9A] dark:text-zinc-600 mt-0.5">trained trees</p>
          </div>
          <div className="border-r border-[#EAEAEA] dark:border-zinc-800 flex flex-col justify-center px-6 py-5">
            <p className="text-[10px] uppercase tracking-widest text-[#9A9A9A] dark:text-zinc-500 mb-1">Input signals</p>
            <p className="font-mono text-2xl font-bold text-[#242424] dark:text-zinc-100">08</p>
            <p className="text-[11px] text-[#9A9A9A] dark:text-zinc-600 mt-0.5">batch fields</p>
          </div>
          <div className="flex flex-col justify-center px-6 py-5">
            <p className="text-[10px] uppercase tracking-widest text-[#9A9A9A] dark:text-zinc-500 mb-1">API status</p>
            <p className={`font-mono text-2xl font-bold ${apiStatus === "online" ? "text-[#1A7C4B] dark:text-[#47966F]" : apiStatus === "offline" ? "text-[#CE8E33]" : "text-[#9A9A9A]"}`}>
              {apiStatus === "checking" ? "···" : apiStatus === "online" ? "Live" : "Offline"}
            </p>
            <p className="text-[11px] text-[#9A9A9A] dark:text-zinc-600 mt-0.5">
              {apiStatus === "checking" ? "Checking…" : apiStatus === "online" ? "Port 8002 connected" : "Port 8002 unreachable"}
            </p>
          </div>
        </div>
      </section>

      {/* ── Navigation card grid ── */}
      <section className="border-b border-[#EAEAEA] dark:border-zinc-800 bg-white dark:bg-[#111113]">
        <div className="px-6 py-4 border-b border-[#EAEAEA] dark:border-zinc-800 bg-[#F8F8F8] dark:bg-zinc-900/40 flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#5F5F5F] dark:text-zinc-400">Workspace</div>
          <Link href="/production-time/prediction-history" className="text-[10px] font-mono text-[#9A9A9A] hover:text-[#1A7C4B] dark:text-zinc-500 dark:hover:text-[#47966F] transition-colors uppercase tracking-widest">
            View all history →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#EAEAEA] dark:divide-zinc-800">
          {/* Card 1 - Run Estimate */}
          <Link href="/production-time/batch-estimate" className="group p-6 lg:p-8 flex flex-col gap-4 hover:bg-[#F8F8F8] dark:hover:bg-zinc-900/30 transition-colors">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#9A9A9A] dark:text-zinc-500">01 - Action</div>
            <h2 className="text-base font-bold text-[#242424] dark:text-zinc-100 group-hover:text-[#1A7C4B] dark:group-hover:text-[#47966F] transition-colors">
              Run Batch Estimate
            </h2>
            <p className="text-xs text-[#5F5F5F] dark:text-zinc-400 leading-relaxed flex-1">
              Capture the current line conditions - department, team, workers, SMV, overtime - and send a single request to the trained model. Instantly get productivity score, efficiency level, and delay outlook.
            </p>
            <div className="flex items-center gap-2 text-[11px] font-bold text-[#1A7C4B] dark:text-[#47966F] mt-2">
              Open batch estimate <span aria-hidden>↗</span>
            </div>
          </Link>

          {/* Card 2 - History */}
          <Link href="/production-time/prediction-history" className="group p-6 lg:p-8 flex flex-col gap-4 hover:bg-[#F8F8F8] dark:hover:bg-zinc-900/30 transition-colors">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#9A9A9A] dark:text-zinc-500">02 - Evidence</div>
            <h2 className="text-base font-bold text-[#242424] dark:text-zinc-100 group-hover:text-[#1A7C4B] dark:group-hover:text-[#47966F] transition-colors">
              Prediction History
            </h2>
            <p className="text-xs text-[#5F5F5F] dark:text-zinc-400 leading-relaxed flex-1">
              Review the input profile and model outcome for every saved production estimate. Stored runs from the Supabase <span className="font-mono text-[10px]">prediction_runs</span> table, ordered newest to oldest.
            </p>
            <div className="flex items-center gap-2 text-[11px] font-bold text-[#1A7C4B] dark:text-[#47966F] mt-2">
              {history.length} runs stored →
            </div>
          </Link>

          {/* Card 3 - Model Notes */}
          <Link href="/production-time/model-notes" className="group p-6 lg:p-8 flex flex-col gap-4 hover:bg-[#F8F8F8] dark:hover:bg-zinc-900/30 transition-colors">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#9A9A9A] dark:text-zinc-500">03 - Reference</div>
            <h2 className="text-base font-bold text-[#242424] dark:text-zinc-100 group-hover:text-[#1A7C4B] dark:group-hover:text-[#47966F] transition-colors">
              Model Notes
            </h2>
            <p className="text-xs text-[#5F5F5F] dark:text-zinc-400 leading-relaxed flex-1">
              A clear reference for the model inputs, outputs and the decision boundary. Understand how the Random Forest pipeline estimates productivity and derives completion time.
            </p>
            <div className="flex items-center gap-2 text-[11px] font-bold text-[#1A7C4B] dark:text-[#47966F] mt-2">
              Read model notes →
            </div>
          </Link>
        </div>
      </section>

      {/* ── Latest signal + Recent runs ── */}
      <section className="flex-1 flex flex-col lg:flex-row bg-white dark:bg-[#111113]">

        {/* Left - Current signal */}
        <div className="lg:w-2/5 border-b lg:border-b-0 lg:border-r border-[#EAEAEA] dark:border-zinc-800 flex flex-col">
          <div className="px-6 py-4 border-b border-[#EAEAEA] dark:border-zinc-800 bg-[#F8F8F8] dark:bg-zinc-900/40">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#5F5F5F] dark:text-zinc-400">Supervisor Summary · Current Signal</div>
          </div>
          {latest ? (
            <div className="p-6 lg:p-8 flex flex-col gap-6 flex-1">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#9A9A9A] dark:text-zinc-500 mb-1">Latest floor signal is ready for review</p>
                <p className="text-sm text-[#5F5F5F] dark:text-zinc-400">
                  Team {latest.team} / {latest.department} returned a <strong className="text-[#242424] dark:text-zinc-200">{latest.efficiency_level.toLowerCase()} efficiency</strong> signal with <strong className="text-[#242424] dark:text-zinc-200">{latest.delay_prediction.toLowerCase()}</strong>.
                </p>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#9A9A9A] dark:text-zinc-500 mb-2">Predicted Productivity</p>
                <p className="font-mono text-4xl font-bold text-[#242424] dark:text-zinc-100 leading-none">
                  {(latest.predicted_productivity * 100).toFixed(1)}<span className="text-xl font-normal text-[#9A9A9A] ml-1">%</span>
                </p>
                <div className="mt-3 h-1.5 bg-[#EAEAEA] dark:bg-zinc-800">
                  <div className="h-1.5 bg-[#1A7C4B]" style={{ width: `${Math.min(latest.predicted_productivity * 100, 100)}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-[#EAEAEA] dark:border-zinc-800 pt-4">
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-[#9A9A9A] dark:text-zinc-500">Delay outlook</p>
                  <p className="font-bold text-sm text-[#242424] dark:text-zinc-100 mt-0.5">{latest.delay_prediction}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-[#9A9A9A] dark:text-zinc-500">Estimated completion</p>
                  <p className="font-mono font-bold text-sm text-[#242424] dark:text-zinc-100 mt-0.5">{latest.estimated_time_hours.toFixed(2)} h</p>
                </div>
              </div>

              <Link href="/production-time/prediction-history" className="text-[11px] font-bold text-[#1A7C4B] dark:text-[#47966F] hover:underline">
                Review stored history →
              </Link>
            </div>
          ) : (
            <div className="p-6 lg:p-8 flex flex-col items-start gap-4 flex-1">
              <p className="text-[10px] uppercase tracking-widest text-[#9A9A9A] dark:text-zinc-500">Start with the first floor signal</p>
              <p className="text-sm text-[#5F5F5F] dark:text-zinc-400 leading-relaxed">
                Run a batch estimate to see productivity, delay outlook and expected completion time.
              </p>
              <Link href="/production-time/batch-estimate" className="text-[11px] font-bold text-[#1A7C4B] dark:text-[#47966F] hover:underline">
                Open batch estimate ↗
              </Link>
            </div>
          )}
        </div>

        {/* Right - Recent runs */}
        <div className="lg:w-3/5 flex flex-col">
          <div className="px-6 py-4 border-b border-[#EAEAEA] dark:border-zinc-800 bg-[#F8F8F8] dark:bg-zinc-900/40 flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#5F5F5F] dark:text-zinc-400">Recent Activity · Latest Model Runs</div>
            <span className="text-[10px] font-mono text-[#9A9A9A] dark:text-zinc-500">{history.length} LOADED</span>
          </div>
          {history.length === 0 ? (
            <div className="p-8 text-center text-xs font-mono text-[#9A9A9A] dark:text-zinc-600 uppercase tracking-widest">
              No prediction history available yet.
            </div>
          ) : (
            <div className="divide-y divide-[#EAEAEA] dark:divide-zinc-800">
              {history.map((item) => (
                <Link key={item.id} href="/production-time/prediction-history" className="flex items-center justify-between px-6 py-4 hover:bg-[#F8F8F8] dark:hover:bg-zinc-900/30 transition-colors gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-[10px] text-[#9A9A9A] dark:text-zinc-500 shrink-0">#{item.id}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#242424] dark:text-zinc-100 truncate">{item.department} / Team {item.team}</p>
                      <p className="text-[10px] text-[#9A9A9A] dark:text-zinc-500 font-mono">{formatRunDate(item.created_at)} · {item.batch_qty.toLocaleString()} units</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="font-mono font-bold text-sm text-[#242424] dark:text-zinc-100">{(item.predicted_productivity * 100).toFixed(1)}%</span>
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 border ${
                      item.efficiency_level === "High" 
                        ? "bg-[#E6F1EC] text-[#1A7C4B] border-[#1A7C4B]/20 dark:bg-[#0A321E] dark:text-[#47966F]" 
                        : "bg-[#FDFBF8] text-[#CE8E33] border-[#CE8E33]/20 dark:bg-amber-950/30 dark:text-[#D7A45A]"
                    }`}>
                      {item.efficiency_level}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

      </section>
    </main>
  );
}
