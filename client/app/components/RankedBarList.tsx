export interface RankedBarItem {
  id: string;
  label: string;
  sublabel?: string;
  value: number;
  displayValue?: string;
  accent?: "emerald" | "orange" | "amber" | "zinc";
}

interface RankedBarListProps {
  items: RankedBarItem[];
  maxValue?: number;
}

const ACCENT_BAR: Record<string, string> = {
  emerald: "bg-emerald-500",
  orange: "bg-orange-400",
  amber: "bg-amber-400",
  zinc: "bg-zinc-500",
};

const ACCENT_TEXT: Record<string, string> = {
  emerald: "text-emerald-600 dark:text-emerald-400",
  orange: "text-orange-600 dark:text-orange-400",
  amber: "text-amber-600 dark:text-amber-400",
  zinc: "text-zinc-600 dark:text-zinc-400",
};

export function RankedBarList({ items, maxValue }: RankedBarListProps) {
  const max = maxValue ?? Math.max(1, ...items.map((i) => i.value));

  if (items.length === 0) {
    return (
      <div className="h-24 flex items-center justify-center text-[10px] font-mono text-zinc-300 dark:text-zinc-700">
        No data yet
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {items.map((item, idx) => {
        const pct = Math.min(100, (item.value / max) * 100);
        const accent = item.accent ?? "emerald";
        return (
          <div
            key={item.id}
            className="flex items-center gap-3 py-2 border-b border-zinc-100 dark:border-zinc-800/40 last:border-b-0"
          >
            <span className="w-5 shrink-0 text-[10px] font-mono text-zinc-400 dark:text-zinc-600 tabular-nums">
              {String(idx + 1).padStart(2, "0")}
            </span>
            <div className="w-28 sm:w-36 shrink-0 min-w-0">
              <p className="truncate text-xs font-mono text-zinc-600 dark:text-zinc-300">
                {item.label}
              </p>
              {item.sublabel && (
                <p className="truncate text-[9px] font-mono text-zinc-400 dark:text-zinc-600">
                  {item.sublabel}
                </p>
              )}
            </div>
            <div className="flex-1 h-4 bg-zinc-100 dark:bg-zinc-900 relative overflow-hidden">
              <div
                className={`h-full ${ACCENT_BAR[accent]} transition-all duration-500`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span
              className={`w-16 shrink-0 text-right text-xs font-mono font-semibold tabular-nums ${ACCENT_TEXT[accent]}`}
            >
              {item.displayValue ?? item.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
