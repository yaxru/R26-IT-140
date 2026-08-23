"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Bottleneck } from "./types";
import { ErrorBanner } from "./components/ErrorBanner";
import { OverviewNotificationPanel } from "./components/OverviewNotificationPanel";
import { OverviewAnalytics } from "./components/OverviewAnalytics";
import { OverviewStationTable } from "./components/OverviewStationTable";
import { createClient } from "@/lib/supabase/client";
import { getAuthHeaders } from "@/shared/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function Home() {
  const supabase = createClient();
  const [stations, setStations] = useState<Bottleneck[]>([]);
  const [stationsError, setStationsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load stations on mount
  useEffect(() => {
    (async () => {
      setLoading(true);
      const headers = await getAuthHeaders(supabase);
      fetch(`${API_BASE}/stations`, { headers })
        .then((res) => {
          if (!res.ok) throw new Error(`Failed to load stations (${res.status})`);
          return res.json();
        })
        .then((data: Bottleneck[]) => {
          setStations(data);
        })
        .catch((e) =>
          setStationsError(
            e instanceof Error ? e.message : "Could not load stations data"
          )
        )
        .finally(() => setLoading(false));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Key Derived Summary Metrics ──
  const totalWip = stations.reduce((s, b) => s + b.wip, 0);
  const activeLines = stations.filter(
    (b) => b.actual_productivity !== null && b.actual_productivity > 0
  ).length;
  const bottleneckCount = stations.filter((b) => b.is_bottleneck).length;

  const validStations = stations.filter(
    (b) =>
      b.targeted_productivity !== null &&
      b.actual_productivity !== null &&
      b.targeted_productivity > 0
  );

  const avgEfficiency =
    validStations.length > 0
      ? validStations.reduce(
          (sum, b) =>
            sum + (b.actual_productivity! / b.targeted_productivity!) * 100,
          0
        ) / validStations.length
      : 0;

  return (
    <main className="px-6 py-6 space-y-6 max-w-[1400px] mx-auto">
      {/* ── Page Title & Global Actions ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-[11px] font-medium tracking-widest text-[#9A9A9A] dark:text-zinc-500 uppercase mb-1">
            Production Management
          </p>
          <h1 className="text-2xl font-bold text-[#242424] dark:text-zinc-100 tracking-tight">
            Factory Floor Overview
          </h1>
          <p className="text-xs text-[#9A9A9A] dark:text-zinc-500 mt-0.5">
            Real-time garment line throughput, WIP load distribution, and alert tracking
          </p>
        </div>

        {/* Global Live Status Pill */}
        <div className="flex items-center gap-3">
          <Link
            href="/worker-reallocation"
            className={`inline-flex items-center gap-2 px-3 py-1.5 border transition-colors text-xs font-semibold ${
              bottleneckCount > 0
                ? "bg-[#FDFBF8] dark:bg-amber-950/20 text-[#A77329] border-[#EACFA9] hover:bg-[#F4E5D1]"
                : "bg-[#E6F1EC] dark:bg-[#0A321E]/20 text-[#1A7C4B] border-[#B9D7C8] hover:bg-[#D0E4DA]"
            }`}
          >
            <span
              className={`w-2 h-2 ${
                bottleneckCount > 0 ? "bg-[#CE8E33] animate-pulse" : "bg-[#1A7C4B]"
              }`}
              aria-hidden="true"
            />
            {bottleneckCount > 0
              ? `${bottleneckCount} Bottleneck Line${bottleneckCount > 1 ? "s" : ""} — Reallocate →`
              : "All Lines On Target →"}
          </Link>
        </div>
      </div>

      {/* Error banner if API fails */}
      {stationsError && <ErrorBanner message={stationsError} />}

      {/* ── Summary Key Performance Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total WIP */}
        <div className="bg-white dark:bg-[#111113] border border-[#EAEAEA] dark:border-zinc-800 p-5 flex flex-col justify-between">
          <p className="text-[10px] font-medium tracking-widest text-[#9A9A9A] dark:text-zinc-500 uppercase">
            Total WIP Queue
          </p>
          <p className="text-3xl font-bold font-mono tabular-nums text-[#242424] dark:text-zinc-100 my-2">
            {loading ? "—" : totalWip.toLocaleString()}
            <span className="text-xs font-normal text-[#9A9A9A] dark:text-zinc-500 ml-1.5">
              units
            </span>
          </p>
          <p className="text-[11px] text-[#9A9A9A] dark:text-zinc-600">
            across {stations.length} active stations
          </p>
        </div>

        {/* Metric 2: Active Lines */}
        <div className="bg-white dark:bg-[#111113] border border-[#EAEAEA] dark:border-zinc-800 p-5 flex flex-col justify-between">
          <p className="text-[10px] font-medium tracking-widest text-[#9A9A9A] dark:text-zinc-500 uppercase">
            Operating Lines
          </p>
          <p className="text-3xl font-bold font-mono tabular-nums text-[#242424] dark:text-zinc-100 my-2">
            {loading ? "—" : `${activeLines} / ${stations.length}`}
          </p>
          <p className="text-[11px] text-[#1A7C4B] dark:text-[#47966F]">
            {stations.length - activeLines > 0
              ? `${stations.length - activeLines} line in maintenance`
              : "100% lines operating"}
          </p>
        </div>

        {/* Metric 3: Factory Efficiency Rate */}
        <div className="bg-white dark:bg-[#111113] border border-[#EAEAEA] dark:border-zinc-800 p-5 flex flex-col justify-between">
          <p className="text-[10px] font-medium tracking-widest text-[#9A9A9A] dark:text-zinc-500 uppercase">
            Factory Efficiency Rate
          </p>
          <p className="text-3xl font-bold font-mono tabular-nums text-[#1A7C4B] dark:text-[#47966F] my-2">
            {loading ? "—" : `${avgEfficiency.toFixed(1)}%`}
          </p>
          <p className="text-[11px] text-[#9A9A9A] dark:text-zinc-600">
            vs 100% target standard
          </p>
        </div>

        {/* Metric 4: Bottleneck Lines */}
        <div
          className={`bg-white dark:bg-[#111113] border p-5 flex flex-col justify-between ${
            bottleneckCount > 0
              ? "border-[#EACFA9] dark:border-amber-900/60 bg-[#FDFBF8]/50 dark:bg-amber-950/10"
              : "border-[#EAEAEA] dark:border-zinc-800"
          }`}
        >
          <p className="text-[10px] font-medium tracking-widest text-[#9A9A9A] dark:text-zinc-500 uppercase">
            Active Bottlenecks
          </p>
          <p
            className={`text-3xl font-bold font-mono tabular-nums my-2 ${
              bottleneckCount > 0 ? "text-[#CE8E33]" : "text-[#1A7C4B] dark:text-[#47966F]"
            }`}
          >
            {loading ? "—" : bottleneckCount}
          </p>
          <p
            className={`text-[11px] ${
              bottleneckCount > 0 ? "text-[#A77329] font-medium" : "text-[#9A9A9A]"
            }`}
          >
            {bottleneckCount > 0 ? "Requires rebalancing" : "Optimal flow maintained"}
          </p>
        </div>
      </div>

      {/* ── Factory Notifications & Alerts Panel ── */}
      <OverviewNotificationPanel stations={stations} />

      {/* ── New Visual Analytics & Visualizations ── */}
      <OverviewAnalytics stations={stations} />

      {/* ── Redesigned Station Floor Table ── */}
      <OverviewStationTable stations={stations} />

      {/* ── Footer ── */}
      <footer className="pt-2">
        <p className="text-center text-[11px] text-[#C6C6C6] dark:text-zinc-700">
          Opsis · Factory Floor Administration v1.0 · Snapshots update in real time
        </p>
      </footer>
    </main>
  );
}
