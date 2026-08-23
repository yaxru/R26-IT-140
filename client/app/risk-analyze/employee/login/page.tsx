"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function EmployeeLoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/risk-analyze/employee/dashboard");
  }, [router]);

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

            <p className="text-sm text-[var(--card-muted)]">Opening your digital job card…</p>
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
