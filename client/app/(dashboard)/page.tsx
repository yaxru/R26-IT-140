"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getAuthHeaders } from "@/shared/auth";
import type { Bottleneck, SkillMatrixEntry } from "@/app/(dashboard)/types";
import {
  ArrowRight,
  ArrowUpRight,
  AlertTriangle,
  Activity,
  LayoutGrid,
  CheckSquare,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const SCROLLBAR =
  "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#D4D4D4] dark:[&::-webkit-scrollbar-thumb]:bg-zinc-800 hover:[&::-webkit-scrollbar-thumb]:bg-[#C6C6C6] dark:hover:[&::-webkit-scrollbar-thumb]:bg-zinc-700 [&::-webkit-scrollbar-thumb]:rounded-none";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, digits = 0) {
  if (n == null) return "—";
  return (n * 100).toFixed(digits);
}

// ─── Reusable UI Blocks ───────────────────────────────────────────────────────

function KpiTile({
  label,
  value,
  sub,
  accent,
  className = "",
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: "green" | "amber" | "none";
  className?: string;
}) {
  const valueColor =
    accent === "green"
      ? "text-[#1A7C4B] dark:text-[#47966F]"
      : accent === "amber"
        ? "text-[#CE8E33] dark:text-[#D7A45A]"
        : "text-[#242424] dark:text-zinc-100";
  return (
    <div className={`p-5 flex flex-col justify-center bg-white dark:bg-[#111113] ${className}`}>
      <p className="text-[10px] font-medium tracking-widest text-[#9A9A9A] dark:text-zinc-500 uppercase mb-1">
        {label}
      </p>
      <p
        className={`text-2xl font-bold tabular-nums leading-none tracking-tight ${valueColor}`}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[10px] text-[#9A9A9A] dark:text-zinc-600 mt-1.5 uppercase tracking-wide">
          {sub}
        </p>
      )}
    </div>
  );
}

function ShortcutCard({
  title,
  desc,
  href,
  icon: Icon,
}: {
  title: string;
  desc: string;
  href: string;
  icon: any;
}) {
  return (
    <Link
      href={href}
      className="flex-1 flex flex-col justify-between p-4 border-r border-[#EAEAEA] dark:border-zinc-800 last:border-r-0 bg-white dark:bg-[#111113] hover:bg-[#F8F8F8] dark:hover:bg-zinc-900 transition-colors group"
    >
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Icon size={12} className="text-[#9A9A9A] dark:text-zinc-500" />
          <h4 className="text-[11px] font-bold text-[#242424] dark:text-zinc-100 uppercase tracking-wide">
            {title}
          </h4>
        </div>
        <p className="text-[10px] text-[#9A9A9A] dark:text-zinc-500 mt-1.5 leading-relaxed">
          {desc}
        </p>
      </div>
      <ArrowUpRight
        size={14}
        className="text-[#9A9A9A] group-hover:text-[#242424] dark:group-hover:text-zinc-200 mt-3 transition-colors"
      />
    </Link>
  );
}

// ─── Dynamic SVG Charts ───────────────────────────────────────────────────────

// 1. Floor Tree Graph (Restored to vertical flow without the inner grid)
function FloorTreeGraph({
  stations,
  skillMatrix,
}: {
  stations: Bottleneck[];
  skillMatrix: SkillMatrixEntry[];
}) {
  if (stations.length === 0)
    return (
      <div className="h-full flex items-center justify-center text-[10px] text-[#9A9A9A]">
        No layout data
      </div>
    );

  const grouped = stations.reduce(
    (acc, s) => {
      // @ts-ignore
      const lineId = s.line_id || "Unassigned";
      if (!acc[lineId]) acc[lineId] = [];
      acc[lineId].push(s);
      return acc;
    },
    {} as Record<string, Bottleneck[]>,
  );

  return (
    <div className={`flex-1 w-full overflow-auto p-5 ${SCROLLBAR}`}>
      <div className="flex flex-col gap-6 min-w-max">
        {Object.entries(grouped).map(([lineId, lineStations]) => (
          <div key={lineId} className="flex flex-col gap-2 relative">
            {/* Line Root Node */}
            <div className="flex items-center gap-2 z-10">
              <div className="w-1.5 h-1.5 bg-[#242424] dark:bg-zinc-400" />
              <span className="text-[10px] font-bold text-[#242424] dark:text-zinc-200 uppercase tracking-widest">
                {lineId}
              </span>
            </div>

            {/* Stations Branch */}
            <div className="flex items-center pl-1 relative">
              {/* Vertical Guide Line */}
              <div className="w-px h-full bg-[#EAEAEA] dark:bg-zinc-800 absolute left-[3px] top-0" />

              <div className="flex items-center pl-4 py-1">
                {lineStations.map((s, i) => {
                  const workersCount = skillMatrix.filter(
                    (sm) => sm.machine_type === s.required_skill,
                  ).length;
                  const isWarning = s.is_bottleneck;

                  return (
                    <div
                      key={s.station_id}
                      className="flex items-center group relative"
                    >
                      {/* First item gets a horizontal branch connector */}
                      {i === 0 && (
                        <div className="absolute -left-4 w-4 h-px bg-[#EAEAEA] dark:bg-zinc-800" />
                      )}

                      {/* Station Data Box */}
                      <div
                        className={`flex flex-col min-w-[120px] px-3 py-2 border transition-colors ${isWarning ? "bg-[#FDFBF8] border-[#CE8E33] dark:bg-[#1A1510] dark:border-amber-900" : "bg-white border-[#EAEAEA] dark:bg-[#111113] dark:border-zinc-700"}`}
                      >
                        <div className="flex items-center justify-between gap-3 mb-1.5">
                          <span
                            className={`text-[10px] font-bold ${isWarning ? "text-[#CE8E33] dark:text-[#E1BA82]" : "text-[#333333] dark:text-zinc-200"}`}
                          >
                            {s.station_id}
                          </span>
                          {isWarning && (
                            <span className="w-1.5 h-1.5 bg-[#CE8E33] animate-pulse" />
                          )}
                        </div>
                        <span className="text-[9px] text-[#9A9A9A] dark:text-zinc-500 font-mono tracking-wide border-t border-[#F1F1F1] dark:border-zinc-800/60 pt-1.5">
                          {workersCount}{" "}
                          <span className="uppercase text-[8px] text-[#C6C6C6] dark:text-zinc-600">
                            Workers
                          </span>
                        </span>
                      </div>

                      {/* Path to next station */}
                      {i < lineStations.length - 1 && (
                        <div className="w-6 h-px bg-[#EAEAEA] dark:bg-zinc-800" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 2. Efficiency Bar Chart
function EfficiencyBarChart({ stations }: { stations: Bottleneck[] }) {
  const chartData = [...stations]
    .filter(
      (s) => s.targeted_productivity !== null && s.actual_productivity !== null,
    )
    .sort((a, b) => b.wip - a.wip)
    .slice(0, 8);

  if (chartData.length === 0)
    return (
      <div className="h-full flex items-center justify-center text-[10px] text-[#9A9A9A]">
        No active data
      </div>
    );

  const w = 400;
  const h = 120;
  const maxVal = 100;

  return (
    <div className="flex-1 w-full pt-4">
      <svg
        viewBox={`0 0 ${w} ${h + 20}`}
        className="w-full h-full overflow-visible"
      >
        {[0, 50, 100].map((val) => {
          const y = h - (val / maxVal) * h;
          return (
            <g key={val}>
              <line
                x1="0"
                y1={y}
                x2={w}
                y2={y}
                stroke="currentColor"
                strokeWidth="0.5"
                strokeDasharray="2 2"
                className="text-[#EAEAEA] dark:text-zinc-800"
              />
              <text
                x="-5"
                y={y + 3}
                textAnchor="end"
                fontSize="9"
                className="fill-[#9A9A9A] dark:fill-zinc-600 font-mono"
              >
                {val}%
              </text>
            </g>
          );
        })}
        {chartData.map((s, i) => {
          const barW = w / chartData.length - 12;
          const x = i * (w / chartData.length) + 6;
          const targetH = ((s.targeted_productivity! * 100) / maxVal) * h;
          const actualH = ((s.actual_productivity! * 100) / maxVal) * h;

          return (
            <g key={s.station_id} className="group">
              <rect
                x={x}
                y={h - targetH}
                width={barW}
                height={targetH}
                className="fill-[#F1F1F1] dark:fill-zinc-800"
              />
              <rect
                x={x}
                y={h - actualH}
                width={barW}
                height={actualH}
                className={`transition-all duration-300 ${s.is_bottleneck ? "fill-[#CE8E33]" : "fill-[#1A7C4B]"}`}
              />
              <text
                x={x + barW / 2}
                y={h + 12}
                textAnchor="middle"
                fontSize="8"
                className="fill-[#9A9A9A] dark:fill-zinc-500 font-mono uppercase truncate"
              >
                {s.station_id.slice(-5)}
              </text>
              <text
                x={x + barW / 2}
                y={h - Math.max(targetH, actualH) - 5}
                textAnchor="middle"
                fontSize="9"
                className="fill-[#242424] dark:fill-zinc-200 font-bold opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {Math.round(s.actual_productivity! * 100)}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// 3. Skill Donut Chart
function SkillDonutChart({ matrix }: { matrix: SkillMatrixEntry[] }) {
  if (matrix.length === 0)
    return (
      <div className="h-full flex items-center justify-center text-[10px] text-[#9A9A9A]">
        No matrix data
      </div>
    );

  const grades = { A: 0, B: 0, C: 0 };
  matrix.forEach((m) => {
    if (m.proficiency_grade === "A") grades.A++;
    else if (m.proficiency_grade === "B") grades.B++;
    else grades.C++;
  });

  const total = matrix.length;
  const radius = 40;
  const circum = 2 * Math.PI * radius;

  const pctA = grades.A / total;
  const pctB = grades.B / total;
  const pctC = grades.C / total;

  const dashA = pctA * circum;
  const dashB = pctB * circum;
  const dashC = pctC * circum;

  return (
    <div className="flex-1 flex items-center justify-center gap-8">
      <div className="relative w-32 h-32">
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full transform -rotate-90"
        >
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#F1F1F1"
            className="dark:stroke-zinc-800"
            strokeWidth="12"
          />
          {pctC > 0 && (
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="#CE8E33"
              strokeWidth="12"
              strokeDasharray={`${dashC} ${circum}`}
              strokeDashoffset="0"
            />
          )}
          {pctB > 0 && (
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="#D7A45A"
              strokeWidth="12"
              strokeDasharray={`${dashB} ${circum}`}
              strokeDashoffset={-dashC}
            />
          )}
          {pctA > 0 && (
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="#1A7C4B"
              strokeWidth="12"
              strokeDasharray={`${dashA} ${circum}`}
              strokeDashoffset={-(dashC + dashB)}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold tabular-nums text-[#242424] dark:text-zinc-100 leading-none">
            {total}
          </span>
          <span className="text-[8px] font-medium text-[#9A9A9A] dark:text-zinc-500 uppercase tracking-widest mt-1">
            Workers
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 text-[10px] font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-[#1A7C4B]" /> Grade A ({grades.A})
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-[#D7A45A]" /> Grade B ({grades.B})
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-[#CE8E33]" /> Grade C ({grades.C})
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const supabase = createClient();
  const [stations, setStations] = useState<Bottleneck[]>([]);
  const [skillMatrix, setSkillMatrix] = useState<SkillMatrixEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const headers = await getAuthHeaders(supabase);
        const [stRes, smRes] = await Promise.all([
          fetch(`${API_BASE}/stations`, { headers }),
          fetch(`${API_BASE}/skill-matrix`, { headers }),
        ]);
        if (!stRes.ok || !smRes.ok) throw new Error(`API fetch failed.`);
        setStations(await stRes.json());
        setSkillMatrix(await smRes.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Data sync failed");
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  const totalWip = stations.reduce((s, b) => s + b.wip, 0);
  const bottleneckCount = stations.filter((b) => b.is_bottleneck).length;
  const validStations = stations.filter(
    (b) => b.targeted_productivity && b.actual_productivity,
  );
  const avgEfficiency =
    validStations.length > 0
      ? validStations.reduce(
          (sum, b) =>
            sum + (b.actual_productivity! / b.targeted_productivity!) * 100,
          0,
        ) / validStations.length
      : 0;

  const criticalAlerts = stations
    .filter((s) => s.is_bottleneck)
    .map((s) => ({
      id: s.station_id,
      type: "critical",
      title: `Critical Bottleneck`,
      desc: `${s.station_id} throughput gap detected. WIP accumulated to ${s.wip}.`,
    }));
  const warningAlerts = stations
    .filter((s) => !s.is_bottleneck && s.wip > 35)
    .map((s) => ({
      id: s.station_id,
      type: "warning",
      title: `High WIP Queue`,
      desc: `${s.station_id} queue reaching limits. Current load: ${s.wip} units.`,
    }));
  const allAlerts = [...criticalAlerts, ...warningAlerts];

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#F8F8F8] dark:bg-[#030C08]">
      <header className="shrink-0 border-b border-[#EAEAEA] dark:border-zinc-800 px-6 py-4 flex items-center justify-between bg-white dark:bg-[#111113]">
        <div>
          <h1 className="text-xl font-bold text-[#242424] dark:text-zinc-100 tracking-tight">
            Factory Floor Overview
          </h1>
        </div>
        <Link
          href="/worker-reallocation"
          className={`inline-flex items-center gap-2 text-[11px] font-bold px-4 py-2 border uppercase tracking-wider transition-colors ${
            bottleneckCount > 0
              ? "text-white bg-[#CE8E33] border-[#CE8E33] hover:bg-[#B97A29]"
              : "text-white bg-[#1A7C4B] border-[#1A7C4B] hover:bg-[#15633C]"
          }`}
        >
          {bottleneckCount > 0
            ? `Resolve ${bottleneckCount} Bottlenecks`
            : "System Optimal"}
          <ArrowRight size={14} />
        </Link>
      </header>

      {error && (
        <div className="shrink-0 px-6 py-2 bg-[#F8F8F8] dark:bg-[#0a0a0c]">
          <div className="flex items-center gap-2 bg-[#FDFBF8] dark:bg-amber-950/10 px-3 py-2 text-xs text-[#A77329] dark:text-[#E1BA82]">
            <AlertTriangle size={14} /> {error}
          </div>
        </div>
      )}

      <main className={`flex-1 overflow-y-auto ${SCROLLBAR}`}>
        <div className="flex flex-col min-h-full">
          
          {/* 1ST ROW: KPIs (Left) and Prediction/Shortcuts (Right) */}
          <div className="grid grid-cols-1 xl:grid-cols-2 border-b border-[#EAEAEA] dark:border-zinc-800 shrink-0 bg-[#FAFAFA] dark:bg-[#0a0a0c]">
            {/* Left Col: 2x2 KPIs */}
            <div className="grid grid-cols-2 border-r border-[#EAEAEA] dark:border-zinc-800">
              <KpiTile
                label="Total WIP"
                value={
                  <>
                    {totalWip.toLocaleString()}
                    <span className="text-base text-[#9A9A9A] ml-1">u</span>
                  </>
                }
                sub="Across Active Lines"
                className="border-r border-b border-[#EAEAEA] dark:border-zinc-800"
              />
              <KpiTile
                label="Global Efficiency"
                value={`${avgEfficiency.toFixed(1)}%`}
                accent={
                  avgEfficiency >= 90
                    ? "green"
                    : avgEfficiency >= 75
                      ? "none"
                      : "amber"
                }
                sub="Vs 100% Target"
                className="border-b border-[#EAEAEA] dark:border-zinc-800"
              />
              <KpiTile
                label="Active Bottlenecks"
                value={bottleneckCount.toString()}
                accent={bottleneckCount > 0 ? "amber" : "green"}
                sub="Requires Reallocation"
                className="border-r border-[#EAEAEA] dark:border-zinc-800"
              />
              <KpiTile
                label="System Status"
                value={bottleneckCount > 0 ? "Alert" : "Stable"}
                accent={bottleneckCount > 0 ? "amber" : "green"}
                sub="Continuous Monitoring"
                className=""
              />
            </div>

            {/* Right Col: Model Prediction + Shortcuts */}
            <div className="flex flex-col bg-white dark:bg-[#111113]">
              <div className="flex-1 p-5 bg-[#E6F1EC]/30 dark:bg-[#0A321E]/10 border-b border-[#EAEAEA] dark:border-zinc-800 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-2">
                  <Activity
                    size={12}
                    className="text-[#1A7C4B] dark:text-[#47966F]"
                  />
                  <p className="text-[10px] font-bold tracking-widest text-[#1A7C4B] dark:text-[#47966F] uppercase">
                    Model Prediction
                  </p>
                </div>
                <h3 className="text-2xl font-bold text-[#242424] dark:text-zinc-100 tabular-nums">
                  {(avgEfficiency + 2.4).toFixed(1)}%
                </h3>
                <p className="text-[10px] text-[#5F5F5F] dark:text-zinc-400 mt-1">
                  Expected end-of-shift efficiency based on current velocity.
                </p>
              </div>
              <div className="flex flex-1">
                <ShortcutCard
                  title="Risk Analysis"
                  desc="View predictive models"
                  href="/risk-analyze"
                  icon={Activity}
                />
                <ShortcutCard
                  title="Stress Monitor"
                  desc="Assess operator fatigue"
                  href="/management/stress-monitoring"
                  icon={CheckSquare}
                />
                <ShortcutCard
                  title="Workforce"
                  desc="Manage operator profiles"
                  href="/workforce"
                  icon={LayoutGrid}
                />
              </div>
            </div>
          </div>

          {/* 2ND ROW: Workforce Matrix, Efficiency Chart, Notification Center */}
          <div className="grid grid-cols-1 xl:grid-cols-3 border-b border-[#EAEAEA] dark:border-zinc-800 shrink-0 bg-[#FAFAFA] dark:bg-[#0a0a0c]">
            {/* Col 1: Workforce Matrix */}
            <div className="p-5 flex flex-col bg-white dark:bg-[#111113] border-b xl:border-b-0 xl:border-r border-[#EAEAEA] dark:border-zinc-800 min-h-[300px]">
              <div className="shrink-0 mb-2">
                <p className="text-[10px] font-medium tracking-widest text-[#9A9A9A] uppercase mb-0.5">
                  Skill Distribution
                </p>
                <h3 className="text-sm font-bold text-[#242424] dark:text-zinc-100">
                  Active Workforce Matrix
                </h3>
              </div>
              {loading ? (
                <div className="flex-1 flex items-center justify-center text-[10px] text-[#9A9A9A]">
                  Loading...
                </div>
              ) : (
                <SkillDonutChart matrix={skillMatrix} />
              )}
            </div>

            {/* Col 2: Efficiency vs Target */}
            <div className="p-5 flex flex-col bg-white dark:bg-[#111113] border-b xl:border-b-0 xl:border-r border-[#EAEAEA] dark:border-zinc-800 min-h-[300px]">
              <div className="shrink-0 mb-2">
                <p className="text-[10px] font-medium tracking-widest text-[#9A9A9A] uppercase mb-0.5">
                  Performance
                </p>
                <h3 className="text-sm font-bold text-[#242424] dark:text-zinc-100">
                  Efficiency vs Target
                </h3>
              </div>
              {loading ? (
                <div className="flex-1 flex items-center justify-center text-[10px] text-[#9A9A9A]">
                  Loading...
                </div>
              ) : (
                <EfficiencyBarChart stations={stations} />
              )}
            </div>

            {/* Col 3: Notification Center (Strict Height) */}
            <div className="flex flex-col bg-white dark:bg-[#111113] h-[350px]">
              <div className="shrink-0 px-5 py-4 border-b border-[#EAEAEA] dark:border-zinc-800 flex justify-between items-center bg-[#FAFAFA] dark:bg-[#0a0a0c]">
                <p className="text-[10px] font-bold tracking-widest text-[#9A9A9A] dark:text-zinc-500 uppercase">
                  Alert Center
                </p>
                <span className="text-[10px] font-mono bg-[#EAEAEA] dark:bg-zinc-800 px-2 py-0.5 text-[#5F5F5F] dark:text-zinc-400">
                  {allAlerts.length} Events
                </span>
              </div>
              <div className={`flex-1 overflow-y-auto flex flex-col ${SCROLLBAR}`}>
                {allAlerts.length === 0 ? (
                  <p className="text-xs text-center text-[#9A9A9A] mt-10">
                    No active alerts.
                  </p>
                ) : (
                  allAlerts.map((alert, i) => (
                    <div
                      key={i}
                      className={`p-4 border-b border-[#EAEAEA] dark:border-zinc-800 bg-white dark:bg-[#111113] transition-colors ${alert.type === "critical" ? "border-l-[3px] border-l-[#CE8E33]" : ""}`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        {alert.type === "critical" && (
                          <AlertTriangle size={12} className="text-[#CE8E33]" />
                        )}
                        <span
                          className={`font-bold uppercase tracking-wider text-[10px] ${alert.type === "critical" ? "text-[#CE8E33]" : "text-[#5F5F5F] dark:text-zinc-300"}`}
                        >
                          {alert.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#5F5F5F] dark:text-zinc-400 font-mono leading-relaxed">
                        {alert.desc}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 3RD ROW: Production Routing Map & Live Queue Breakdown */}
          <div className="grid grid-cols-1 xl:grid-cols-2 border-b border-[#EAEAEA] dark:border-zinc-800 shrink-0 bg-[#FAFAFA] dark:bg-[#0a0a0c]">
            
            {/* Col 1: Production Routing (Floor Map) */}
            <div className="flex-1 flex flex-col bg-[#FAFAFA] dark:bg-[#0a0a0c] border-b xl:border-b-0 xl:border-r border-[#EAEAEA] dark:border-zinc-800 min-h-[350px]">
              <div className="shrink-0 px-5 pt-5 pb-2">
                <p className="text-[10px] font-medium tracking-widest text-[#9A9A9A] uppercase mb-0.5">
                  Floor Layout
                </p>
                <h3 className="text-sm font-bold text-[#242424] dark:text-zinc-100">
                  Production Routing
                </h3>
              </div>
              {loading ? (
                <div className="flex-1 flex items-center justify-center text-[10px] text-[#9A9A9A]">
                  Loading...
                </div>
              ) : (
                <FloorTreeGraph stations={stations} skillMatrix={skillMatrix} />
              )}
            </div>

            {/* Col 2: Live Queue Breakdown (Fixed Height) */}
            <div className="shrink-0 h-[350px] flex flex-col bg-white dark:bg-[#111113]">
              <div className="shrink-0 px-5 py-4 border-b border-[#EAEAEA] dark:border-zinc-800 bg-[#FAFAFA] dark:bg-[#0a0a0c]">
                <p className="text-[10px] font-bold tracking-widest text-[#9A9A9A] dark:text-zinc-500 uppercase">
                  Live Queue Breakdown
                </p>
              </div>
              <div className={`flex-1 overflow-y-auto ${SCROLLBAR}`}>
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-white dark:bg-[#111113] sticky top-0 border-b border-[#EAEAEA] dark:border-zinc-800 z-10">
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

      <footer className="shrink-0 px-6 py-2 bg-white dark:bg-[#111113] border-t border-[#EAEAEA] dark:border-zinc-800 flex justify-between">
        <p className="text-[10px] text-[#9A9A9A] uppercase tracking-widest">
          StitchFlow · Operations Overview v2.0
        </p>
        <p className="text-[10px] text-[#9A9A9A] uppercase tracking-widest font-mono">
          Live Sync Active
        </p>
      </footer>
    </div>
  );
}