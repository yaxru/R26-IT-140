import type { Bottleneck } from "@/app/(dashboard)/types";

interface StationSelectorProps {
  stations: Bottleneck[];
  active: Bottleneck | null;
  onSelect: (b: Bottleneck) => void;
}

// Fixed-height skeleton chips — prevents layout shift before data loads
function SkeletonChips() {
  return (
    <div role="status" aria-label="Loading stations" className="flex gap-2 flex-wrap min-h-[36px]">
      {[80, 96, 80, 112, 80].map((w, i) => (
        <div
          key={i}
          className="h-9 rounded-lg bg-[#F1F1F1] dark:bg-zinc-800/60 animate-pulse"
          style={{ width: `${w}px` }}
        />
      ))}
      <span className="sr-only">Loading stations…</span>
    </div>
  );
}

export function StationSelector({ stations, active, onSelect }: StationSelectorProps) {
  if (stations.length === 0) return <SkeletonChips />;

  return (
    <nav aria-label="Station selector" className="flex gap-2 flex-wrap min-h-[36px]">
      {stations.map((b) => {
        const isActive = !!active && active.station_id === b.station_id;
        const isCritical = b.is_bottleneck;
        return (
          <button
            key={b.station_id}
            onClick={() => onSelect(b)}
            aria-pressed={isActive}
            aria-label={`${b.station_id}${isCritical ? " — bottleneck" : ""}, WIP ${b.wip}`}
            className={`
              relative flex items-center gap-2 px-4 h-9 text-xs font-semibold tracking-wide
              rounded-lg border transition-all duration-150 cursor-pointer focus-visible:outline-2
              focus-visible:outline-brand-600 focus-visible:outline-offset-2
              ${isActive
                ? "bg-[#242424] dark:bg-[#F1F1F1] text-white dark:text-[#242424] border-transparent shadow-sm"
                : isCritical
                  ? "bg-[#F8F0E4] dark:bg-amber-950/20 text-[#A77329] dark:text-[#E1BA82] border-[#EACFA9] dark:border-amber-800/40 hover:bg-[#F4E5D1] dark:hover:bg-amber-950/30"
                  : "bg-white dark:bg-zinc-900 text-[#5F5F5F] dark:text-zinc-400 border-[#EAEAEA] dark:border-zinc-800 hover:bg-[#F8F8F8] dark:hover:bg-zinc-800 hover:text-[#242424] dark:hover:text-zinc-200"
              }
            `}
          >
            {isCritical && !isActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#CE8E33] animate-pulse shrink-0" aria-hidden="true" />
            )}
            <span>{b.station_id}</span>
            <span
              className={`
                inline-flex items-center justify-center min-w-[20px] h-5 px-1 text-[10px] font-bold
                rounded-md tabular-nums
                ${isActive
                  ? "bg-white/20 dark:bg-black/20"
                  : isCritical
                    ? "bg-[#EACFA9]/60 dark:bg-amber-900/40 text-[#A77329] dark:text-[#E1BA82]"
                    : "bg-[#F1F1F1] dark:bg-zinc-800 text-[#9A9A9A] dark:text-zinc-500"
                }
              `}
            >
              {b.wip}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
