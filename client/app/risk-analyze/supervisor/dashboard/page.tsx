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

        {/* ---------------- All entries table ---------------- */}
        <div className="panel p-5 overflow-x-auto scrollbar-thin">
          <div className="eyebrow text-[var(--ink-muted)] mb-4">Live entries</div>
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[var(--ink-muted)] border-b border-[var(--ink-line)]">
                <th className="py-2 pr-3">Employee</th>
                <th className="py-2 pr-3">Date / time</th>
                <th className="py-2 pr-3">Efficiency</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Predicted</th>
                <th className="py-2 pr-3">Risk</th>
                <th className="py-2 pr-3">Downtime reason</th>
              </tr>
            </thead>
            <tbody>
              {entries.slice(0, 25).map((e) => (
                <tr key={e.id} className="border-b border-[var(--ink-line)]/50">
                  <td className="py-2.5 pr-3 text-white">
                    {e.laborer_name} <span className="mono text-[var(--ink-muted)]">· {e.employee_code}</span>
                  </td>
                  <td className="py-2.5 pr-3 mono text-[var(--ink-muted)]">
                    {e.date} {e.time?.slice(0, 5)}
                  </td>
                  <td className="py-2.5 pr-3 mono text-white">{Number(e.efficiency).toFixed(1)}%</td>
                  <td className="py-2.5 pr-3">
                    <StatusTag status={e.status} />
                  </td>
                  <td className="py-2.5 pr-3 mono text-[var(--ink-muted)]">
                    {e.predicted_output != null ? Number(e.predicted_output).toFixed(0) : "—"}
                  </td>
                  <td className="py-2.5 pr-3">
                    <RiskTag level={e.risk_level} outlier={e.is_outlier} />
                  </td>
                  <td className="py-2.5 pr-3 text-[var(--ink-muted)]">{e.downtime_reason || "—"}</td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-[var(--ink-muted)]">
                    No entries logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
