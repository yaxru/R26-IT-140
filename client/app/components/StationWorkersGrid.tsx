"use client";

import type { Bottleneck, SkillMatrixEntry } from "../types";
import { HoverTooltip } from "./HoverTooltip";

interface StationWorkersGridProps {
  stations: Bottleneck[];
  skillMatrix: SkillMatrixEntry[];
}

const LEGEND: { min: number; label: string; color: string }[] = [
  { min: 0, label: "<60%", color: "rgba(16,185,129,0.15)" },
  { min: 60, label: "60–75%", color: "rgba(16,185,129,0.32)" },
  { min: 75, label: "75–90%", color: "rgba(16,185,129,0.55)" },
  { min: 90, label: "90%+", color: "rgba(16,185,129,0.85)" },
];

function colorForEfficiency(pct: number): string {
  if (pct >= 90) return LEGEND[3].color;
  if (pct >= 75) return LEGEND[2].color;
  if (pct >= 60) return LEGEND[1].color;
  return LEGEND[0].color;
}

/**
 * One row per station/line, each showing that station's own qualified
 * workers as a horizontal strip of blocks — no shared x-axis, no static
 * labels, and no re-sorting (workers stay in their natural order). Every
 * value (operator, grade, efficiency %) only appears on hover.
 */
export function StationWorkersGrid({
  stations,
  skillMatrix,
}: StationWorkersGridProps) {
  if (stations.length === 0) {
    return (
      <div className="h-24 flex items-center justify-center text-[10px] font-mono text-zinc-300 dark:text-zinc-700">
        No station data yet
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Color legend — what each intensity means */}
      <div className="flex flex-wrap items-center gap-4 mb-4 pb-3 border-b border-zinc-100 dark:border-zinc-800/40">
        <span className="text-[9px] font-mono text-zinc-400 dark:text-zinc-600 uppercase tracking-wider">
          Efficiency
        </span>
        {LEGEND.map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 shrink-0"
              style={{ backgroundColor: l.color }}
            />
            <span className="text-[9px] font-mono text-zinc-500 dark:text-zinc-400">
              {l.label}
            </span>
          </div>
        ))}
      </div>

      {/* One row per station/line */}
      <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800/40">
        {stations.map((station) => {
          const workers = skillMatrix.filter(
            (s) => s.machine_type === station.required_skill,
          );

          return (
            <div
              key={station.station_id}
              className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-3"
            >
              {/* Row label */}
              <div className="flex items-center gap-2 sm:w-40 shrink-0">
                <span className="text-xs font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                  {station.station_id}
                </span>
                {station.is_bottleneck && (
                  <span className="w-1.5 h-1.5 bg-orange-500 animate-pulse shrink-0" />
                )}
                <span className="text-[9px] font-mono text-zinc-400 dark:text-zinc-600 truncate">
                  {station.required_skill} &middot; {workers.length}
                </span>
              </div>

              {/* Worker blocks — natural order, no sorting */}
              {workers.length > 0 ? (
                <div className="flex flex-wrap gap-1 flex-1">
                  {workers.map((w) => (
                    <HoverTooltip
                      key={w.operator_id}
                      content={
                        <>
                          <div className="font-semibold text-zinc-100 mb-1">
                            {w.operator_id}
                          </div>
                          <div className="flex items-center justify-between gap-3 text-zinc-400">
                            <span>Grade {w.proficiency_grade}</span>
                            <span className="text-emerald-400 font-semibold">
                              {w.efficiency_pct.toFixed(0)}%
                            </span>
                          </div>
                        </>
                      }
                    >
                      <div
                        className="w-6 h-6 cursor-default transition-transform hover:scale-110"
                        style={{
                          backgroundColor: colorForEfficiency(w.efficiency_pct),
                        }}
                      />
                    </HoverTooltip>
                  ))}
                </div>
              ) : (
                <div className="text-[9px] font-mono text-zinc-300 dark:text-zinc-700 flex-1">
                  No qualified operators
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

