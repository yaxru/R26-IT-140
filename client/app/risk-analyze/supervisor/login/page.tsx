"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError, type SupervisorUser } from "@/lib/risk-analyze/api";
import { saveSupervisorSession } from "@/lib/risk-analyze/session";

export default function SupervisorLoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: SupervisorUser }>("/login", {
        name,
        password,
      });
      saveSupervisorSession(res);
      router.push("/risk-analyze/supervisor/dashboard");
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

        <div className="panel p-7">
          <div className="eyebrow text-[#7fb2e8] mb-2">Floor Manager / Supervisor Access</div>
          <h1 className="display text-2xl text-white mb-6">Open the control room</h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-[var(--ink-muted)] uppercase tracking-wide">
                Name
              </span>
              <input
                className="border border-[var(--ink-line)] bg-[var(--ink-panel-2)] text-white rounded-lg px-3 py-2.5 outline-none focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/30"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-[var(--ink-muted)] uppercase tracking-wide">
                Password
              </span>
              <input
                type="password"
                className="border border-[var(--ink-line)] bg-[var(--ink-panel-2)] text-white rounded-lg px-3 py-2.5 outline-none focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/30"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>

            {error && (
              <div className="text-sm text-[#f5b4ab] bg-[var(--red)]/15 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 bg-[var(--blue)] text-white rounded-lg py-3 font-semibold tracking-wide hover:brightness-110 transition disabled:opacity-50"
            >
              {loading ? "Checking…" : "Enter dashboard"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
