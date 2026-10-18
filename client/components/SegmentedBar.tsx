"use client";

import { HoverTooltip } from "./HoverTooltip";

export interface SegmentedBarItem {
  id: string;
  label: string;
  value: number;
  displayValue?: string;
  color?: string; // hex color; falls back to palette by index
}

interface SegmentedBarProps {
  items: SegmentedBarItem[];
  height?: number;
}

const PALETTE = ["#10b981", "#f59e0b", "#71717a", "#3b82f6", "#a1a1aa"];

export function SegmentedBar({ items, height = 40 }: SegmentedBarProps) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;

  if (items.length === 0) {
    return (
      <div className="h-10 flex items-center justify-center text-[10px] font-mono text-zinc-300 dark:text-zinc-700">
        No data yet
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* The bar itself */}
      <div
        className="flex w-full overflow-hidden"
        style={{ height }}
        role="img"
        aria-label="Segmented breakdown"
      >
        {items.map((item, i) => {
          const pct = (item.value / total) * 100;
          if (pct <= 0) return null;
          const color = item.color ?? PALETTE[i % PALETTE.length];
          return (
            <HoverTooltip
              key={item.id}
              className="h-full shrink-0 first:border-l-0 border-l border-white/20 dark:border-black/30"
              style={{ width: `${pct}%` }}
              content={
                <>
                  <div className="flex items-center gap-1.5 font-semibold text-zinc-100 mb-1">
                    <span
                      className="w-2 h-2 shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    {item.label}
                  </div>
                  <div className="flex items-center justify-between gap-3 text-zinc-400">
                    <span>{item.displayValue ?? item.value}</span>
                    <span className="text-emerald-400 font-semibold">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                </>
              }
            >
              <div
                className="w-full h-full flex items-center justify-center overflow-hidden"
                style={{ backgroundColor: color }}
              >
                {pct > 12 && (
                  <span className="text-[10px] font-mono font-semibold text-white truncate px-1">
                    {pct.toFixed(0)}%
                  </span>
                )}
              </div>
            </HoverTooltip>
          );
        })}
      </div>

      {/* Legend / breakdown rows */}
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {items.map((item, i) => {
          const pct = (item.value / total) * 100;
          const color = item.color ?? PALETTE[i % PALETTE.length];
          return (
            <div key={item.id} className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 truncate">
                {item.label}
              </span>
              <span className="text-[10px] font-mono font-semibold text-zinc-700 dark:text-zinc-200 tabular-nums">
                {item.displayValue ?? item.value} · {pct.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
