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

// ─── KPI Stat ─────────────────────────────────────────────────────────────────

function KpiTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | React.ReactNode;
  sub?: string;
  accent?: "green" | "amber" | "none";
}) {
  const valueColor =
    accent === "green"
      ? "text-[#1A7C4B] dark:text-[#47966F]"
      : accent === "amber"
        ? "text-[#CE8E33] dark:text-[#D7A45A]"
        : "text-[#242424] dark:text-zinc-100";

  return (
    <div className="flex-1 border-b sm:border-b-0 sm:border-r border-[#EAEAEA] dark:border-zinc-800 last:border-b-0 sm:last:border-r-0 px-5 py-4 flex flex-col justify-center">
      <p className="text-[10px] font-medium tracking-widest text-[#9A9A9A] dark:text-zinc-500 uppercase mb-1">
        {label}
      </p>
      <p
        className={`text-2xl font-bold tabular-nums leading-none ${valueColor}`}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[11px] text-[#9A9A9A] dark:text-zinc-600 mt-1">
          {sub}
        </p>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

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
    <div className="flex flex-col h-full">
      {/* ── Top bar ──────────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-[#EAEAEA] dark:border-zinc-800 px-6 py-4 flex items-center justify-between bg-white dark:bg-[#0d0d0f]">
        <div>
          <p className="text-[10px] font-medium tracking-widest text-[#9A9A9A] dark:text-zinc-500 uppercase mb-0.5">
            Main · Overview
          </p>
          <h1 className="text-lg font-bold text-[#242424] dark:text-zinc-100 tracking-tight">
            Factory Floor Status
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/worker-reallocation"
            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 border transition-colors ${
              bottleneckCount > 0
                ? "text-[#A77329] dark:text-[#E1BA82] bg-[#FDFBF8] dark:bg-amber-950/20 border-[#EACFA9] dark:border-amber-800/40 hover:bg-[#F4E5D1] dark:hover:bg-amber-900/40"
                : "text-[#1A7C4B] dark:text-[#47966F] bg-[#E6F1EC] dark:bg-[#0A321E]/20 border-[#B9D7C8] dark:border-[#104A2D] hover:bg-[#D0E4DA] dark:hover:bg-[#0A321E]/40"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 ${
                bottleneckCount > 0 ? "bg-[#CE8E33] animate-pulse" : "bg-[#1A7C4B]"
              }`}
              aria-hidden="true"
            />
            {bottleneckCount > 0
              ? `${bottleneckCount} bottleneck${bottleneckCount > 1 ? "s" : ""} — Reallocate →`
              : "All lines on target →"}
          </Link>
        </div>
      </header>

      {/* ── Main body ────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto bg-[#F8F8F8] dark:bg-[#0a0a0c]">
        {/* Error banners */}
        {stationsError && (
          <div className="px-6 py-2">
            <div
              role="alert"
              className="flex items-center gap-2 border-l-2 border-l-[#CE8E33] border border-[#F4E5D1] dark:border-amber-800/30 bg-[#FDFBF8] dark:bg-amber-950/10 px-3 py-2 text-xs text-[#A77329] dark:text-[#E1BA82]"
            >
              <span aria-hidden="true">⚠</span> {stationsError}
            </div>
          </div>
        )}

        {/* ── KPI row ─────────────────────────────────────────── */}
        <section
          aria-label="Overview metrics"
          className="border-b border-[#EAEAEA] dark:border-zinc-800 bg-white dark:bg-[#111113] flex flex-col sm:flex-row"
        >
          {loading ? (
            [1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex-1 border-b sm:border-b-0 sm:border-r border-[#EAEAEA] dark:border-zinc-800 last:border-b-0 sm:last:border-r-0 px-5 py-4"
              >
                <div className="h-2 w-20 bg-[#F1F1F1] dark:bg-zinc-800 animate-pulse mb-3" />
                <div className="h-7 w-16 bg-[#F1F1F1] dark:bg-zinc-800 animate-pulse mb-2" />
                <div className="h-2 w-24 bg-[#F1F1F1] dark:bg-zinc-800 animate-pulse" />
              </div>
            ))
          ) : (
            <>
              <KpiTile
                label="Total WIP Queue"
                value={
                  <>
                    {totalWip.toLocaleString()}
                    <span className="text-base font-normal text-[#9A9A9A] dark:text-zinc-600 ml-1">
                      u
                    </span>
                  </>
                }
                sub={`across ${stations.length} active stations`}
                accent="none"
              />
              <KpiTile
                label="Operating Lines"
                value={`${activeLines} / ${stations.length}`}
                sub={
                  stations.length - activeLines > 0
                    ? `${stations.length - activeLines} offline/maintenance`
                    : "100% lines operating"
                }
                accent="none"
              />
              <KpiTile
                label="Factory Efficiency"
                value={`${avgEfficiency.toFixed(1)}%`}
                sub="vs 100% target standard"
                accent={avgEfficiency >= 90 ? "green" : avgEfficiency >= 75 ? "none" : "amber"}
              />
              <KpiTile
                label="Active Bottlenecks"
                value={bottleneckCount.toString()}
                sub={bottleneckCount > 0 ? "Requires rebalancing" : "Optimal flow maintained"}
                accent={bottleneckCount > 0 ? "amber" : "green"}
              />
            </>
          )}
        </section>

        {/* ── Notifications Panel ─────────────────────────────── */}
        <section
          aria-label="Alerts and notifications"
          className="border-b border-[#EAEAEA] dark:border-zinc-800 bg-white dark:bg-[#111113]"
        >
          <OverviewNotificationPanel stations={stations} />
        </section>

        {/* ── Analytics Visualizations ────────────────────────── */}
        <section
          aria-label="Production analytics"
          className="border-b border-[#EAEAEA] dark:border-zinc-800 bg-white dark:bg-[#111113]"
        >
          <OverviewAnalytics stations={stations} />
        </section>

        {/* ── Station Table ───────────────────────────────────── */}
        <section
          aria-label="Station status table"
          className="bg-white dark:bg-[#111113]"
        >
          <OverviewStationTable stations={stations} />
        </section>

        {/* ── Footer ─────────────────────────────────────────── */}
        <footer className="px-5 py-3 border-t border-[#EAEAEA] dark:border-zinc-800 bg-white dark:bg-[#111113]">
          <p className="text-[11px] text-[#C6C6C6] dark:text-zinc-700">
            Opsis · Factory Floor Administration v1.0 · Snapshots update in real time
          </p>
        </footer>
      </main>
    </div>
  );
}
