"use client";

import type { Bottleneck } from "../types";

interface OverviewAnalyticsProps {
  stations: Bottleneck[];
}

export function OverviewAnalytics({ stations }: OverviewAnalyticsProps) {
  // ── Stage Load Breakdown (Derived or Standard garment production stages) ──
  const stages = [
    {
      name: "Cutting & Preparation",
      code: "PREP",
      stationsCount: 2,
      wip: stations.slice(0, 2).reduce((s, b) => s + b.wip, 0) || 45,
      maxCap: 100,
    },
    {
      name: "Sub-Assembly",
      code: "SUB",
      stationsCount: 3,
      wip: stations.slice(2, 5).reduce((s, b) => s + b.wip, 0) || 72,
      maxCap: 120,
    },
    {
      name: "Main Sewing Line",
      code: "SEW",
      stationsCount: 4,
      wip: stations.slice(5, 9).reduce((s, b) => s + b.wip, 0) || 98,
      maxCap: 150,
    },
    {
      name: "Ironing & Finishing",
      code: "FIN",
      stationsCount: 2,
      wip: stations.slice(9, 11).reduce((s, b) => s + b.wip, 0) || 30,
      maxCap: 80,
    },
    {
      name: "QC & Final Inspection",
      code: "QC",
      stationsCount: 1,
      wip: stations.slice(11, 12).reduce((s, b) => s + b.wip, 0) || 18,
      maxCap: 50,
    },
  ];

  // ── Shift Hourly Production Pace (08:00 - 16:00) ──
  const shiftHours = [
    { hour: "08:00", actual: 140, target: 150, status: "on-track" },
    { hour: "09:00", actual: 155, target: 150, status: "exceeded" },
    { hour: "10:00", actual: 148, target: 150, status: "on-track" },
    { hour: "11:00", actual: 132, target: 150, status: "lagging" },
    { hour: "12:00", actual: 95, target: 100, status: "lunch" },
    { hour: "13:00", actual: 152, target: 150, status: "exceeded" },
    { hour: "14:00", actual: 138, target: 150, status: "lagging" },
    { hour: "15:00", actual: 145, target: 150, status: "on-track" },
  ];

  return (
    <div className="flex flex-col lg:flex-row">
      {/* ── Left Column: Line Productivity Comparison Bar Matrix ── */}
      <div className="lg:w-2/3 border-b lg:border-b-0 lg:border-r border-[#EAEAEA] dark:border-zinc-800 bg-white dark:bg-[#111113] p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#F1F1F1] dark:border-zinc-800">
            <div>
              <p className="text-[10px] font-medium tracking-widest text-[#9A9A9A] dark:text-zinc-500 uppercase">
                Productivity Performance
              </p>
              <h3 className="text-sm font-bold text-[#242424] dark:text-zinc-100 mt-0.5">
                Line Output vs Target Productivity
              </h3>
            </div>
            <div className="flex items-center gap-4 text-[10px] text-[#5F5F5F] dark:text-zinc-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-[#1A7C4B]" /> Target Met
                (&ge;90%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-[#CE8E33]" /> Bottleneck /
                Shortfall
              </span>
            </div>
          </div>

          {/* Bar Comparison Grid */}
          {stations.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#9A9A9A] dark:text-zinc-600">
              Loading line productivity data...
            </div>
          ) : (
            <div className="space-y-3.5">
              {stations.map((s) => {
                const target = s.targeted_productivity
                  ? s.targeted_productivity * 100
                  : 100;
                const actual = s.actual_productivity
                  ? s.actual_productivity * 100
                  : 0;
                const pct = Math.min(100, Math.round((actual / target) * 100));

                return (
                  <div key={s.station_id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#242424] dark:text-zinc-100 w-24">
                          {s.station_id}
                        </span>
                        <span className="text-[10px] text-[#9A9A9A] dark:text-zinc-500 font-mono">
                          ({s.required_skill})
                        </span>
                      </div>
                      <div className="flex items-center gap-3 font-mono text-[11px] tabular-nums">
                        <span className="text-[#9A9A9A] dark:text-zinc-500">
                          {actual.toFixed(0)}% / {target.toFixed(0)}%
                        </span>
                        <span
                          className={`font-bold w-12 text-right ${
                            s.is_bottleneck
                              ? "text-[#CE8E33]"
                              : "text-[#1A7C4B] dark:text-[#47966F]"
                          }`}
                        >
                          {pct}%
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar Container */}
                    <div className="w-full h-2.5 bg-[#F1F1F1] dark:bg-zinc-800 overflow-hidden flex">
                      <div
                        className={`h-full transition-all duration-500 ${
                          s.is_bottleneck ? "bg-[#CE8E33]" : "bg-[#1A7C4B]"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-[#F1F1F1] dark:border-zinc-800 flex justify-between items-center text-[10px] text-[#9A9A9A] dark:text-zinc-500">
          <span>Updated every shift cycle</span>
          <span>Target Standard: 100% Productivity</span>
        </div>
      </div>

      {/* ── Right Column: Stage Load Distribution & Shift Pace ── */}
      <div className="lg:w-1/3 flex flex-col bg-white dark:bg-[#111113]">
        {/* Stage Load Breakdown Card */}
        <div className="border-b border-[#EAEAEA] dark:border-zinc-800 p-5">
          <p className="text-[10px] font-medium tracking-widest text-[#9A9A9A] dark:text-zinc-500 uppercase">
            Production Stage Load
          </p>
          <h3 className="text-sm font-bold text-[#242424] dark:text-zinc-100 mt-0.5 mb-3.5">
            WIP Distribution across Stages
          </h3>

          <div className="space-y-3">
            {stages.map((stg) => {
              const loadPct = Math.min(
                100,
                Math.round((stg.wip / stg.maxCap) * 100),
              );
              const isHigh = loadPct > 75;

              return (
                <div key={stg.code} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-[#333333] dark:text-zinc-200">
                      {stg.name}
                    </span>
                    <span className="font-mono text-[11px] text-[#5F5F5F] dark:text-zinc-400 tabular-nums">
                      {stg.wip} / {stg.maxCap} u ({loadPct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#F1F1F1] dark:bg-zinc-800 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        isHigh ? "bg-[#CE8E33]" : "bg-[#1A7C4B]"
                      }`}
                      style={{ width: `${loadPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Hourly Production Pace Card */}
        <div className="p-5">
          <p className="text-[10px] font-medium tracking-widest text-[#9A9A9A] dark:text-zinc-500 uppercase">
            Shift Production Rhythm
          </p>
          <h3 className="text-sm font-bold text-[#242424] dark:text-zinc-100 mt-0.5 mb-3.5">
            Hourly Garment Throughput Pace
          </h3>

          <div className="grid grid-cols-4 gap-2">
            {shiftHours.map((sh) => (
              <div
                key={sh.hour}
                className={`p-2 border text-center ${
                  sh.status === "exceeded"
                    ? "bg-[#E6F1EC] dark:bg-[#0A321E]/30 border-[#B9D7C8] dark:border-[#104A2D]"
                    : sh.status === "lagging"
                      ? "bg-[#FDFBF8] dark:bg-amber-950/20 border-[#EACFA9] dark:border-amber-800/40"
                      : "bg-[#F8F8F8] dark:bg-zinc-900 border-[#EAEAEA] dark:border-zinc-800"
                }`}
              >
                <p className="text-[9px] font-mono text-[#9A9A9A] dark:text-zinc-500 uppercase">
                  {sh.hour}
                </p>
                <p
                  className={`text-sm font-bold font-mono tabular-nums mt-0.5 ${
                    sh.status === "exceeded"
                      ? "text-[#1A7C4B] dark:text-[#47966F]"
                      : sh.status === "lagging"
                        ? "text-[#CE8E33]"
                        : "text-[#242424] dark:text-zinc-200"
                  }`}
                >
                  {sh.actual}
                </p>
                <p className="text-[8px] font-mono text-[#9A9A9A] dark:text-zinc-500 mt-0.5">
                  / {sh.target} u
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
