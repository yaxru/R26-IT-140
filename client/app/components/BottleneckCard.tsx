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
            Active Bottleneck
          </span>
          <div className="w-16 h-4 bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
        </div>
        <div className="flex flex-col gap-3">
          <div className="w-36 h-10 bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          <div className="w-24 h-4 bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
        </div>
        <div className="mt-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="w-16 h-3 bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
            <div className="w-10 h-6 bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          </div>
          <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-900" />
          <div className="flex justify-between mt-1.5">
            <div className="w-4 h-2 bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
            <div className="w-16 h-2 bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
            <div className="w-10 h-2 bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          </div>
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono tracking-widest text-zinc-400 dark:text-zinc-500 uppercase">
          Station Status
        </span>
        {bottleneck.is_bottleneck ? (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 ring-1 ring-red-200 dark:ring-red-900/60 px-2.5 py-0.5">
            <span className="w-1.5 h-1.5 bg-red-500 animate-pulse" />
            CRITICAL
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-200 dark:ring-emerald-900/60 px-2.5 py-0.5">
            <span className="w-1.5 h-1.5 bg-emerald-500" />
            ON TARGET
          </span>
        )}
      </div>

      {/* Station ID */}
      <div>
        <div className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          {bottleneck.station_id}
        </div>
        <div className="flex items-center gap-2 mt-2.5">
          <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
            Skill required
          </span>
          <span className="text-[11px] font-mono font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5">
            {bottleneck.required_skill}
          </span>
        </div>
      </div>

      {/* WIP bar */}
      <div className="mt-auto">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
            WIP Queue
          </span>
          <span className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 tabular-nums">
            {bottleneck.wip}
            <span className="text-xs font-normal text-zinc-400 dark:text-zinc-600 ml-1">
              units
            </span>
          </span>
        </div>
        <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
          <div
            className="h-full bg-linear-to-r from-red-500 to-rose-400 transition-all duration-500"
            style={{ width: `${wipPct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-[9px] font-mono text-zinc-400 dark:text-zinc-700">
          <span>0</span>
          <span className={wipPct > 75 ? "text-red-500 dark:text-red-500" : ""}>
            {wipPct.toFixed(0)}% capacity
          </span>
          <span>60 max</span>
        </div>
      </div>

      {/* Productivity gap — shown only when DB has the columns */}
      {hasProductivity && gapPct !== null && (
        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/40">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Productivity Gap
            </span>
            <span
              className={`text-sm font-bold font-mono tabular-nums ${
                gapPct >= 10
                  ? "text-red-500"
                  : gapPct >= 5
                    ? "text-amber-500"
                    : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              −{gapPct.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between text-[9px] font-mono text-zinc-400 dark:text-zinc-600">
            <span>
              Target{" "}
              {((bottleneck.targeted_productivity ?? 0) * 100).toFixed(0)}%
            </span>
            <span>
              Actual {((bottleneck.actual_productivity ?? 0) * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
