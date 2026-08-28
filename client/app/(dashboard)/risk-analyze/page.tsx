"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  api,
  type FlaggedEmployee,
  type LaborEntry,
} from "@/lib/risk-analyze/api";

type OperatorUser = {
  id: string;
  name: string;
  worker_id: string | null;
};

type Trend = "IMPROVING" | "DECLINING" | "STABLE" | "NOT_ENOUGH_DATA";

type EmployeeAnalytics = {
  id: string;
  name: string;
  worker_id: string | null;
  totalSubmissions: number;
  todaySubmissions: number;
  avgEfficiency: number;
  trend: Trend;
  latestStatus: "HIGH" | "MEDIUM" | "LOW";
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | null;
  isOutlier: boolean;
  isFlagged: boolean;
  lastSubmittedAt: string;
  recentEntries: LaborEntry[];
};

function computeTrend(mostRecentFirst: LaborEntry[]): Trend {
  if (mostRecentFirst.length < 6) return "NOT_ENOUGH_DATA";
  const last3 =
    mostRecentFirst.slice(0, 3).reduce((s, e) => s + Number(e.efficiency), 0) /
    3;
  const prev3 =
    mostRecentFirst.slice(3, 6).reduce((s, e) => s + Number(e.efficiency), 0) /
    3;
  if (last3 > prev3) return "IMPROVING";
  if (last3 < prev3) return "DECLINING";
  return "STABLE";
}

export default function RiskAnalyzePage() {
  const [ready, setReady] = useState(false);
  const [users, setUsers] = useState<OperatorUser[]>([]);
  const [flagged, setFlagged] = useState<FlaggedEmployee[]>([]);
  const [entries, setEntries] = useState<LaborEntry[]>([]);

  const loadAll = useCallback(async () => {
    try {
      const [u, f, e] = await Promise.all([
        api.get<OperatorUser[]>("/operators"),
        api.get<FlaggedEmployee[]>("/flags"),
        api.get<LaborEntry[]>("/laborers"),
      ]);
      setUsers(u);
      setFlagged(f);
      setEntries(e);
    } catch {
      /* keep last known state */
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const flaggedIds = useMemo(
    () => new Set(flagged.map((f) => String(f.id))),
    [flagged],
  );

  const employeeAnalytics = useMemo<EmployeeAnalytics[]>(() => {
    const byLaborer = new Map<string, LaborEntry[]>();
    for (const e of entries) {
      const idStr = String(e.operator_id);
      const list = byLaborer.get(idStr);
      if (list) list.push(e);
      else byLaborer.set(idStr, [e]);
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const rows: EmployeeAnalytics[] = [];

    for (const [operatorId, rawEntries] of byLaborer) {
      if (rawEntries.length === 0) continue;

      const sorted = [...rawEntries].sort((a, b) => {
        const aKey = `${a.date}T${a.time}`;
        const bKey = `${b.date}T${b.time}`;
        return bKey.localeCompare(aKey);
      });

      const latest = sorted[0];
      const user = users.find((u) => u.id === operatorId);

      const avgEfficiency =
        rawEntries.reduce((sum, e) => sum + Number(e.efficiency), 0) /
        rawEntries.length;

      rows.push({
        id: operatorId,
        name:
          latest.laborer_name ||
          user?.name ||
          `Employee #${operatorId.slice(0, 6)}`,
        worker_id: latest.employee_code ?? user?.worker_id ?? null,
        totalSubmissions: rawEntries.length,
        todaySubmissions: rawEntries.filter((e) => e.date === todayStr).length,
        avgEfficiency,
        trend: computeTrend(sorted),
        latestStatus: latest.status as "HIGH" | "MEDIUM" | "LOW",
        riskLevel: latest.risk_level as "LOW" | "MEDIUM" | "HIGH" | null,
        isOutlier: latest.is_outlier ?? false,
        isFlagged: flaggedIds.has(operatorId),
        lastSubmittedAt: `${latest.date}T${latest.time}`,
        recentEntries: sorted,
      });
    }

    const riskRank = (r: EmployeeAnalytics) => {
      if (r.isFlagged) return 0;
      if (r.riskLevel === "HIGH" || r.isOutlier) return 1;
      if (r.riskLevel === "MEDIUM") return 2;
      return 3;
    };

    return rows.sort((a, b) => {
      const rankDiff = riskRank(a) - riskRank(b);
      if (rankDiff !== 0) return rankDiff;
      return a.avgEfficiency - b.avgEfficiency;
    });
  }, [entries, users, flaggedIds]);

  const today = new Date().toISOString().slice(0, 10);
  const todaysEntries = entries.filter((e) => e.date === today);
  const employeeCount = users.length;

  const avgEfficiencyToday =
    todaysEntries.length > 0
      ? todaysEntries.reduce((sum, e) => sum + Number(e.efficiency), 0) /
        todaysEntries.length
      : null;

  const highRiskToday = todaysEntries.filter(
    (e) => e.risk_level === "HIGH" || e.is_outlier,
  ).length;

  if (!ready) {
    return (
      <main className="min-h-screen bg-[#F8F8F8] dark:bg-[#030C08] flex items-center justify-center">
        <span className="font-mono text-[11px] text-[#9A9A9A] tracking-widest uppercase">
          Loading analysis…
        </span>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F8F8] dark:bg-[#030C08] text-[#242424] dark:text-zinc-200 flex flex-col">
      {/* ── Header & KPI Strip ── */}
      <section className="border-b border-[#EAEAEA] dark:border-zinc-800 bg-white dark:bg-[#111113] flex flex-col lg:flex-row shrink-0">
        <div className="lg:w-1/3 p-6 lg:p-8 border-b lg:border-b-0 lg:border-r border-[#EAEAEA] dark:border-zinc-800 flex flex-col justify-center">
          <div className="text-[10px] font-medium uppercase tracking-widest text-[#9A9A9A] dark:text-zinc-500 mb-1">
            Reports & Analytics
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#242424] dark:text-zinc-100">
            Real-Time Risk Analysis
          </h1>
          <p className="text-xs text-[#5F5F5F] dark:text-zinc-400 mt-2 max-w-sm leading-relaxed">
            Monitor operator performance trends, identify bottlenecks, and
            review high-risk output submissions.
          </p>
        </div>

        <div className="lg:w-2/3 grid grid-cols-2 md:grid-cols-4">
          <KpiTile
            label="Monitored Staff"
            value={employeeCount}
            borderRight
            borderBottom
            className="md:border-b-0"
          />
          <KpiTile
            label="Active Flags"
            value={flagged.length}
            tone={flagged.length > 0 ? "amber" : "default"}
            borderRight
            className="md:border-r"
            borderBottom
          />
          <KpiTile
            label="Avg Efficiency"
            value={
              avgEfficiencyToday != null
                ? `${avgEfficiencyToday.toFixed(1)}%`
                : "—"
            }
            tone={
              avgEfficiencyToday && avgEfficiencyToday < 75
                ? "amber"
                : avgEfficiencyToday && avgEfficiencyToday >= 90
                  ? "green"
                  : "default"
            }
            borderRight
          />
          <KpiTile
            label="High-Risk Submissions"
            value={highRiskToday}
            tone={highRiskToday > 0 ? "amber" : "default"}
          />
        </div>
      </section>

      {/* ── Employee Analysis Grid ── */}
      <section className="flex-1 bg-white dark:bg-[#111113]">
        <div className="px-6 py-4 border-b border-[#EAEAEA] dark:border-zinc-800 flex items-center justify-between bg-[#F8F8F8] dark:bg-zinc-900/40">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#5F5F5F] dark:text-zinc-400">
            Operator Performance Matrix
          </div>
          <div className="text-[10px] font-mono text-[#9A9A9A] dark:text-zinc-500">
            {employeeAnalytics.length} RECORDS FOUND
          </div>
        </div>

        {employeeAnalytics.length === 0 ? (
          <div className="p-8 text-center text-xs font-mono text-[#9A9A9A] dark:text-zinc-600 uppercase tracking-widest">
            No entries logged yet.
          </div>
        ) : (
          <div className="divide-y divide-[#EAEAEA] dark:divide-zinc-800">
            {employeeAnalytics.map((emp) => (
              <EmployeeAnalyticsCard key={emp.id} employee={emp} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function KpiTile({
  label,
  value,
  tone = "default",
  borderRight,
  borderBottom,
  className = "",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "green" | "amber";
  borderRight?: boolean;
  borderBottom?: boolean;
  className?: string;
}) {
  const colorClass =
    tone === "green"
      ? "text-[#1A7C4B] dark:text-[#47966F]"
      : tone === "amber"
        ? "text-[#CE8E33] dark:text-[#D7A45A]"
        : "text-[#242424] dark:text-zinc-100";
  const borderR = borderRight
    ? "border-r border-[#EAEAEA] dark:border-zinc-800"
    : "";
  const borderB = borderBottom
    ? "border-b border-[#EAEAEA] dark:border-zinc-800"
    : "";

  return (
    <div
      className={`p-6 flex flex-col justify-center ${borderR} ${borderB} ${className}`}
    >
      <div className="text-[10px] uppercase tracking-widest text-[#9A9A9A] dark:text-zinc-500 mb-1">
        {label}
      </div>
      <div
        className={`font-mono text-3xl font-bold tracking-tight ${colorClass}`}
      >
        {value}
      </div>
    </div>
  );
}

function TrendBadge({ trend }: { trend: Trend }) {
  const meta: Record<
    Trend,
    { label: string; className: string; glyph: string }
  > = {
    IMPROVING: {
      label: "Improving",
      className: "text-[#1A7C4B] dark:text-[#47966F]",
      glyph: "▲",
    },
    DECLINING: {
      label: "Declining",
      className: "text-[#CE8E33] dark:text-[#D7A45A]",
      glyph: "▼",
    },
    STABLE: {
      label: "Stable",
      className: "text-[#9A9A9A] dark:text-zinc-500",
      glyph: "▬",
    },
    NOT_ENOUGH_DATA: {
      label: "Not enough data",
      className: "text-[#9A9A9A] dark:text-zinc-600",
      glyph: "·",
    },
  };
  const m = meta[trend];
  return (
    <span
      className={`font-mono text-[10px] font-bold uppercase tracking-widest inline-flex items-center gap-1 ${m.className}`}
    >
      <span aria-hidden className="text-[8px]">
        {m.glyph}
      </span>
      {m.label}
    </span>
  );
}

function StatusTag({ status }: { status: string }) {
  const baseClasses =
    "inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest border";
  const colorClasses =
    status === "HIGH"
      ? "bg-[#E6F1EC] dark:bg-[#0A321E] text-[#1A7C4B] dark:text-[#47966F] border-[#1A7C4B]/20"
      : status === "MEDIUM"
        ? "bg-[#FDFBF8] dark:bg-amber-950/30 text-[#CE8E33] dark:text-[#D7A45A] border-[#CE8E33]/20"
        : "bg-[#F1F1F1] dark:bg-zinc-800 text-[#5F5F5F] dark:text-zinc-400 border-[#9A9A9A]/20";

  return <span className={`${baseClasses} ${colorClasses}`}>{status}</span>;
}

function RiskTag({
  level,
  outlier,
}: {
  level: string | null;
  outlier: boolean;
}) {
  if (!level)
    return <span className="text-[10px] text-[#9A9A9A] font-mono">—</span>;

  const baseClasses =
    "inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest border";
  const colorClasses =
    level === "LOW"
      ? "bg-[#E6F1EC] dark:bg-[#0A321E] text-[#1A7C4B] dark:text-[#47966F] border-[#1A7C4B]/20"
      : level === "MEDIUM"
        ? "bg-[#FDFBF8] dark:bg-amber-950/30 text-[#CE8E33] dark:text-[#D7A45A] border-[#CE8E33]/20"
        : "bg-[#FDFBF8] dark:bg-amber-950/30 text-[#CE8E33] dark:text-[#D7A45A] border-[#CE8E33]/20";

  return (
    <span className={`${baseClasses} ${colorClasses}`}>
      {level} RISK
      {outlier ? " · OUTLIER" : ""}
    </span>
  );
}

function EmployeeAnalyticsCard({ employee }: { employee: EmployeeAnalytics }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-transparent hover:bg-[#F8F8F8] dark:hover:bg-zinc-900/30 transition-colors">
      <div
        className="w-full flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 md:p-6 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1.5">
            <h3 className="text-sm font-bold text-[#242424] dark:text-zinc-100 truncate">
              {employee.name}
            </h3>
            {employee.worker_id && (
              <span className="font-mono text-[10px] text-[#9A9A9A] dark:text-zinc-500 uppercase tracking-widest border border-[#EAEAEA] dark:border-zinc-700 px-1">
                ID: {employee.worker_id}
              </span>
            )}
            {employee.isFlagged && (
              <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold bg-[#CE8E33] text-white dark:text-[#0A0702] uppercase tracking-widest animate-pulse">
                FLAGGED
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-2">
            <StatusTag status={employee.latestStatus} />
            <RiskTag level={employee.riskLevel} outlier={employee.isOutlier} />
            <span className="text-[#EAEAEA] dark:text-zinc-700">|</span>
            <TrendBadge trend={employee.trend} />
          </div>
        </div>

        <div className="flex items-center gap-6 md:gap-10 shrink-0">
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-widest text-[#9A9A9A] dark:text-zinc-500">
              Efficiency
            </div>
            <div className="font-mono font-bold text-lg text-[#242424] dark:text-zinc-100">
              {employee.avgEfficiency.toFixed(1)}%
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-[9px] uppercase tracking-widest text-[#9A9A9A] dark:text-zinc-500">
              Submissions
            </div>
            <div className="font-mono font-bold text-lg text-[#242424] dark:text-zinc-100">
              {employee.totalSubmissions}{" "}
              <span className="text-xs text-[#9A9A9A] font-normal">
                ({employee.todaySubmissions} today)
              </span>
            </div>
          </div>
          <div className="text-[#9A9A9A] font-mono text-xl w-6 flex justify-end">
            {expanded ? "−" : "+"}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-5 md:px-6 pb-6 pt-2 bg-[#F8F8F8] dark:bg-[#111113] border-t border-[#EAEAEA] dark:border-zinc-800">
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#5F5F5F] dark:text-zinc-400 mb-4">
                Recent Efficiency Trend
              </div>
              <Sparkline entries={employee.recentEntries.slice(0, 15)} />
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#5F5F5F] dark:text-zinc-400 mb-4">
                Submission History (Latest)
              </div>
              <div className="border border-[#EAEAEA] dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
                {employee.recentEntries.slice(0, 3).map((entry, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center p-3 border-b border-[#EAEAEA] dark:border-zinc-800 last:border-0"
                  >
                    <span className="font-mono text-[10px] text-[#5F5F5F] dark:text-zinc-400">
                      {entry.date} {entry.time?.slice(0, 5)}
                    </span>
                    <span className="font-mono text-[11px] font-bold text-[#242424] dark:text-zinc-200">
                      {Number(entry.efficiency).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Sparkline({ entries }: { entries: LaborEntry[] }) {
  const chrono = [...entries].reverse();
  const W = 400;
  const H = 80;
  const PAD = { top: 10, right: 10, bottom: 10, left: 10 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  if (chrono.length < 2) {
    return (
      <div
        className="font-mono text-[10px] text-[#9A9A9A] flex items-center justify-center border border-dashed border-[#EAEAEA] dark:border-zinc-800"
        style={{ height: H }}
      >
        NOT ENOUGH DATA
      </div>
    );
  }

  const vy = (v: number) =>
    PAD.top + innerH - (Math.max(0, Math.min(150, v)) / 150) * innerH;
  const points = chrono
    .map((e, i) => {
      const x = PAD.left + (i / (chrono.length - 1)) * innerW;
      const y = vy(Number(e.efficiency));
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const last = chrono[chrono.length - 1];
  const lastX = PAD.left + innerW;
  const lastY = vy(Number(last.efficiency));

  const lineColor =
    Number(last.efficiency) >= 85
      ? "#1A7C4B"
      : Number(last.efficiency) >= 60
        ? "#CE8E33"
        : "#CE8E33";

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: H }}
      aria-label="Recent efficiency trend"
    >
      {/* Grid line at 100% Target */}
      <line
        x1="0"
        y1={vy(100)}
        x2={W}
        y2={vy(100)}
        stroke="#9A9A9A"
        strokeWidth={1}
        strokeDasharray="3 3"
        className="opacity-30"
      />
      <text
        x="0"
        y={vy(100) - 4}
        fontSize="8"
        fill="#9A9A9A"
        className="font-mono"
      >
        TARGET 100%
      </text>

      <polyline
        points={points}
        fill="none"
        stroke={lineColor}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={lastX}
        cy={lastY}
        r={3.5}
        fill={lineColor}
        stroke="#FFFFFF"
        strokeWidth={1.5}
        className="dark:stroke-[#111113]"
      />
    </svg>
  );
}
