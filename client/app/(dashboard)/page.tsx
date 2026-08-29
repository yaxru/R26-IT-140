"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getAuthHeaders } from "@/shared/auth";
import type { Bottleneck } from "@/app/(dashboard)/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Strict industrial scrollbar (No rounded corners)
const SCROLLBAR = "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#D4D4D4] dark:[&::-webkit-scrollbar-thumb]:bg-zinc-800 hover:[&::-webkit-scrollbar-thumb]:bg-[#C6C6C6] dark:hover:[&::-webkit-scrollbar-thumb]:bg-zinc-700 [&::-webkit-scrollbar-thumb]:rounded-none";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, digits = 0) {
  if (n == null) return "—";
  return (n * 100).toFixed(digits);
}

// ─── Core UI Components ───────────────────────────────────────────────────────

function KpiTile({ label, value, sub, accent }: { label: string; value: string | React.ReactNode; sub?: string; accent?: "green" | "amber" | "none" }) {
  const valueColor = accent === "green" ? "text-[#1A7C4B] dark:text-[#47966F]" : accent === "amber" ? "text-[#CE8E33] dark:text-[#D7A45A]" : "text-[#242424] dark:text-zinc-100";
  return (
    <div className="flex-1 border-r border-b xl:border-b-0 border-[#EAEAEA] dark:border-zinc-800 last:border-r-0 px-5 py-4 flex flex-col justify-center bg-white dark:bg-[#111113]">
      <p className="text-[10px] font-medium tracking-widest text-[#9A9A9A] dark:text-zinc-500 uppercase mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums leading-none tracking-tight ${valueColor}`}>{value}</p>
      {sub && <p className="text-[10px] text-[#9A9A9A] dark:text-zinc-600 mt-1.5 uppercase tracking-wide">{sub}</p>}
    </div>
  );
}

// ─── Industrial Pixel Bar Chart ───────────────────────────────────────────────
// Inspired by your reference image, adapted for sharp industrial UI.

function PixelBarChart({ data }: { data: { label: string; value: number; isWarning: boolean }[] }) {
  const BLOCKS_PER_COL = 10;
  
  return (
    <div className="flex items-end gap-1 h-full w-full pt-4 overflow-x-auto overflow-y-hidden">
      {data.map((d, i) => {
        // Calculate how many blocks to "light up" (0 to 10)
        const activeBlocks = Math.max(1, Math.ceil((d.value / 100) * BLOCKS_PER_COL));
        const blocks = Array.from({ length: BLOCKS_PER_COL });

        return (
          <div key={i} className="flex flex-col gap-[2px] flex-1 min-w-[12px] group relative">
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#242424] text-white text-[9px] font-mono px-2 py-1 pointer-events-none whitespace-nowrap z-10">
              {d.label}: {d.value.toFixed(1)}%
            </div>

            {/* Blocks (Rendered top to bottom, so we reverse index logic) */}
            {blocks.map((_, bIdx) => {
              const blockLevel = BLOCKS_PER_COL - bIdx;
              const isActive = blockLevel <= activeBlocks;
              
              let bgColor = "bg-[#F1F1F1] dark:bg-zinc-800/50"; // Inactive
              if (isActive) {
                bgColor = d.isWarning ? "bg-[#CE8E33]" : "bg-[#1A7C4B]";
              }

              return (
                <div 
                  key={bIdx} 
                  className={`w-full h-2.5 transition-colors duration-300 ${bgColor}`} 
                />
              );
            })}
            {/* Label */}
            <span className="text-[9px] text-[#9A9A9A] dark:text-zinc-600 font-mono text-center mt-1 truncate">
              {d.label.slice(-2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const supabase = createClient();
  const [stations, setStations] = useState<Bottleneck[]>([]);
  const [stationsError, setStationsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const headers = await getAuthHeaders(supabase);
        const res = await fetch(`${API_BASE}/stations`, { headers });
        if (!res.ok) throw new Error(`Failed to load stations (${res.status})`);
        setStations(await res.json());
      } catch (e) {
        setStationsError(e instanceof Error ? e.message : "Could not load stations data");
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  // Derived Metrics[cite: 5]
  const totalWip = stations.reduce((s, b) => s + b.wip, 0);
  const activeLines = stations.filter((b) => b.actual_productivity !== null && b.actual_productivity > 0).length;
  const bottleneckCount = stations.filter((b) => b.is_bottleneck).length;
  const validStations = stations.filter((b) => b.targeted_productivity !== null && b.actual_productivity !== null && b.targeted_productivity > 0);
  const avgEfficiency = validStations.length > 0
    ? validStations.reduce((sum, b) => sum + (b.actual_productivity! / b.targeted_productivity!) * 100, 0) / validStations.length
    : 0;

  // Generate Alert List from Stations[cite: 6]
  const criticalAlerts = stations.filter(s => s.is_bottleneck).map(s => ({
    id: s.station_id,
    title: `Critical Bottleneck`,
    desc: `${s.station_id} is operating below threshold. WIP: ${s.wip}`,
    type: "critical"
  }));

  const warningAlerts = stations.filter(s => !s.is_bottleneck && s.wip > 35).map(s => ({
    id: s.station_id,
    title: `High WIP Warning`,
    desc: `${s.station_id} queue reaching limits. WIP: ${s.wip}`,
    type: "warning"
  }));

  const allAlerts = [...criticalAlerts, ...warningAlerts];

  // Map stations to the Pixel Chart (Replace this with real historical data later)
  const chartData = stations.slice(0, 20).map(s => ({
    label: s.station_id,
    value: s.actual_productivity ? s.actual_productivity * 100 : 0,
    isWarning: s.is_bottleneck
  }));

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#F8F8F8] dark:bg-[#030C08]">
      {/* ── Top Header ──────────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-[#EAEAEA] dark:border-zinc-800 px-6 py-4 flex items-center justify-between bg-white dark:bg-[#111113]">
        <div>
          <p className="text-[10px] font-medium tracking-widest text-[#9A9A9A] dark:text-zinc-500 uppercase mb-0.5">Live Operations</p>
          <h1 className="text-xl font-bold text-[#242424] dark:text-zinc-100 tracking-tight">Factory Floor Overview</h1>
        </div>
        <Link
          href="/worker-reallocation"
          className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-4 py-2 border uppercase tracking-wider transition-colors ${
            bottleneckCount > 0
              ? "text-white bg-[#CE8E33] border-[#CE8E33] hover:bg-[#B97A29]"
              : "text-white bg-[#1A7C4B] border-[#1A7C4B] hover:bg-[#15633C]"
          }`}
        >
          {bottleneckCount > 0 ? `Resolve ${bottleneckCount} Bottlenecks ➔` : "System Optimal ➔"}
        </Link>
      </header>

      {stationsError && (
        <div className="shrink-0 px-6 py-2 bg-[#F8F8F8] dark:bg-[#0a0a0c]">
          <div className="flex items-center gap-2 border-l-2 border-[#CE8E33] bg-[#FDFBF8] dark:bg-amber-950/10 px-3 py-2 text-xs text-[#A77329] dark:text-[#E1BA82]">
            <span aria-hidden="true">⚠</span> {stationsError}
          </div>
        </div>
      )}

      {/* ── Main Bento Grid ─────────────────────────────────────────── */}
      <main className={`flex-1 overflow-y-auto ${SCROLLBAR}`}>
        <div className="grid grid-cols-12 min-h-full">
          
          {/* LEFT COLUMN: Data & Charts (8 Cols) */}
          <div className="col-span-12 xl:col-span-8 flex flex-col border-r border-[#EAEAEA] dark:border-zinc-800 bg-[#FAFAFA] dark:bg-[#0a0a0c]">
            
            {/* KPIs */}
            <div className="grid grid-cols-2 xl:grid-cols-4 border-b border-[#EAEAEA] dark:border-zinc-800 shrink-0">
              <KpiTile label="Total WIP Queue" value={<>{totalWip.toLocaleString()}<span className="text-base text-[#9A9A9A] ml-1">u</span></>} sub="Across Active Lines" />
              <KpiTile label="Active Lines" value={`${activeLines} / ${stations.length}`} sub="Currently Operating" />
              <KpiTile label="Global Efficiency" value={`${avgEfficiency.toFixed(1)}%`} accent={avgEfficiency >= 90 ? "green" : avgEfficiency >= 75 ? "none" : "amber"} sub="Vs 100% Target" />
              <KpiTile label="Active Bottlenecks" value={bottleneckCount.toString()} accent={bottleneckCount > 0 ? "amber" : "green"} sub={bottleneckCount > 0 ? "Requires Action" : "Flow Optimal"} />
            </div>

            {/* Performance Pixel Chart */}
            <div className="flex-1 min-h-[300px] flex flex-col bg-white dark:bg-[#111113] border-b xl:border-b-0 border-[#EAEAEA] dark:border-zinc-800 p-6">
              <div className="flex justify-between items-end mb-4 shrink-0">
                <div>
                  <p className="text-[10px] font-medium tracking-widest text-[#9A9A9A] uppercase mb-1">Production Execution</p>
                  <h3 className="text-sm font-bold text-[#242424] dark:text-zinc-100">Live Station Output Metrics</h3>
                </div>
                <div className="flex gap-4">
                  <span className="flex items-center gap-1.5 text-[10px] text-[#5F5F5F] dark:text-zinc-400 font-mono"><span className="w-2.5 h-2.5 bg-[#1A7C4B]"/> Optimal</span>
                  <span className="flex items-center gap-1.5 text-[10px] text-[#5F5F5F] dark:text-zinc-400 font-mono"><span className="w-2.5 h-2.5 bg-[#CE8E33]"/> Bottleneck</span>
                </div>
              </div>
              
              <div className="flex-1 min-h-0 border border-[#EAEAEA] dark:border-zinc-800/60 p-4 bg-[#FAFAFA] dark:bg-[#0a0a0c]">
                {loading ? (
                  <div className="w-full h-full flex items-center justify-center text-xs text-[#9A9A9A]">Loading matrix...</div>
                ) : (
                  <PixelBarChart data={chartData} />
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Alerts & Quick Table (4 Cols) */}
          <div className="col-span-12 xl:col-span-4 flex flex-col bg-white dark:bg-[#111113]">
            
            {/* System Log / Alerts */}
            <div className="shrink-0 h-[320px] flex flex-col border-b border-[#EAEAEA] dark:border-zinc-800">
              <div className="px-5 py-4 border-b border-[#EAEAEA] dark:border-zinc-800 flex justify-between items-center bg-[#FAFAFA] dark:bg-[#0a0a0c]">
                <p className="text-[10px] font-bold tracking-widest text-[#9A9A9A] dark:text-zinc-500 uppercase">Alert Center</p>
                <span className="text-[10px] font-mono bg-[#EAEAEA] dark:bg-zinc-800 px-2 py-0.5 text-[#5F5F5F] dark:text-zinc-400">{allAlerts.length} Events</span>
              </div>
              
              <div className={`flex-1 overflow-y-auto p-4 space-y-3 ${SCROLLBAR}`}>
                {allAlerts.length === 0 ? (
                  <p className="text-xs text-center text-[#9A9A9A] mt-10">No active alerts.</p>
                ) : (
                  allAlerts.map(alert => (
                    <div key={alert.id} className={`p-3 border text-[11px] ${alert.type === "critical" ? "bg-[#FDFBF8] dark:bg-[#1A1510] border-[#EACFA9] dark:border-amber-900/40" : "bg-white dark:bg-[#111113] border-[#EAEAEA] dark:border-zinc-800"}`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`w-1.5 h-1.5 ${alert.type === "critical" ? "bg-[#CE8E33] animate-pulse" : "bg-[#D7A45A]"}`} />
                        <span className={`font-bold uppercase tracking-wider ${alert.type === "critical" ? "text-[#A77329] dark:text-[#E1BA82]" : "text-[#5F5F5F] dark:text-zinc-300"}`}>{alert.title}</span>
                      </div>
                      <p className="text-[#5F5F5F] dark:text-zinc-400 font-mono leading-relaxed pl-3.5">{alert.desc}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Compressed Station Table */}
            <div className="flex-1 flex flex-col min-h-[300px]">
              <div className="px-5 py-4 border-b border-[#EAEAEA] dark:border-zinc-800 bg-[#FAFAFA] dark:bg-[#0a0a0c]">
                <p className="text-[10px] font-bold tracking-widest text-[#9A9A9A] dark:text-zinc-500 uppercase">Live Queue Breakdown</p>
              </div>
              
              <div className={`flex-1 overflow-y-auto ${SCROLLBAR}`}>
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-white dark:bg-[#111113] sticky top-0 border-b border-[#EAEAEA] dark:border-zinc-800">
                    <tr>
                      <th className="px-4 py-2.5 font-medium text-[#9A9A9A] uppercase tracking-wider">Station</th>
                      <th className="px-4 py-2.5 font-medium text-[#9A9A9A] uppercase tracking-wider">WIP</th>
                      <th className="px-4 py-2.5 font-medium text-[#9A9A9A] uppercase tracking-wider text-right">Actual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F1F1] dark:divide-zinc-800/40">
                    {loading ? (
                       <tr><td colSpan={3} className="p-4 text-center text-[#9A9A9A]">Loading...</td></tr>
                    ) : (
                      stations.map(s => (
                        <tr key={s.station_id} className={`hover:bg-[#F8F8F8] dark:hover:bg-zinc-800/30 ${s.is_bottleneck ? "bg-[#FDFBF8] dark:bg-amber-950/10" : "bg-white dark:bg-[#111113]"}`}>
                          <td className="px-4 py-2.5 font-bold text-[#333333] dark:text-zinc-200">{s.station_id}</td>
                          <td className={`px-4 py-2.5 font-mono ${s.is_bottleneck ? "text-[#CE8E33]" : "text-[#5F5F5F] dark:text-zinc-400"}`}>{s.wip} units</td>
                          <td className="px-4 py-2.5 font-mono text-right font-semibold text-[#1A7C4B] dark:text-[#47966F]">{fmt(s.actual_productivity)}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="shrink-0 px-6 py-2 bg-white dark:bg-[#111113] border-t border-[#EAEAEA] dark:border-zinc-800">
        <p className="text-[10px] text-[#9A9A9A] uppercase tracking-widest">StitchFlow · Operations Overview v2.0</p>
      </footer>
    </div>
  );
}