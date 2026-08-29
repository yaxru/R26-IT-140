"use client";

import type { Bottleneck, SkillMatrixEntry } from "@/app/(dashboard)/types";
import { HoverTooltip } from "./HoverTooltip";

interface StationWorkersGridProps {
  stations: Bottleneck[];
  skillMatrix: SkillMatrixEntry[];
}

const LEGEND: { min: number; label: string; bg: string }[] = [
  { min: 0,  label: "<60%",   bg: "rgba(26,124,75,0.12)" },
  { min: 60, label: "60-75%", bg: "rgba(26,124,75,0.30)" },
  { min: 75, label: "75-90%", bg: "rgba(26,124,75,0.55)" },
  { min: 90, label: "90%+",   bg: "rgba(26,124,75,0.85)" },
];

function colorForEfficiency(pct: number): string {
  if (pct >= 90) return LEGEND[3].bg;
  if (pct >= 75) return LEGEND[2].bg;
  if (pct >= 60) return LEGEND[1].bg;
  return LEGEND[0].bg;
}

export function StationWorkersGrid({ stations, skillMatrix }: StationWorkersGridProps) {
  if (stations.length === 0) {
    return (
      <div className="h-24 flex items-center justify-center text-[11px] text-[#9A9A9A] dark:text-zinc-700">
        No station data yet
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mb-4 pb-3 border-b border-[#F1F1F1] dark:border-zinc-800/40">
        <span className="text-[10px] font-medium text-[#9A9A9A] dark:text-zinc-600 uppercase tracking-wider">
          Efficiency
        </span>
        {LEGEND.map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className="w-3 h-3 shrink-0 border border-[#D4D4D4] dark:border-zinc-700" style={{ backgroundColor: l.bg }} />
            <span className="text-[10px] text-[#9A9A9A] dark:text-zinc-500">{l.label}</span>
          </div>
        ))}
      </div>

      {/* One row per station */}
      <div className="flex flex-r divide-y divide-[#F1F1F1] dark:divide-zinc-800/40">
        {stations.map((station) => {
          const workers = skillMatrix.filter((s) => s.machine_type === station.required_skill);

          return (
            <div
              key={station.station_id}
              className="flex flex-col  gap-2 sm:gap-4 py-3"
            >
              {/* Row label */}
              <div className="flex items-center gap-2 sm:w-44 shrink-0">
                <span
                  className={`w-1.5 h-1.5 shrink-0 ${station.is_bottleneck ? "bg-[#CE8E33] animate-pulse" : "bg-[#1A7C4B]"}`}
                  aria-hidden="true"
                />
                <span className="text-xs font-semibold text-[#333333] dark:text-zinc-200">
                  {station.station_id}
                </span>
                <span className="text-[10px] text-[#9A9A9A] dark:text-zinc-600 truncate">
                  {station.required_skill} · {workers.length}
                </span>
              </div>

              {/* Worker blocks */}
              {workers.length > 0 ? (
                <div className="flex flex-wrap gap-1 flex-1">
                  {workers.map((w) => {
                    // @ts-ignore - Safely access name and pin from the updated backend response
                    const workerName = w.operator_name || w.operator_id;
                    // @ts-ignore
                    const workerPin = w.worker_pin || "PIN";

                    return (
                      <HoverTooltip
                        key={w.operator_id}
                        content={
                          <>
                            <div className="font-semibold text-zinc-100 mb-1">
                              {workerName}
                              <span className="ml-1.5 text-[10px] text-zinc-400 font-normal font-mono">
                                ({workerPin})
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3 text-zinc-400">
                              <span>Grade {w.proficiency_grade}</span>
                              <span className="text-[#47966F] font-semibold">{w.efficiency_pct.toFixed(0)}%</span>
                            </div>
                          </>
                        }
                      >
                        <div
                          className="w-6 h-6 cursor-default border border-transparent hover:border-[#D4D4D4] dark:hover:border-zinc-600 transition-colors"
                          style={{ backgroundColor: colorForEfficiency(w.efficiency_pct) }}
                          aria-label={`${workerName}, Grade ${w.proficiency_grade}, ${w.efficiency_pct.toFixed(0)}% efficiency`}
                        />
                      </HoverTooltip>
                    );
                  })}
                </div>
              ) : (
                <div className="text-[11px] text-[#C6C6C6] dark:text-zinc-700 flex-1">
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