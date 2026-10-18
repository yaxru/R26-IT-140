import type { Bottleneck } from "@/app/(dashboard)/types";

interface BottleneckCardProps {
  bottleneck: Bottleneck | null;
}

// Fixed skeleton that matches exact layout of the real card — zero layout shift
function Skeleton() {
  return (
    <div className="bg-white dark:bg-[#111113] border border-[#EAEAEA] dark:border-zinc-800/60 rounded-xl p-6 flex flex-col h-full min-h-[220px]">
      {/* Eyebrow row */}
      <div className="flex items-center justify-between mb-6">
        <div className="h-3 w-28 bg-[#F1F1F1] dark:bg-zinc-800 rounded animate-pulse" />
        <div className="h-5 w-16 bg-[#F1F1F1] dark:bg-zinc-800 rounded-full animate-pulse" />
      </div>
      {/* Big number */}
      <div className="mb-2">
        <div className="h-12 w-36 bg-[#F1F1F1] dark:bg-zinc-800 rounded animate-pulse mb-2" />
        <div className="h-4 w-24 bg-[#F1F1F1] dark:bg-zinc-800 rounded animate-pulse" />
      </div>
      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 mt-auto pt-4">
        <div className="h-20 bg-[#F8F8F8] dark:bg-zinc-900 rounded-lg animate-pulse" />
        <div className="h-20 bg-[#F8F8F8] dark:bg-zinc-900 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}

export function BottleneckCard({ bottleneck }: BottleneckCardProps) {
  if (!bottleneck) return <Skeleton />;

  const wipPct = Math.min(100, (bottleneck.wip / 60) * 100);
  const hasProductivity =
    bottleneck.targeted_productivity !== null &&
    bottleneck.actual_productivity !== null;
  const gapPct = hasProductivity
    ? ((bottleneck.targeted_productivity! - bottleneck.actual_productivity!) /
        bottleneck.targeted_productivity!) * 100
    : null;

  const isCritical = bottleneck.is_bottleneck;

  return (
    <article
      aria-label={`Station ${bottleneck.station_id} — ${isCritical ? "critical bottleneck" : "on target"}`}
      className="bg-white dark:bg-[#111113] border border-[#EAEAEA] dark:border-zinc-800/60 rounded-xl p-6 flex flex-col h-full min-h-[220px]"
    >
      {/* Eyebrow + badge */}
      <div className="flex items-center justify-between mb-5">
        <span className="text-[11px] font-medium tracking-widest text-[#9A9A9A] dark:text-zinc-500 uppercase">
          {bottleneck.required_skill}
        </span>
        {isCritical ? (
          <span
            role="status"
            aria-live="polite"
            className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase text-amber-brand-700 dark:text-[#E1BA82] bg-[#F8F0E4] dark:bg-amber-950/30 border border-[#EACFA9] dark:border-amber-800/40 px-2.5 py-1 rounded-full"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#CE8E33] animate-pulse" aria-hidden="true" />
            Critical
          </span>
        ) : (
          <span
            role="status"
            className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/30 border border-brand-100 dark:border-brand-800/40 px-2.5 py-1 rounded-full"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-brand-600" aria-hidden="true" />
            On Target
          </span>
        )}
      </div>

      {/* Station ID — big display number */}
      <div className="mb-5">
        <h2 className="text-4xl font-bold tracking-tight text-[#242424] dark:text-zinc-100 tabular-nums leading-none">
          {bottleneck.station_id}
        </h2>
        {hasProductivity && gapPct !== null && (
          <p className="flex items-center gap-1.5 mt-2">
            <span
              className={`text-xs font-semibold tabular-nums ${
                gapPct >= 10
                  ? "text-[#CE8E33]"
                  : gapPct >= 5
                    ? "text-[#D7A45A]"
                    : "text-brand-600 dark:text-brand-400"
              }`}
            >
              {gapPct >= 0 ? "▼" : "▲"} {Math.abs(gapPct).toFixed(1)}%
            </span>
            <span className="text-[11px] text-[#9A9A9A] dark:text-zinc-600">
              vs target
            </span>
          </p>
        )}
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 mt-auto">
        {/* WIP */}
        <div className="bg-[#F8F8F8] dark:bg-zinc-900/60 border border-[#F1F1F1] dark:border-zinc-800/40 rounded-lg p-3.5">
          <p className="text-[10px] font-medium text-[#9A9A9A] dark:text-zinc-600 uppercase tracking-wider mb-2">
            WIP Queue
          </p>
          <p className="text-xl font-bold tabular-nums text-[#333333] dark:text-zinc-200">
            {bottleneck.wip}
            <span className="text-[10px] font-normal text-[#9A9A9A] dark:text-zinc-600 ml-1">
              units
            </span>
          </p>
          <div
            role="progressbar"
            aria-valuenow={Math.round(wipPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="WIP queue fill level"
            className="w-full h-1 bg-[#EAEAEA] dark:bg-zinc-800 mt-2.5 rounded-full overflow-hidden"
          >
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${wipPct > 75 ? "bg-[#CE8E33]" : "bg-brand-600"}`}
              style={{ width: `${wipPct}%` }}
            />
          </div>
        </div>

        {/* Productivity */}
        <div className="bg-[#F8F8F8] dark:bg-zinc-900/60 border border-[#F1F1F1] dark:border-zinc-800/40 rounded-lg p-3.5">
          <p className="text-[10px] font-medium text-[#9A9A9A] dark:text-zinc-600 uppercase tracking-wider mb-2">
            Productivity
          </p>
          {hasProductivity ? (
            <>
              <p className="text-xl font-bold tabular-nums text-[#333333] dark:text-zinc-200">
                {((bottleneck.actual_productivity ?? 0) * 100).toFixed(0)}
                <span className="text-[10px] font-normal text-[#9A9A9A] dark:text-zinc-600 ml-1">
                  / {((bottleneck.targeted_productivity ?? 0) * 100).toFixed(0)}%
                </span>
              </p>
              <div
                role="progressbar"
                aria-valuenow={Math.round(
                  ((bottleneck.actual_productivity ?? 0) /
                    (bottleneck.targeted_productivity ?? 1)) * 100
                )}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Productivity ratio"
                className="w-full h-1 bg-[#EAEAEA] dark:bg-zinc-800 mt-2.5 rounded-full overflow-hidden"
              >
                <div
                  className="h-full bg-brand-600 rounded-full transition-[width] duration-500"
                  style={{
                    width: `${Math.min(100, ((bottleneck.actual_productivity ?? 0) / (bottleneck.targeted_productivity ?? 1)) * 100)}%`,
                  }}
                />
              </div>
            </>
          ) : (
            <p className="text-xl font-bold text-[#D4D4D4] dark:text-zinc-700">&mdash;</p>
          )}
        </div>
      </div>
    </article>
  );
}
