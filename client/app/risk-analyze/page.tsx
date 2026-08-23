"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type FlaggedEmployee, type LaborEntry } from "@/lib/risk-analyze/api";

type LaberUser = {
  id: number;
  name: string;
  role: "admin" | "labor";
  employee_code: string | null;
  submission_count: number;
  is_flagged: boolean;
};

type Trend = "IMPROVING" | "DECLINING" | "STABLE" | "NOT_ENOUGH_DATA";

type EmployeeAnalytics = {
  id: number;
  name: string;
  employee_code: string | null;
  totalSubmissions: number;
  todaySubmissions: number;
  avgEfficiency: number;
  trend: Trend;
  latestStatus: "HIGH" | "MEDIUM" | "LOW";
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | null;
  isOutlier: boolean;
  isFlagged: boolean;
  lastSubmittedAt: string; // ISO-ish sortable key built from date + time
  recentEntries: LaborEntry[]; // most-recent-first, for the sparkline drill-down
};

// Mirrors the trend calc in GET /analysis/{laborers_id} (services/risk_analyze/main.py):
// take the 6 most recent entries, compare the average of the newest 3 against
// the average of the 3 before that. Fewer than 6 entries -> not enough data.
function computeTrend(mostRecentFirst: LaborEntry[]): Trend {
  if (mostRecentFirst.length < 6) return "NOT_ENOUGH_DATA";
  const last3 = mostRecentFirst.slice(0, 3).reduce((s, e) => s + Number(e.efficiency), 0) / 3;
  const prev3 = mostRecentFirst.slice(3, 6).reduce((s, e) => s + Number(e.efficiency), 0) / 3;
  if (last3 > prev3) return "IMPROVING";
  if (last3 < prev3) return "DECLINING";
  return "STABLE";
}

export default function SupervisorDashboard() {
  const [ready, setReady] = useState(false);
  const [users, setUsers] = useState<LaberUser[]>([]);
  const [flagged, setFlagged] = useState<FlaggedEmployee[]>([]);
  const [entries, setEntries] = useState<LaborEntry[]>([]);

  const loadAll = useCallback(async () => {
    try {
      const [u, f, e] = await Promise.all([
        api.get<LaberUser[]>("/labers"),
        api.get<FlaggedEmployee[]>("/flags"),
        api.get<LaborEntry[]>("/laborers"),
      ]);
      setUsers(u);
      setFlagged(f);
      setEntries(e);
    } catch {
      /* keep last known state on transient failure */
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch + poll, not a derived-state loop
    loadAll();
    const interval = setInterval(loadAll, 15000); // light polling for a "live" feel
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flaggedIds = useMemo(() => new Set(flagged.map((f) => f.id)), [flagged]);

  const employeeAnalytics = useMemo<EmployeeAnalytics[]>(() => {
    const byLaborer = new Map<number, LaborEntry[]>();
    for (const e of entries) {
      const list = byLaborer.get(e.laborers_id);
      if (list) list.push(e);
      else byLaborer.set(e.laborers_id, [e]);
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const rows: EmployeeAnalytics[] = [];

    for (const [laborersId, rawEntries] of byLaborer) {
      if (rawEntries.length === 0) continue;

      // Most-recent-first, mirroring the ordering /analysis/{laborers_id} uses for trend.
      const sorted = [...rawEntries].sort((a, b) => {
        const aKey = `${a.date}T${a.time}`;
        const bKey = `${b.date}T${b.time}`;
        return bKey.localeCompare(aKey);
      });
      const latest = sorted[0];
      const user = users.find((u) => u.id === laborersId);

      const avgEfficiency =
        rawEntries.reduce((sum, e) => sum + Number(e.efficiency), 0) / rawEntries.length;

      rows.push({
        id: laborersId,
        name: latest.laborer_name || user?.name || `Employee #${laborersId}`,
        employee_code: latest.employee_code ?? user?.employee_code ?? null,
        totalSubmissions: rawEntries.length,
        todaySubmissions: rawEntries.filter((e) => e.date === todayStr).length,
        avgEfficiency,
        trend: computeTrend(sorted),
        latestStatus: latest.status,
        riskLevel: latest.risk_level,
        isOutlier: latest.is_outlier,
        isFlagged: flaggedIds.has(laborersId),
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
  const employeeCount = users.filter((u) => u.role === "labor").length;
  const avgEfficiencyToday =
    todaysEntries.length > 0
      ? todaysEntries.reduce((sum, e) => sum + Number(e.efficiency), 0) / todaysEntries.length
      : null;
  const highRiskToday = todaysEntries.filter((e) => e.risk_level === "HIGH" || e.is_outlier).length;

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <span className="mono text-[var(--ink-muted)]">Loading control room…</span>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 py-10 md:py-14">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-start justify-between mb-8">
          <div>
            <div className="eyebrow text-[#7fb2e8] mb-1">Reports & Analytics</div>
            <h1 className="display text-3xl text-white">Employee performance, right now</h1>
          </div>
        </header>

        {/* ---------------- KPI strip ---------------- */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Kpi label="Employees" value={employeeCount} />
          <Kpi label="Flagged" value={flagged.length} tone={flagged.length ? "red" : undefined} />
          <Kpi label="Entries today" value={todaysEntries.length} />
          <Kpi
            label="Avg efficiency today"
            value={avgEfficiencyToday != null ? `${avgEfficiencyToday.toFixed(1)}%` : "—"}
          />
          <Kpi label="High-risk entries" value={highRiskToday} tone={highRiskToday ? "amber" : undefined} />
        </div>

        {/* ---------------- Employee-wise Analytics ---------------- */}
        <div className="panel p-5">
          <div className="eyebrow text-[var(--ink-muted)] mb-4">Employee-wise analytics</div>
          {employeeAnalytics.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">No entries logged yet.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {employeeAnalytics.map((emp) => (
                <EmployeeAnalyticsCard key={emp.id} employee={emp} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function TrendBadge({ trend }: { trend: Trend }) {
  const meta: Record<Trend, { label: string; color: string; glyph: string }> = {
    IMPROVING: { label: "Improving", color: "var(--green)", glyph: "▲" },
    DECLINING: { label: "Declining", color: "var(--red)", glyph: "▼" },
    STABLE: { label: "Stable", color: "var(--ink-muted)", glyph: "▬" },
    NOT_ENOUGH_DATA: { label: "Not enough data", color: "var(--ink-muted)", glyph: "·" },
  };
  const m = meta[trend];
  return (
    <span className="mono text-xs inline-flex items-center gap-1" style={{ color: m.color }}>
      <span aria-hidden>{m.glyph}</span>
      {m.label}
    </span>
  );
}

// Small hand-rolled inline-SVG sparkline, following the same polyline-building
// approach as app/components/EfficiencyChart.tsx but sized for a card and
// themed with the risk-analyze CSS variables instead of the zinc/emerald palette.
function Sparkline({ entries }: { entries: LaborEntry[] }) {
  // entries arrive most-recent-first; render chronologically (oldest -> newest).
  const chrono = [...entries].reverse();
  const W = 260;
  const H = 60;
  const PAD = { top: 6, right: 6, bottom: 6, left: 6 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  if (chrono.length < 2) {
    return (
      <div className="mono text-xs text-[var(--ink-muted)] flex items-center justify-center" style={{ height: H }}>
        Not enough entries for a trend line yet.
      </div>
    );
  }

  const vy = (v: number) => PAD.top + innerH - (Math.max(0, Math.min(150, v)) / 150) * innerH;
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
    Number(last.efficiency) >= 85 ? "var(--green)" : Number(last.efficiency) >= 60 ? "var(--amber)" : "var(--red)";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} aria-label="Recent efficiency trend">
      <polyline points={points} fill="none" stroke={lineColor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r={3} fill={lineColor} />
    </svg>
  );
}

function EmployeeAnalyticsCard({ employee }: { employee: EmployeeAnalytics }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="panel-raised p-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start justify-between gap-3 text-left"
        aria-expanded={expanded}
      >
        <div className="min-w-0">
          <div className="text-white font-medium text-sm truncate">
            {employee.name}{" "}
            {employee.employee_code && (
              <span className="mono text-[var(--ink-muted)]">· {employee.employee_code}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
            <StatusTag status={employee.latestStatus} />
            <RiskTag level={employee.riskLevel} outlier={employee.isOutlier} />
            {employee.isFlagged && <span className="tag tag-low">FLAGGED</span>}
            <TrendBadge trend={employee.trend} />
          </div>
        </div>
        <span className="mono text-[var(--ink-muted)] text-lg shrink-0">{expanded ? "–" : "+"}</span>
      </button>

      <div className="grid grid-cols-3 gap-2 mt-3">
        <div>
          <div className="text-[9px] uppercase tracking-wide text-[var(--ink-muted)]">Avg efficiency</div>
          <div className="led-digits text-lg text-white">{employee.avgEfficiency.toFixed(1)}%</div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wide text-[var(--ink-muted)]">Submissions</div>
          <div className="led-digits text-lg text-white">
            {employee.totalSubmissions} <span className="text-xs text-[var(--ink-muted)]">({employee.todaySubmissions} today)</span>
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wide text-[var(--ink-muted)]">Last submitted</div>
          <div className="mono text-xs text-white mt-1.5">
            {employee.recentEntries[0]?.date} {employee.recentEntries[0]?.time?.slice(0, 5)}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-3 border-t border-[var(--ink-line)]">
          <div className="text-[9px] uppercase tracking-wide text-[var(--ink-muted)] mb-2">
            Recent efficiency trend
          </div>
          <Sparkline entries={employee.recentEntries.slice(0, 10)} />
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: "red" | "amber" }) {
  const color = tone === "red" ? "var(--red)" : tone === "amber" ? "var(--amber)" : "#fff";
  return (
    <div className="panel p-4">
      <div className="text-[10px] uppercase tracking-wide text-[var(--ink-muted)] mb-1">{label}</div>
      <div className="led-digits text-2xl" style={{ color }}>{value}</div>
    </div>
  );
}

function StatusTag({ status }: { status: string }) {
  const cls = status === "HIGH" ? "tag-high" : status === "MEDIUM" ? "tag-medium" : "tag-low";
  return <span className={`tag ${cls}`}>{status}</span>;
}

function RiskTag({ level, outlier }: { level: string | null; outlier: boolean }) {
  if (!level) return <span className="text-[var(--ink-muted)]">—</span>;
  const cls = level === "LOW" ? "tag-high" : level === "MEDIUM" ? "tag-medium" : "tag-low";
  return (
    <span className={`tag ${cls}`}>
      {level}
      {outlier ? " · OUTLIER" : ""}
    </span>
  );
}
