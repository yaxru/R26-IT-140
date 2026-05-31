import type { Bottleneck } from "../types";

interface StationSelectorProps {
  stations: Bottleneck[];
  active: Bottleneck | null;
  onSelect: (b: Bottleneck) => void;
}

export function StationSelector({
  stations,
  active,
  onSelect,
}: StationSelectorProps) {
  if (stations.length === 0) {
    return (
      <div className="flex gap-2 flex-wrap">
        {[28, 24, 32].map((w, i) => (
          <div
            key={i}
            className={`h-9 bg-zinc-100 dark:bg-zinc-800/60 animate-pulse`}
            style={{ width: `${w * 4}px` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-2 flex-wrap">
      {stations.map((b) => {
        const isActive = !!active && active.station_id === b.station_id;
        return (
          <button
            key={b.station_id}
            onClick={() => onSelect(b)}
            className={`group flex items-center gap-2 px-4 py-2 text-xs font-mono tracking-wider uppercase transition-all duration-200 cursor-pointer ${
              isActive
                ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-sm"
                : "bg-zinc-100 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700/80 hover:text-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            {b.station_id}
            <span
              className={`inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold transition-colors ${
                isActive
                  ? "bg-white/20 dark:bg-black/20 text-white dark:text-zinc-900"
                  : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {b.wip}
            </span>
          </button>
        );
      })}
    </div>
  );
}
