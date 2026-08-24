import Link from "next/link";

export default function RiskAnalyzeHome() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-3xl">
        <div className="eyebrow text-[var(--amber)] mb-3">Line Pulse · Real-Time Risk Detection</div>
        <h1 className="display text-4xl md:text-5xl text-white mb-4">
          The Digital Job Card
        </h1>
        <p className="text-[var(--ink-muted)] max-w-xl mb-12 leading-relaxed">
          Every hour, every station, logged the moment it happens — instead of
          a whiteboard nobody reads until the shift is over.
        </p>

        <div className="grid sm:grid-cols-2 gap-5">
          <Link
            href="/risk-analyze/employee/login"
            className="group panel p-7 flex flex-col justify-between hover:border-[var(--amber)] transition-colors"
          >
            <div>
              <div className="mono text-xs text-[var(--ink-muted)] mb-2">01</div>
              <h2 className="display text-2xl text-white mb-2">Employee</h2>
              <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
                Punch in your ID, log your hourly output, see your efficiency
                the moment you submit.
              </p>
            </div>
            <div className="mt-8 text-sm text-[var(--amber)] font-semibold flex items-center gap-1">
              Log your hour <span className="transition-transform group-hover:translate-x-1">→</span>
            </div>
          </Link>

          <Link
            href="/risk-analyze/supervisor/login"
            className="group panel p-7 flex flex-col justify-between hover:border-[var(--blue)] transition-colors"
          >
            <div>
              <div className="mono text-xs text-[var(--ink-muted)] mb-2">02</div>
              <h2 className="display text-2xl text-white mb-2">Floor Manager / Supervisor</h2>
              <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
                Watch the floor: risk alerts, flagged employees, live
                efficiency across every line.
              </p>
            </div>
            <div className="mt-8 text-sm text-[#7fb2e8] font-semibold flex items-center gap-1">
              Open dashboard <span className="transition-transform group-hover:translate-x-1">→</span>
            </div>
          </Link>
        </div>

        <p className="text-center text-xs text-[var(--ink-muted)] mt-10">
          Looking for the main StitchFlow dashboard?{" "}
          <Link href="/login" className="text-[var(--amber)] hover:underline">
            Supervisor login →
          </Link>
        </p>
      </div>
    </main>
  );
}
