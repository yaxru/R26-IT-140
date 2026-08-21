"use client";

import { useEffect, useState } from "react";
import type { Bottleneck } from "../types";
import { Heatmap } from "../components/Heatmap";
import { SegmentedBar } from "../components/SegmentedBar";
import { ErrorBanner } from "../components/ErrorBanner";
import { createClient } from "@/lib/supabase/client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const WIP_CAPACITY = 60; // matches the cap used on the Worker Reallocation cards

const METRIC_COLUMNS = ["WIP %", "Actual %", "Target %", "Gap %"];

export default function FloorMapPage() {
  const supabase = createClient();

  const [stations, setStations] = useState<Bottleneck[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const headers: Record<string, string> = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};
      fetch(`${API_BASE}/stations`, { headers })
        .then((res) => {
          if (!res.ok)
            throw new Error(`Failed to load stations (${res.status})`);
          return res.json();
        })
        .then((data: Bottleneck[]) => setStations(data))
        .catch((e) =>
          setError(e instanceof Error ? e.message : "Could not load stations"),
        );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = stations[selectedIndex] ?? null;

  const bottleneckCount = stations.filter((s) => s.is_bottleneck).length;
  const onTargetCount = stations.filter(
    (s) => !s.is_bottleneck && s.actual_productivity !== null,
  ).length;
  const withData = stations.filter(
    (s) =>
      s.actual_productivity !== null &&
      s.targeted_productivity !== null &&
      s.targeted_productivity > 0,
  );
  const avgActualPct =
    withData.length > 0
      ? (withData.reduce((sum, s) => sum + (s.actual_productivity ?? 0), 0) /
          withData.length) *
        100
      : null;

  // ── Heatmap data: Station × Metric ───────────────────────────────────────
  const heatmapValues: (number | null)[][] = stations.map((s) => {
    const wipPct = Math.min(100, (s.wip / WIP_CAPACITY) * 100);
    const actualPct =
      s.actual_productivity !== null ? s.actual_productivity * 100 : null;
    const targetPct =
      s.targeted_productivity !== null ? s.targeted_productivity * 100 : null;
    const gapPct =
      actualPct !== null && targetPct !== null
        ? Math.max(0, targetPct - actualPct)
        : null;
    return [wipPct, actualPct, targetPct, gapPct];
  });

  // ── WIP by skill — segmented bar (Guickly "cost breakdown" style) ───────
  const skillTotals = new Map<string, number>();
  stations.forEach((s) => {
    skillTotals.set(
      s.required_skill,
      (skillTotals.get(s.required_skill) ?? 0) + Math.max(s.wip, 0),
    );
  });
  const skillPalette = ["#10b981", "#0ea5e9", "#a78bfa", "#f59e0b", "#71717a"];
  const segmentedItems = Array.from(skillTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([skill, wip], i) => ({
      id: skill,
      label: skill,
      value: wip,
      displayValue: `${wip}u`,
      color: skillPalette[i % skillPalette.length],
    }));

  const goPrev = () =>
    setSelectedIndex((i) => (i - 1 + stations.length) % stations.length);
  const goNext = () => setSelectedIndex((i) => (i + 1) % stations.length);

  return (
    <div className="px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-mono tracking-widest text-zinc-400 dark:text-zinc-500 uppercase">
            Floor Map
          </p>
          <h1 className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Factory Floor &middot; Station by Station
          </h1>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-200 dark:ring-emerald-900/60 px-2.5 py-1">
          <span className="inline-block w-1.5 h-1.5 bg-emerald-500 animate-pulse" />
          LIVE
        </span>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Global stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Stations",
            value: stations.length.toString(),
            color: "text-zinc-900 dark:text-zinc-100",
          },
          {
            label: "On Target",
            value: onTargetCount.toString(),
            color: "text-emerald-600 dark:text-emerald-400",
          },
          {
            label: "Bottlenecks",
            value: bottleneckCount.toString(),
            color: "text-orange-600 dark:text-orange-400",
          },
          {
            label: "Avg Actual",
            value: avgActualPct !== null ? `${avgActualPct.toFixed(0)}%` : "—",
            color: "text-zinc-900 dark:text-zinc-100",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800/60 p-4"
          >
            <p className="text-[10px] font-mono tracking-widest text-zinc-400 dark:text-zinc-500 uppercase mb-1">
              {s.label}
            </p>
            <p className={`text-2xl font-bold font-mono ${s.color}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Heatmap — Station × Metric, click a row to select that station */}
        <div className="lg:col-span-2 bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800/60 p-5">
          <span className="text-[10px] font-mono tracking-widest text-zinc-400 dark:text-zinc-500 uppercase">
            Station &times; Metric
          </span>
          <h2 className="mt-1 mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Utilisation heatmap
          </h2>
          <Heatmap
            rowLabels={stations.map((s) => s.station_id)}
            colLabels={METRIC_COLUMNS}
            values={heatmapValues}
            selectedRow={stations.length > 0 ? selectedIndex : null}
            onCellClick={(rowIndex) => setSelectedIndex(rowIndex)}
            formatValue={(v) => `${Math.round(v)}`}
            tooltipContent={(ri, ci) => {
              const s = stations[ri];
              if (!s) return null;
              return (
                <>
                  <div className="flex items-center justify-between gap-3 font-semibold text-zinc-100 mb-1">
                    <span>{s.station_id}</span>
                    <span
                      className={
                        s.is_bottleneck ? "text-orange-400" : "text-emerald-400"
                      }
                    >
                      {s.is_bottleneck ? "Bottleneck" : "On target"}
                    </span>
                  </div>
                  <div className="text-zinc-400 mb-1">{s.required_skill}</div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-zinc-400">
                    {METRIC_COLUMNS.map((col, i) => (
                      <div
                        key={col}
                        className={`flex items-center justify-between gap-2 ${
                          i === ci ? "text-emerald-400 font-semibold" : ""
                        }`}
                      >
                        <span>{col}</span>
                        <span>
                          {heatmapValues[ri]?.[i] !== null &&
                          heatmapValues[ri]?.[i] !== undefined
                            ? `${Math.round(heatmapValues[ri][i]!)}`
                            : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              );
            }}
          />
          <p className="mt-3 text-[9px] font-mono text-zinc-400 dark:text-zinc-600 normal-case tracking-normal">
            darker = higher &middot; click any cell to inspect that station
          </p>
        </div>

        {/* Station-by-station detail panel */}
        <div className="bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800/60 p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono tracking-widest text-zinc-400 dark:text-zinc-500 uppercase">
              Station {stations.length > 0 ? selectedIndex + 1 : 0} of{" "}
              {stations.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={goPrev}
                disabled={stations.length === 0}
                aria-label="Previous station"
                className="w-6 h-6 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                &lsaquo;
              </button>
              <button
                onClick={goNext}
                disabled={stations.length === 0}
                aria-label="Next station"
                className="w-6 h-6 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                &rsaquo;
              </button>
            </div>
          </div>

          {selected ? (
            <>
              <div>
                <div className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                  {selected.station_id}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[11px] font-mono font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5">
                    {selected.required_skill}
                  </span>
                  {selected.is_bottleneck ? (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 ring-1 ring-orange-200 dark:ring-orange-900/60 px-2 py-0.5">
                      <span className="w-1.5 h-1.5 bg-orange-500 animate-pulse" />
                      Bottleneck
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-200 dark:ring-emerald-900/60 px-2 py-0.5">
                      <span className="w-1.5 h-1.5 bg-emerald-500" />
                      On Target
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800/40 p-3">
                  <div className="text-[9px] font-mono text-zinc-400 dark:text-zinc-600 uppercase tracking-wider mb-1">
                    WIP
                  </div>
                  <div className="text-lg font-bold font-mono tabular-nums text-zinc-800 dark:text-zinc-200">
                    {selected.wip}
                  </div>
                  <div className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 mt-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        selected.wip / WIP_CAPACITY > 0.75
                          ? "bg-orange-500"
                          : "bg-emerald-500"
                      }`}
                      style={{
                        width: `${Math.min(100, (selected.wip / WIP_CAPACITY) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800/40 p-3">
                  <div className="text-[9px] font-mono text-zinc-400 dark:text-zinc-600 uppercase tracking-wider mb-1">
                    Productivity
                  </div>
                  {selected.actual_productivity !== null &&
                  selected.targeted_productivity !== null ? (
                    <>
                      <div className="text-lg font-bold font-mono tabular-nums text-zinc-800 dark:text-zinc-200">
                        {(selected.actual_productivity * 100).toFixed(0)}
                        <span className="text-[10px] font-normal text-zinc-400 dark:text-zinc-600">
                          /{(selected.targeted_productivity * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 mt-1.5 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-all duration-500"
                          style={{
                            width: `${Math.min(100, (selected.actual_productivity / selected.targeted_productivity) * 100)}%`,
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="text-lg font-bold font-mono text-zinc-300 dark:text-zinc-700">
                      &mdash;
                    </div>
                  )}
                </div>
              </div>

              {/* Station chip strip for quick jumping */}
              <div className="flex flex-wrap gap-1.5 pt-3 border-t border-zinc-100 dark:border-zinc-800/40">
                {stations.map((s, i) => (
                  <button
                    key={s.station_id}
                    onClick={() => setSelectedIndex(i)}
                    className={`px-2 py-1 text-[10px] font-mono transition-colors cursor-pointer ${
                      i === selectedIndex
                        ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                        : "bg-zinc-100 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700/80"
                    }`}
                  >
                    {s.station_id}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center py-10">
              <span className="text-sm font-mono text-zinc-400 dark:text-zinc-600">
                No station data yet
              </span>
            </div>
          )}
        </div>
      </div>

      {/* WIP distribution by skill — Guickly "cost breakdown" style */}
      <div className="bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800/60 p-5">
        <span className="text-[10px] font-mono tracking-widest text-zinc-400 dark:text-zinc-500 uppercase">
          WIP &middot; by required skill
        </span>
        <h2 className="mt-1 mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Where work-in-progress sits
        </h2>
        <SegmentedBar items={segmentedItems} />
      </div>
    </div>
  );
}
