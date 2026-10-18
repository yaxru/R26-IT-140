"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  api,
  type FlaggedEmployee,
  type LaborEntry,
} from "@/lib/risk-analyze/api";
import { AlertTriangle, ChevronRight, Minus } from "lucide-react";

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
  todayEntries: LaborEntry[];
  historyEntries: LaborEntry[];
  todayAvgEfficiency: number | null;
  historyAvgEfficiency: number | null;
  trend: Trend;
  latestTodayStatus: "HIGH" | "MEDIUM" | "LOW" | null;
  latestTodayRisk: "LOW" | "MEDIUM" | "HIGH" | null;
  isOutlierToday: boolean;
  isFlagged: boolean;
  lastSubmittedAt: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeTrend(
  todayAvg: number | null,
  historyAvg: number | null,
): Trend {
  if (todayAvg === null || historyAvg === null) return "NOT_ENOUGH_DATA";
  if (todayAvg > historyAvg + 3) return "IMPROVING";
  if (todayAvg < historyAvg - 3) return "DECLINING";
  return "STABLE";
}

function fmt(n: number | null | undefined, digits = 1) {
  if (n == null) return "—";
  return Number(n).toFixed(digits);
}

// ─── Main Page ────────────────────────────────────────────────────────────────

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
    } catch (err) {
      console.error("Failed to load risk analysis data", err);
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

  // Today's date in YYYY-MM-DD format (local time)
  const todayStr = new Date().toLocaleDateString("en-CA");

  const employeeAnalytics = useMemo<EmployeeAnalytics[]>(() => {
    const byLaborer = new Map<string, LaborEntry[]>();
    for (const e of entries) {
      const idStr = String(e.operator_id);
      const list = byLaborer.get(idStr);
      if (list) list.push(e);
      else byLaborer.set(idStr, [e]);
    }

    const rows: EmployeeAnalytics[] = [];

    for (const [operatorId, rawEntries] of byLaborer) {
      const user = users.find((u) => u.id === operatorId);

      const todayEntries = rawEntries
        .filter((e) => e.date === todayStr)
        .sort((a, b) => b.time.localeCompare(a.time));
      const historyEntries = rawEntries
        .filter((e) => e.date !== todayStr)
        .sort((a, b) =>
          `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`),
        );

      const latestToday = todayEntries.length > 0 ? todayEntries[0] : null;
      const latestOverall = rawEntries.sort((a, b) =>
        `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`),
      )[0];

      const todayAvg =
        todayEntries.length > 0
          ? todayEntries.reduce((sum, e) => sum + Number(e.efficiency), 0) /
            todayEntries.length
          : null;

      const historyAvg =
        historyEntries.length > 0
          ? historyEntries.reduce((sum, e) => sum + Number(e.efficiency), 0) /
            historyEntries.length
          : null;

      rows.push({
        id: operatorId,
        name:
          latestOverall?.laborer_name ||
          user?.name ||
          `Employee #${operatorId.slice(0, 6)}`,
        worker_id: latestOverall?.employee_code ?? user?.worker_id ?? null,
        todayEntries,
        historyEntries,
        todayAvgEfficiency: todayAvg,
        historyAvgEfficiency: historyAvg,
        trend: computeTrend(todayAvg, historyAvg),
        latestTodayStatus: latestToday
          ? (latestToday.status as "HIGH" | "MEDIUM" | "LOW")
          : null,
        latestTodayRisk: latestToday
          ? (latestToday.risk_level as "LOW" | "MEDIUM" | "HIGH" | null)
          : null,
        isOutlierToday: latestToday?.is_outlier ?? false,
        isFlagged: flaggedIds.has(operatorId),
        lastSubmittedAt: latestToday
          ? `${latestToday.date}T${latestToday.time}`
          : null,
      });
    }

    return rows.sort((a, b) => {
      if (a.isFlagged && !b.isFlagged) return -1;
      if (!a.isFlagged && b.isFlagged) return 1;

      const aRisk =
        a.latestTodayRisk === "HIGH" || a.isOutlierToday
          ? 2
          : a.latestTodayRisk === "MEDIUM"
            ? 1
            : 0;
      const bRisk =
        b.latestTodayRisk === "HIGH" || b.isOutlierToday
          ? 2
          : b.latestTodayRisk === "MEDIUM"
            ? 1
            : 0;
      if (aRisk !== bRisk) return bRisk - aRisk;

      if (a.todayEntries.length > 0 && b.todayEntries.length === 0) return -1;
      if (a.todayEntries.length === 0 && b.todayEntries.length > 0) return 1;

      return (a.todayAvgEfficiency || 0) - (b.todayAvgEfficiency || 0);
    });
  }, [entries, users, flaggedIds, todayStr]);

  const todaysEntries = entries.filter((e) => e.date === todayStr);
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
        <span className="font-mono text-[11px] text-[#9A9A9A] tracking-widest uppercase animate-pulse">
          Loading live analysis…
        </span>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F8F8] dark:bg-[#030C08] text-[#242424] dark:text-zinc-200 flex flex-col">
      <header className="shrink-0 border-b border-[#EAEAEA] dark:border-zinc-800 px-6 py-4 flex items-center justify-between bg-white dark:bg-[#111113]">
        <div>
          
          <h1 className="text-lg font-bold text-[#242424] dark:text-zinc-100 tracking-tight">
            Live Input & Risk Analysis
          </h1>
          <p className="text-xs text-[#5F5F5F] dark:text-zinc-400 max-w-sm ">
            Monitor operator performance trends and high-risk outputs strictly
            based on today's active shift data.
          </p>
        </div>
       
      </header>

      <section className="border-b border-[#EAEAEA] dark:border-zinc-800 bg-white dark:bg-[#111113] grid grid-cols-2 lg:grid-cols-4 shrink-0">
        <KpiTile label="Monitored Staff" value={employeeCount} />
        <KpiTile
          label="Active Flags"
          value={flagged.length}
          tone={flagged.length > 0 ? "amber" : "default"}
        />
        <KpiTile
          label="Today's Factory Eff"
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
        />
        <KpiTile
          label="High-Risk Inputs"
          value={highRiskToday}
          tone={highRiskToday > 0 ? "amber" : "default"}
        />
      </section>

      <section className="flex-1 bg-[#FAFAFA] dark:bg-[#0a0a0c] overflow-y-auto">
        <div className="px-6 py-4 border-b border-[#EAEAEA] dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-[#111113] sticky top-0 z-10 shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#5F5F5F] dark:text-zinc-400">
            Live Operator Matrix
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
          <div className="flex flex-col border-b border-[#EAEAEA] dark:border-zinc-800">
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
}: {
  label: string;
  value: string | number;
  tone?: "default" | "green" | "amber";
}) {
  const colorClass =
    tone === "green"
      ? "text-[#1A7C4B] dark:text-[#47966F]"
      : tone === "amber"
        ? "text-[#CE8E33] dark:text-[#D7A45A]"
        : "text-[#242424] dark:text-zinc-100";
  return (
    <div className="p-5 border-r border-b lg:border-b-0 border-[#EAEAEA] dark:border-zinc-800 last:border-r-0 flex flex-col justify-center">
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
      label: "No Baseline",
      className: "text-[#9A9A9A] dark:text-zinc-600",
      glyph: "·",
    },
  };
  const m = meta[trend];
  return (
    <span
      className={`font-mono text-[10px] font-bold uppercase tracking-widest inline-flex items-center gap-1.5 ${m.className}`}
    >
      <span aria-hidden className="text-[9px]">
        {m.glyph}
      </span>{" "}
      {m.label} vs History
    </span>
  );
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
      : "bg-[#FDFBF8] dark:bg-amber-950/30 text-[#CE8E33] dark:text-[#D7A45A] border-[#CE8E33]/20";

  return (
    <span className={`${baseClasses} ${colorClasses}`}>
      {level} RISK {outlier ? " · OUTLIER" : ""}
    </span>
  );
}

function EmployeeAnalyticsCard({ employee }: { employee: EmployeeAnalytics }) {
  const [expanded, setExpanded] = useState(false);
  const hasInputToday = employee.todayEntries.length > 0;

  // Process historical data to build the "Past 5 Shifts" view
  const dailyHistory = useMemo(() => {
    const grouped = new Map<string, number[]>();
    employee.historyEntries.forEach((e) => {
      const arr = grouped.get(e.date) || [];
      arr.push(Number(e.efficiency));
      grouped.set(e.date, arr);
    });
    return Array.from(grouped.entries())
      .map(([date, effs]) => ({
        date,
        avg: effs.reduce((a, b) => a + b, 0) / effs.length,
        count: effs.length,
      }))
      .sort((a, b) => b.date.localeCompare(a.date)) // Most recent first
      .slice(0, 5); // Take top 5
  }, [employee.historyEntries]);

  return (
    <div
      className={`border-b border-[#EAEAEA] dark:border-zinc-800 transition-colors ${employee.isFlagged ? "bg-[#FDFBF8]/50 dark:bg-[#1A1510]/50" : "bg-white dark:bg-[#111113] hover:bg-[#F8F8F8] dark:hover:bg-zinc-900/50"}`}
    >
      <div
        className="w-full flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1.5">
            <h3 className="text-sm font-bold text-[#242424] dark:text-zinc-100 truncate">
              {employee.name}
            </h3>
            {employee.worker_id && (
              <span className="font-mono text-[10px] text-[#9A9A9A] dark:text-zinc-500 uppercase tracking-widest bg-[#F8F8F8] dark:bg-zinc-900 border border-[#EAEAEA] dark:border-zinc-700 px-1.5 py-0.5">
                {employee.worker_id}
              </span>
            )}
            {employee.isFlagged && (
              <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold bg-[#CE8E33] text-white dark:text-[#0A0702] uppercase tracking-widest animate-pulse">
                <AlertTriangle size={10} className="mr-1" /> FLAGGED
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-2">
            {hasInputToday ? (
              <>
                <RiskTag
                  level={employee.latestTodayRisk}
                  outlier={employee.isOutlierToday}
                />
                <span className="text-[#EAEAEA] dark:text-zinc-700">|</span>
                <TrendBadge trend={employee.trend} />
              </>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#9A9A9A] bg-[#F1F1F1] dark:bg-zinc-800 px-2 py-0.5">
                Offline Today
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-8 md:gap-12 shrink-0 pr-2">
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-widest text-[#9A9A9A] dark:text-zinc-500 mb-0.5">
              Today's Eff
            </div>
            <div
              className={`font-mono font-bold text-xl ${hasInputToday ? "text-[#242424] dark:text-zinc-100" : "text-[#D4D4D4] dark:text-zinc-700"}`}
            >
              {fmt(employee.todayAvgEfficiency)}%
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-[9px] uppercase tracking-widest text-[#9A9A9A] dark:text-zinc-500 mb-0.5">
              Inputs Today
            </div>
            <div
              className={`font-mono font-bold text-xl ${hasInputToday ? "text-[#242424] dark:text-zinc-100" : "text-[#D4D4D4] dark:text-zinc-700"}`}
            >
              {employee.todayEntries.length}
            </div>
          </div>
          <div className="text-[#9A9A9A] dark:text-zinc-600 transition-transform">
            {expanded ? <Minus size={16} /> : <ChevronRight size={16} />}
          </div>
        </div>
      </div>

      {/* Expanded View */}
      {expanded && (
        <div className="flex flex-col lg:flex-row border-t border-[#EAEAEA] dark:border-zinc-800 bg-[#FAFAFA] dark:bg-[#0a0a0c]">
          {/* Today's Live Feed */}
          <div className="flex-1 p-5 border-b lg:border-b-0 lg:border-r border-[#EAEAEA] dark:border-zinc-800">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#5F5F5F] dark:text-zinc-400 mb-4">
              Today's Live Submissions
            </div>

            {employee.todayEntries.length === 0 ? (
              <div className="h-24 flex items-center justify-center border border-dashed border-[#EAEAEA] dark:border-zinc-800 text-[10px] font-mono text-[#9A9A9A] uppercase tracking-widest">
                No submissions logged today
              </div>
            ) : (
              <div className="border border-[#EAEAEA] dark:border-zinc-800 bg-white dark:bg-[#111113]">
                {employee.todayEntries.slice(0, 5).map((entry, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center px-4 py-2.5 border-b border-[#EAEAEA] dark:border-zinc-800 last:border-0"
                  >
                    <span className="font-mono text-[10px] text-[#5F5F5F] dark:text-zinc-400">
                      {entry.time?.slice(0, 5)}
                    </span>
                    <span
                      className={`font-mono text-[11px] font-bold ${Number(entry.efficiency) < 70 ? "text-[#CE8E33]" : "text-[#1A7C4B]"}`}
                    >
                      {Number(entry.efficiency).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Historical Baseline */}
          <div className="flex-1 p-5">
            <div className="flex justify-between items-end mb-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#5F5F5F] dark:text-zinc-400">
                Past 5 Shifts History
              </div>
              <div className="text-[10px] font-mono text-[#9A9A9A] dark:text-zinc-500">
                All-Time Avg:{" "}
                <span className="font-bold text-[#242424] dark:text-zinc-200">
                  {fmt(employee.historyAvgEfficiency)}%
                </span>
              </div>
            </div>

            {dailyHistory.length === 0 ? (
              <div className="h-24 flex items-center justify-center border border-dashed border-[#EAEAEA] dark:border-zinc-800 text-[10px] font-mono text-[#9A9A9A] uppercase tracking-widest">
                No historical records
              </div>
            ) : (
              <div className="flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden">
                {dailyHistory.map((day) => (
                  <div
                    key={day.date}
                    className={`p-3 border flex-1 min-w-25 flex flex-col justify-center ${day.avg < 60 ? "border-[#CE8E33] bg-[#FDFBF8] dark:bg-[#1A1510] dark:border-amber-900/50" : "border-[#EAEAEA] bg-white dark:bg-[#111113] dark:border-zinc-800"}`}
                  >
                    <div className="text-[9px] font-mono text-[#9A9A9A] dark:text-zinc-500">
                      {day.date}
                    </div>
                    <div
                      className={`text-lg font-mono font-bold mt-1 tracking-tight ${day.avg < 60 ? "text-[#CE8E33] dark:text-[#E1BA82]" : "text-[#242424] dark:text-zinc-200"}`}
                    >
                      {day.avg.toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
