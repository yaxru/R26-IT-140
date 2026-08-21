"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError, type EmployeeUser } from "@/lib/risk-analyze/api";
import { saveEmployeeSession } from "@/lib/risk-analyze/session";

export default function EmployeeLoginPage() {
  const router = useRouter();
  const [employeeCode, setEmployeeCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // Employee login is ID-only — no password. See services/risk_analyze
      // POST /employee-login.
      const res = await api.post<{ token: string; user: EmployeeUser }>(
        "/employee-login",
        { employee_code: employeeCode.trim().toUpperCase() }
      );
      saveEmployeeSession(res);
      router.push("/risk-analyze/employee/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/risk-analyze" className="mono text-xs text-[var(--ink-muted)] hover:text-white mb-8 inline-block">
          ← back
        </Link>

        <div className="job-card">
          <div className="punch-holes">
            {Array.from({ length: 8 }).map((_, i) => (
              <span key={i} />
            ))}
          </div>
          <div className="job-card__body">
            <div className="eyebrow text-[var(--card-muted)] mb-2">Employee Access</div>
            <h1 className="display text-2xl mb-6">Punch in with your ID</h1>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-[var(--card-muted)] uppercase tracking-wide">
                  Employee ID
                </span>
                <input
                  className="mono border border-[var(--card-line)] bg-white/60 rounded-lg px-3 py-2.5 text-lg tracking-wider outline-none focus:border-[var(--amber)] focus:ring-2 focus:ring-[var(--amber)]/30"
                  placeholder="EMP001"
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value)}
                  autoFocus
                  required
                />
              </label>

              {error && (
                <div className="text-sm text-[#a5352a] bg-[var(--red-soft)] rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 bg-[var(--ink)] text-white rounded-lg py-3 font-semibold tracking-wide hover:bg-black transition-colors disabled:opacity-50"
              >
                {loading ? "Checking…" : "Start my shift"}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-xs text-[var(--ink-muted)] mt-6">
          No password needed — just your Employee ID. Don&apos;t have one yet?
          Ask your floor manager to register you.
        </p>
      </div>
    </main>
  );
}
