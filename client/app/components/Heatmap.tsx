"use client";

export interface HeatmapProps {
  rowLabels: string[];
  colLabels: string[];
  values: (number | null)[][]; // rows x cols, 0-100 scale expected
  onCellClick?: (rowIndex: number, colIndex: number) => void;
  selectedRow?: number | null;
  formatValue?: (v: number) => string;
}

function colorForValue(v: number | null): string {
  if (v === null) return "transparent";
  const clamped = Math.max(0, Math.min(100, v));
  if (clamped < 25) return "rgba(16,185,129,0.10)";
  if (clamped < 50) return "rgba(16,185,129,0.26)";
  if (clamped < 75) return "rgba(16,185,129,0.46)";
  return "rgba(16,185,129,0.75)";
}

export function Heatmap({
  rowLabels,
  colLabels,
  values,
  onCellClick,
  selectedRow = null,
  formatValue,
}: HeatmapProps) {
  if (rowLabels.length === 0) {
    return (
      <div className="h-24 flex items-center justify-center text-[10px] font-mono text-zinc-300 dark:text-zinc-700">
        No data yet
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-1 text-[10px] font-mono">
        <thead>
          <tr>
            <th className="w-20" />
            {colLabels.map((c) => (
              <th
                key={c}
                className="px-1 pb-1.5 text-[9px] font-mono font-normal text-zinc-400 dark:text-zinc-500 uppercase whitespace-nowrap"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowLabels.map((r, ri) => (
            <tr key={r}>
              <td
                className={`pr-2 text-right whitespace-nowrap ${
                  selectedRow === ri
                    ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                    : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                {r}
              </td>
              {colLabels.map((c, ci) => {
                const v = values[ri]?.[ci] ?? null;
                return (
                  <td key={c} className="p-0">
                    <button
                      type="button"
                      onClick={() => onCellClick?.(ri, ci)}
                      disabled={!onCellClick}
                      title={
                        v !== null
                          ? `${r} \u00b7 ${c}: ${formatValue ? formatValue(v) : v}`
                          : "No data"
                      }
                      className={`w-12 h-8 flex items-center justify-center text-[9px] tabular-nums transition-all border border-zinc-100 dark:border-zinc-800/60 ${
                        onCellClick
                          ? "cursor-pointer hover:ring-1 hover:ring-emerald-400"
                          : ""
                      } ${selectedRow === ri ? "ring-1 ring-emerald-500" : ""}`}
                      style={{ backgroundColor: colorForValue(v) }}
                    >
                      {v !== null ? (
                        <span className="text-zinc-700 dark:text-zinc-200">
                          {formatValue ? formatValue(v) : Math.round(v)}
                        </span>
                      ) : (
                        <span className="text-zinc-300 dark:text-zinc-700">
                          &mdash;
                        </span>
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
