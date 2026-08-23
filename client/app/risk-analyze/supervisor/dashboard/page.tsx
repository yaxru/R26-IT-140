"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type FlaggedEmployee, type LaborEntry, type Notification } from "@/lib/risk-analyze/api";
import { clearSupervisorSession, getSupervisorSession } from "@/lib/risk-analyze/session";

type LaberUser = {
  id: number;
  name: string;
  role: "admin" | "labor";
  employee_code: string | null;
  submission_count: number;
  is_flagged: boolean;
};

type EmployeeTrend = "IMPROVING" | "DECLINING" | "STABLE" | "NOT_ENOUGH_DATA";

type EmployeeAnalytics = {
  id: number;
  name: string;
  employee_code: string;
  totalSubmissions: number;
  todaySubmissions: number;
  avgEfficiency: number;
  trend: EmployeeTrend;
  riskLevel: LaborEntry["risk_level"];
  isOutlier: boolean;
  isFlagged: boolean;
  lastSubmittedAt: string;
  recentEfficiencies: number[];
};

function entryTimestamp(entry: LaborEntry) {
  return `${entry.date}T${entry.time || "00:00:00"}`;
}

function riskRank(employee: EmployeeAnalytics) {
  const levelRank = employee.riskLevel === "HIGH" ? 0 : employee.riskLevel === "MEDIUM" ? 1 : 2;
  return (employee.isFlagged ? 0 : 1) * 3 + levelRank;
}

function Sparkline({ values }: { values: number[] }) {
  const width = 180;
  const height = 48;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 100);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-[180px] h-12" aria-label="Recent efficiency trend">
      <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="var(--ink-line)" strokeDasharray="3 3" />
      <polyline points={points} fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {values.length > 0 && <circle cx={values.length === 1 ? width / 2 : width} cy={height - ((values[values.length - 1] - min) / range) * height} r="3" fill="var(--green)" />}
    </svg>
  );
}

export default function SupervisorDashboard() {
  const router = useRouter();
  const session = useMemo(() => getSupervisorSession(), []);

  const [ready, setReady] = useState(false);
  const [users, setUsers] = useState<LaberUser[]>([]);
  const [flagged, setFlagged] = useState<FlaggedEmployee[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [entries, setEntries] = useState<LaborEntry[]>([]);

  const loadAll = useCallback(async () => {
    try {
      const [u, f, n, e] = await Promise.all([
        api.get<LaberUser[]>("/labers"),
        api.get<FlaggedEmployee[]>("/flags"),
        api.get<Notification[]>("/notifications/supervisor"),
        api.get<LaborEntry[]>("/laborers"),
      ]);
      setUsers(u);
      setFlagged(f);
      setNotifications(n);
      setEntries(e);
    } catch {
      /* keep last known state on transient failure */
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!session) {
      router.replace("/risk-analyze/supervisor/login");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch + poll, not a derived-state loop
    loadAll();
    const interval = setInterval(loadAll, 15000); // light polling for a "live" feel
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function clearFlag(id: number) {
    await api.put(`/flags/${id}/clear`);
    loadAll();
  }

  async function markRead(id: number) {
    await api.put(`/notifications/${id}/read`);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  }

  function handleLogout() {
    clearSupervisorSession();
    router.push("/risk-analyze/supervisor/login");
  }

  const today = new Date().toISOString().slice(0, 10);
  const todaysEntries = entries.filter((e) => e.date === today);
  const employeeCount = users.filter((u) => u.role === "labor").length;
  const avgEfficiencyToday =
    todaysEntries.length > 0
      ? todaysEntries.reduce((sum, e) => sum + Number(e.efficiency), 0) / todaysEntries.length
      : null;
  const highRiskToday = todaysEntries.filter((e) => e.risk_level === "HIGH" || e.is_outlier).length;

  const employeeAnalytics = useMemo<EmployeeAnalytics[]>(() => {
    const grouped = new Map<number, LaborEntry[]>();
    for (const entry of entries) {
      const employeeEntries = grouped.get(entry.laborers_id) || [];
      employeeEntries.push(entry);
      grouped.set(entry.laborers_id, employeeEntries);
    }

    return Array.from(grouped.entries())
      .map(([id, employeeEntries]) => {
        const chronological = [...employeeEntries].sort(
          (a, b) => entryTimestamp(a).localeCompare(entryTimestamp(b)),
        );
        const newestFirst = [...chronological].reverse();
        const recentEfficiencies = newestFirst.slice(0, 6).map((entry) => Number(entry.efficiency));
        const trend: EmployeeTrend =
          recentEfficiencies.length < 6
            ? "NOT_ENOUGH_DATA"
            : recentEfficiencies.slice(0, 3).reduce((sum, value) => sum + value, 0) / 3 >
                recentEfficiencies.slice(3, 6).reduce((sum, value) => sum + value, 0) / 3
              ? "IMPROVING"
              : recentEfficiencies.slice(0, 3).reduce((sum, value) => sum + value, 0) / 3 <
                  recentEfficiencies.slice(3, 6).reduce((sum, value) => sum + value, 0) / 3
                ? "DECLINING"
                : "STABLE";
        const latest = newestFirst[0];
        const user = users.find((candidate) => candidate.id === id);
        const flaggedEmployee = flagged.some((candidate) => candidate.id === id);

        return {
          id,
          name: latest.laborer_name || user?.name || "Unknown employee",
          employee_code: latest.employee_code || user?.employee_code || "—",
          totalSubmissions: employeeEntries.length,
          todaySubmissions: employeeEntries.filter((entry) => entry.date === today).length,
          avgEfficiency:
            employeeEntries.reduce((sum, entry) => sum + Number(entry.efficiency), 0) / employeeEntries.length,
          trend,
          riskLevel: latest.risk_level,
          isOutlier: latest.is_outlier,
          isFlagged: flaggedEmployee,
          lastSubmittedAt: entryTimestamp(latest),
          recentEfficiencies,
        };
      })
      .sort((a, b) => riskRank(a) - riskRank(b) || a.avgEfficiency - b.avgEfficiency);
  }, [entries, flagged, today, users]);

  const [expandedEmployeeId, setExpandedEmployeeId] = useState<number | null>(null);

  if (!ready || !session) {
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
            <div className="eyebrow text-[#7fb2e8] mb-1">Floor Manager · {session.user.name}</div>
            <h1 className="display text-3xl text-white">Line floor, right now</h1>
          </div>
          <button
            onClick={handleLogout}
            className="mono text-xs text-[var(--ink-muted)] hover:text-white border border-[var(--ink-line)] rounded-full px-3 py-1.5"
          >
            Log out
          </button>
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

        <div className="grid lg:grid-cols-[1.3fr_1fr] gap-6 mb-6">
          {/* ---------------- Flagged employees ---------------- */}
          <div className="panel p-5">
            <div className="eyebrow text-[var(--ink-muted)] mb-4">Flagged employees</div>
            {flagged.length === 0 ? (
              <p className="text-sm text-[var(--ink-muted)]">No one is currently flagged. 🎉</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {flagged.map((f) => (
                  <li
                    key={f.id}
                    className="panel-raised px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-white font-medium text-sm">
                        {f.name} <span className="mono text-[var(--ink-muted)]">· {f.employee_code}</span>
                      </div>
                      <div className="text-xs text-[var(--ink-muted)] mt-0.5">{f.flag_reason}</div>
                    </div>
                    <button
                      onClick={() => clearFlag(f.id)}
                      className="mono text-xs text-white bg-[var(--green)]/80 hover:bg-[var(--green)] rounded-full px-3 py-1.5 shrink-0"
                    >
                      Clear flag
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ---------------- Notification feed ---------------- */}
          <div className="panel p-5">
            <div className="eyebrow text-[var(--ink-muted)] mb-4">Risk & flag feed</div>
            {notifications.length === 0 ? (
              <p className="text-sm text-[var(--ink-muted)]">No alerts yet.</p>
            ) : (
              <ul className="flex flex-col gap-3 max-h-72 overflow-y-auto scrollbar-thin pr-1">
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className={`text-sm border-l-2 pl-3 ${n.is_read ? "border-l-[var(--ink-line)]" : "border-l-[var(--red)]"}`}
                  >
                    <p className={n.is_read ? "text-[var(--ink-muted)]" : "text-white"}>{n.message}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-[var(--ink-muted)]">
                        {new Date(n.created_at).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {!n.is_read && (
                        <button
                          onClick={() => markRead(n.id)}
                          className="mono text-[10px] text-[var(--ink-muted)] hover:text-white"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ---------------- Employee-wise analytics ---------------- */}
        <div className="panel p-5">
          <div className="eyebrow text-[var(--ink-muted)] mb-4">Employee-wise analytics</div>
          {employeeAnalytics.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">No entries logged yet.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {employeeAnalytics.map((employee) => {
                const isExpanded = expandedEmployeeId === employee.id;
                return (
                  <button
                    type="button"
                    key={employee.id}
                    onClick={() => setExpandedEmployeeId(isExpanded ? null : employee.id)}
                    className="panel-raised p-4 text-left w-full hover:border-[var(--ink-muted)] transition-colors"
                    aria-expanded={isExpanded}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-white font-medium truncate">
                          {employee.name} <span className="mono text-xs text-[var(--ink-muted)]">· {employee.employee_code}</span>
                        </div>
                        <div className="mono text-[10px] text-[var(--ink-muted)] mt-1">
                          Last submission {employee.lastSubmittedAt.replace("T", " ").slice(0, 16)}
                        </div>
                      </div>
                      <RiskTag level={employee.riskLevel} outlier={employee.isOutlier} />
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-4">
                      <Metric label="Submissions" value={`${employee.totalSubmissions} / ${employee.todaySubmissions}`} detail="all / today" />
                      <Metric label="Avg efficiency" value={`${employee.avgEfficiency.toFixed(1)}%`} />
                      <Metric label="Trend" value={employee.trend.replaceAll("_", " ")} />
                    </div>
                    <div className="flex items-center justify-between mt-4 text-[10px] mono">
                      <span className={employee.isFlagged ? "text-[var(--red)]" : "text-[var(--ink-muted)]"}>
                        {employee.isFlagged ? "FLAGGED" : "Not flagged"}
                      </span>
                      <span className="text-[var(--ink-muted)]">{isExpanded ? "Hide trend" : "View trend"}</span>
                    </div>
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-[var(--ink-line)] flex items-center justify-between gap-4">
                        <span className="eyebrow text-[var(--ink-muted)]">Recent efficiency</span>
                        <Sparkline values={[...employee.recentEfficiencies].reverse()} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
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

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div>
      <div className="eyebrow text-[var(--ink-muted)] text-[9px]">{label}</div>
      <div className="led-digits text-lg text-white mt-1">{value}</div>
      {detail && <div className="mono text-[9px] text-[var(--ink-muted)]">{detail}</div>}
    </div>
  );
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
