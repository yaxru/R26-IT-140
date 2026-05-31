import type { Bottleneck } from "../types";

interface FactoryOverviewProps {
  stations: Bottleneck[];
}

export function FactoryOverview({ stations }: FactoryOverviewProps) {
  // ── Derived stats (no extra API calls) ────────────────────────────────
  const totalWip = stations.reduce((s, b) => s + b.wip, 0);

  const activeCount = stations.filter(
    (b) => b.actual_productivity !== null && b.actual_productivity > 0,
  ).length;

  const bottleneckCount = stations.filter((b) => b.is_bottleneck).length;

  const stationsWithData = stations.filter(
    (b) =>
      b.targeted_productivity !== null &&
      b.actual_productivity !== null &&
      b.targeted_productivity > 0,
  );
  const avgGapPct =
    stationsWithData.length > 0
      ? stationsWithData.reduce(
          (s, b) =>
            s +
            ((b.targeted_productivity! - b.actual_productivity!) /
              b.targeted_productivity!) *
              100,
          0,
        ) / stationsWithData.length
      : null;

  // ── Stat card definitions ──────────────────────────────────────────────
  const stats = [
    {
      label: "Total WIP",
      value: totalWip.toLocaleString(),
      sub: "units in progress",
      highlight: false,
    },
    {
      label: "Active Lines",
      value: `${activeCount}/${stations.length}`,
      sub: "running with output",
      highlight: false,
    },
    {
      label: "Efficiency Gap",
      value:
        avgGapPct !== null
          ? `${avgGapPct > 0 ? "-" : "+"}${Math.abs(avgGapPct).toFixed(1)}%`
          : "—",
      sub: "avg target shortfall",
      highlight: avgGapPct !== null && avgGapPct > 0,
    },
    {
      label: "Bottleneck Lines",
      value: bottleneckCount.toString(),
      sub: "require rebalancing",
      highlight: bottleneckCount > 0,
    },
  ];

  return (
    <div className="space-y-4">
      {/* ── Summary Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`bg-white dark:bg-[#111113] border p-4 flex flex-col gap-1.5 ${
              s.highlight
                ? "border-red-200 dark:border-red-900/60 bg-red-50/40 dark:bg-red-950/20"
                : "border-zinc-200 dark:border-zinc-800/60"
            }`}
          >
            <span className="text-[10px] font-mono tracking-widest text-zinc-400 dark:text-zinc-500 uppercase">
              {s.label}
            </span>
            <span
              className={`text-2xl font-bold font-mono tabular-nums tracking-tight ${
                s.highlight
                  ? "text-red-600 dark:text-red-400"
                  : "text-zinc-900 dark:text-zinc-100"
              }`}
            >
              {s.value}
            </span>
            <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-600">
              {s.sub}
            </span>
          </div>
        ))}
      </div>

      {/* ── Production Lines Table ─────────────────────────────────────── */}
      {stations.length > 0 && (
        <div className="bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800/60 overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between">
            <span className="text-[10px] font-mono tracking-widest text-zinc-400 dark:text-zinc-500 uppercase">
              Production Lines
            </span>
            <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-600">
              {stations.length} stations
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800/60">
                  <th className="text-left px-5 py-2.5 text-[10px] tracking-wider uppercase text-zinc-400 dark:text-zinc-600 font-normal">
                    Station
                  </th>
                  <th className="text-left px-4 py-2.5 text-[10px] tracking-wider uppercase text-zinc-400 dark:text-zinc-600 font-normal">
                    Skill
                  </th>
                  <th className="text-left px-4 py-2.5 text-[10px] tracking-wider uppercase text-zinc-400 dark:text-zinc-600 font-normal">
                    WIP
                  </th>
                  <th className="text-left px-4 py-2.5 text-[10px] tracking-wider uppercase text-zinc-400 dark:text-zinc-600 font-normal">
                    Actual / Target
                  </th>
                  <th className="px-4 py-2.5 text-[10px] tracking-wider uppercase text-zinc-400 dark:text-zinc-600 font-normal w-36">
                    Progress
                  </th>
                  <th className="text-right px-5 py-2.5 text-[10px] tracking-wider uppercase text-zinc-400 dark:text-zinc-600 font-normal">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/40">
                {stations.map((b) => {
                  const hasData =
                    b.targeted_productivity !== null &&
                    b.actual_productivity !== null &&
                    b.targeted_productivity > 0;
                  const pct = hasData
                    ? Math.min(
                        100,
                        Math.round(
                          (b.actual_productivity! / b.targeted_productivity!) *
                            100,
                        ),
                      )
                    : null;

                  return (
                    <tr
                      key={b.station_id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
                    >
                      {/* Station */}
                      <td className="px-5 py-3 text-zinc-800 dark:text-zinc-200 font-semibold">
                        {b.station_id}
                      </td>

                      {/* Skill */}
                      <td className="px-4 py-3">
                        <span className="inline-block bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 text-[10px] tracking-wide">
                          {b.required_skill}
                        </span>
                      </td>

                      {/* WIP */}
                      <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 tabular-nums">
                        {b.wip}
                      </td>

                      {/* Actual / Target */}
                      <td className="px-4 py-3 tabular-nums text-zinc-500 dark:text-zinc-400">
                        {hasData ? (
                          <>
                            <span className="text-zinc-800 dark:text-zinc-200">
                              {b.actual_productivity}
                            </span>
                            <span className="text-zinc-300 dark:text-zinc-700 mx-1">
                              /
                            </span>
                            {b.targeted_productivity}
                          </>
                        ) : (
                          <span className="text-zinc-300 dark:text-zinc-700">
                            —
                          </span>
                        )}
                      </td>

                      {/* Progress bar */}
                      <td className="px-4 py-3 w-36">
                        {pct !== null ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800">
                              <div
                                className={`h-full transition-all duration-500 ${
                                  pct >= 85
                                    ? "bg-emerald-500"
                                    : pct >= 60
                                      ? "bg-amber-400"
                                      : "bg-red-500"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[10px] tabular-nums text-zinc-400 dark:text-zinc-600 w-8 text-right">
                              {pct}%
                            </span>
                          </div>
                        ) : (
                          <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 opacity-40" />
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3 text-right">
                        {b.actual_productivity === null ? (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-zinc-400 dark:text-zinc-600">
                            <span className="w-1.5 h-1.5 bg-zinc-300 dark:bg-zinc-700" />
                            Maintenance
                          </span>
                        ) : b.is_bottleneck ? (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-red-600 dark:text-red-400">
                            <span className="w-1.5 h-1.5 bg-red-500 animate-pulse" />
                            Bottleneck
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                            <span className="w-1.5 h-1.5 bg-emerald-500" />
                            Normal
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
