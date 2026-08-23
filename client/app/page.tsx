"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Bottleneck } from "./types";
import { ErrorBanner } from "./components/ErrorBanner";
import { FactoryOverview } from "./components/FactoryOverview";
import { EfficiencyChart } from "./components/EfficiencyChart";
import type { ChartPoint } from "./components/EfficiencyChart";
import { StationFlowDiagram } from "./components/StationFlowDiagram";
import { RankedBarList } from "./components/RankedBarList";
import { createClient } from "@/lib/supabase/client";
import { getAuthHeaders } from "@/shared/auth";

// Chart: one snapshot per hour, only during working hours
const MAX_CHART_POINTS = 24; // up to 24-hour history
const WORK_START_HOUR = 6; // 06:00
const WORK_END_HOUR = 18; // 18:00
const CHART_INTERVAL_MS = 3_600_000; // 1 hour

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function Home() {
  const supabase = createClient();
  const [bottlenecks, setBottlenecks] = useState<Bottleneck[]>([]);
  const [bottlenecksError, setBottlenecksError] = useState<string | null>(null);
  const [chartHistory, setChartHistory] = useState<ChartPoint[]>([]);

  // ── Load stations once on mount ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const headers = await getAuthHeaders(supabase);
      fetch(`${API_BASE}/stations`, { headers })
        .then((res) => {
          if (!res.ok)
            throw new Error(`Failed to load stations (${res.status})`);
          return res.json();
        })
        .then((data: Bottleneck[]) => {
          setBottlenecks(data);
        })
        .catch((e) =>
          setBottlenecksError(
            e instanceof Error ? e.message : "Could not load stations",
          ),
        );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Hourly overall-progress chart (working hours only) ─────────────────
  useEffect(() => {
    const takeSnapshot = async () => {
      const h = new Date().getHours();
      if (h < WORK_START_HOUR || h >= WORK_END_HOUR) return;
      const headers = await getAuthHeaders().catch(() => ({}));
      const res = await fetch(`${API_BASE}/stations`, { headers }).catch(
        () => null,
      );
      if (!res || !res.ok) return;
      const stations: Bottleneck[] = await res.json().catch(() => []);
      const active = stations.filter(
        (b) =>
          b.actual_productivity !== null &&
          b.targeted_productivity !== null &&
          b.targeted_productivity > 0,
      );
      if (active.length === 0) return;
      const avg =
        active.reduce(
          (s, b) =>
            s + (b.actual_productivity! / b.targeted_productivity!) * 100,
          0,
        ) / active.length;
      const now = new Date();
      const label = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
      setChartHistory((prev) => {
        const next = [
          ...prev,
          { label, efficiency: Math.round(avg * 10) / 10 },
        ];
        return next.length > MAX_CHART_POINTS
          ? next.slice(-MAX_CHART_POINTS)
          : next;
      });
    };

    takeSnapshot(); // snapshot on load
    const id = setInterval(takeSnapshot, CHART_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bottleneckCount = bottlenecks.filter((b) => b.is_bottleneck).length;

  return (
    <div className="px-6 py-6 space-y-6">
      <FactoryOverview stations={bottlenecks} />

      {bottlenecksError && <ErrorBanner message={bottlenecksError} />}

      {/* Callout linking to the dedicated Worker Reallocation workflow */}
      {bottleneckCount > 0 && (
        <Link
          href="/worker-reallocation"
          className="flex items-center justify-between gap-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/50 px-5 py-3.5 hover:bg-orange-100/60 dark:hover:bg-orange-950/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 bg-orange-500 animate-pulse shrink-0" />
            <span className="text-xs font-mono text-orange-700 dark:text-orange-400">
              <strong className="font-semibold">
                {bottleneckCount} station{bottleneckCount === 1 ? "" : "s"}
              </strong>{" "}
              need operator reallocation
            </span>
          </div>
          <span className="text-[10px] font-mono text-orange-600 dark:text-orange-400 uppercase tracking-wider shrink-0">
            Open Worker Reallocation &rarr;
          </span>
        </Link>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <StationFlowDiagram stations={bottlenecks} />
        </div>
        <div className="bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800/60 p-5">
          <span className="text-[10px] font-mono tracking-widest text-zinc-400 dark:text-zinc-500 uppercase">
            Ranked by WIP
          </span>
          <h2 className="mt-1 mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Busiest stations
          </h2>
          <RankedBarList
            items={[...bottlenecks]
              .sort((a, b) => b.wip - a.wip)
              .slice(0, 8)
              .map((b) => ({
                id: b.station_id,
                label: b.station_id,
                sublabel: b.required_skill,
                value: b.wip,
                displayValue: `${b.wip}u`,
                accent: b.is_bottleneck ? "orange" : "emerald",
              }))}
          />
        </div>
      </div>

      <EfficiencyChart data={chartHistory} />

      <p className="text-center text-[10px] font-mono text-zinc-400 dark:text-zinc-700 pb-4">
        StitchFlow · Factory Overview v1.0 · Snapshots refresh hourly
      </p>
    </div>
  );
}
