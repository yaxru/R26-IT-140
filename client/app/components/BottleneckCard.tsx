import type { Bottleneck } from "../types";

interface BottleneckCardProps {
  bottleneck: Bottleneck | null;
}

export function BottleneckCard({ bottleneck }: BottleneckCardProps) {
  if (!bottleneck) {
    return (
      <div className="bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800/60 p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono tracking-widest text-zinc-400 dark:text-zinc-500 uppercase">
            Station Status
          </span>
          <div className="w-16 h-4 bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
        </div>
        <div className="flex flex-col gap-3">
          <div className="w-36 h-10 bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          <div className="w-24 h-4 bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-auto">
          <div className="h-16 bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
          <div className="h-16 bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
        </div>
      </div>
    );
  }

  const wipPct = Math.min(100, (bottleneck.wip / 60) * 100);

  const hasProductivity =
    bottleneck.targeted_productivity !== null &&
    bottleneck.actual_productivity !== null;

  const gapPct = hasProductivity
    ? ((bottleneck.targeted_productivity! - bottleneck.actual_productivity!) /
        bottleneck.targeted_productivity!) *
      100
    : null;

  return (
    <div className="bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800/60 p-6 flex flex-col gap-5">
      {/* Eyebrow + live status */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono tracking-widest text-zinc-400 dark:text-zinc-500 uppercase">
          Station &middot; {bottleneck.required_skill}
        </span>
        {bottleneck.is_bottleneck ? (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 ring-1 ring-orange-200 dark:ring-orange-900/60 px-2.5 py-0.5">
            <span className="w-1.5 h-1.5 bg-orange-500 animate-pulse" />
            CRITICAL
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-200 dark:ring-emerald-900/60 px-2.5 py-0.5">
            <span className="w-1.5 h-1.5 bg-emerald-500" />
            ON TARGET
          </span>
        )}
      </div>

      {/* Station ID — big number, Guickly-style */}
      <div>
        <div className="text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 tabular-nums">
          {bottleneck.station_id}
        </div>
        {hasProductivity && gapPct !== null && (
          <div className="flex items-center gap-1.5 mt-2">
            <span
              className={`text-xs font-mono font-semibold ${
                gapPct >= 10
                  ? "text-orange-500"
                  : gapPct >= 5
                    ? "text-amber-500"
                    : "text-emerald-500"
              }`}
            >
              {gapPct >= 0 ? "\u25bc" : "\u25b2"} {Math.abs(gapPct).toFixed(1)}%
            </span>
            <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-600">
              vs target productivity
            </span>
          </div>
        )}
      </div>

      {/* Stat tiles — WIP + Productivity side by side */}
      <div className="grid grid-cols-2 gap-3 mt-auto">
        <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800/40 p-3.5">
          <div className="text-[9px] font-mono text-zinc-400 dark:text-zinc-600 uppercase tracking-wider mb-1.5">
            WIP Queue
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-zinc-800 dark:text-zinc-200">
            {bottleneck.wip}
            <span className="text-[10px] font-normal text-zinc-400 dark:text-zinc-600 ml-1">
              units
            </span>
          </div>
          <div className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 mt-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                wipPct > 75 ? "bg-orange-500" : "bg-emerald-500"
              }`}
              style={{ width: `${wipPct}%` }}
            />
          </div>
        </div>

        <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800/40 p-3.5">
          <div className="text-[9px] font-mono text-zinc-400 dark:text-zinc-600 uppercase tracking-wider mb-1.5">
            Productivity
          </div>
          {hasProductivity ? (
            <>
              <div className="text-xl font-bold font-mono tabular-nums text-zinc-800 dark:text-zinc-200">
                {((bottleneck.actual_productivity ?? 0) * 100).toFixed(0)}
                <span className="text-[10px] font-normal text-zinc-400 dark:text-zinc-600 ml-1">
                  / {((bottleneck.targeted_productivity ?? 0) * 100).toFixed(0)}
                  %
                </span>
              </div>
              <div className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 mt-2 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      ((bottleneck.actual_productivity ?? 0) /
                        (bottleneck.targeted_productivity ?? 1)) *
                        100,
                    )}%`,
                  }}
                />
              </div>
            </>
          ) : (
            <div className="text-xl font-bold font-mono text-zinc-300 dark:text-zinc-700">
              &mdash;
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
