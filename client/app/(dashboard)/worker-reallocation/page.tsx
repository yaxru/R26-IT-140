"use client";

import { useEffect, useState, useCallback } from "react";
import type { Bottleneck, RecommendResponse, SkillMatrixEntry } from "../types";
import { StationWorkersGrid } from "@/components/StationWorkersGrid";
import { RankedBarList } from "@/components/RankedBarList";
import { SegmentedBar } from "@/components/SegmentedBar";
import { HoverTooltip } from "@/components/HoverTooltip";
import { createClient } from "@/lib/supabase/client";
import { getAuthHeaders } from "@/shared/auth";
import { ChevronDown, ChevronRight, Clock } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const RECOMMEND_INTERVAL_MS = 3_600_000;

// Shared custom scrollbar styling for the industrial aesthetic
const SCROLLBAR =
  "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#D4D4D4] dark:[&::-webkit-scrollbar-thumb]:bg-zinc-800 hover:[&::-webkit-scrollbar-thumb]:bg-[#C6C6C6] dark:hover:[&::-webkit-scrollbar-thumb]:bg-zinc-700";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, digits = 0) {
  if (n == null) return "—";
  return (n * 100).toFixed(digits);
}

function isStationInTransit(cooldown_until?: string | null) {
  if (!cooldown_until) return false;
  return new Date(cooldown_until) > new Date();
}

function GapBar({
  value,
  max = 100,
  color,
}: {
  value: number;
  max?: number;
  color: string;
}) {
  return (
    <div className="w-full h-1 bg-[#EAEAEA] dark:bg-zinc-800 overflow-hidden">
      <div
        className="h-full transition-[width] duration-500"
        style={{
          width: `${Math.min(100, (value / max) * 100)}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}

// ─── Station List ─────────────────────────────────────────────────────────────

function StationList({
  stations,
  active,
  onSelect,
}: {
  stations: Bottleneck[];
  active: Bottleneck | null;
  onSelect: (b: Bottleneck) => void;
}) {
  const [expandedLines, setExpandedLines] = useState<Record<string, boolean>>(
    {},
  );
  const criticalCount = stations.filter((s) => s.is_bottleneck).length;

  const groupedStations = stations.reduce(
    (acc, station) => {
      // @ts-ignore
      const lineId = station.line_id || "Unassigned";
      if (!acc[lineId]) acc[lineId] = [];
      acc[lineId].push(station);
      return acc;
    },
    {} as Record<string, Bottleneck[]>,
  );

  const toggleLine = (lineId: string) => {
    setExpandedLines((prev) => ({ ...prev, [lineId]: !prev[lineId] }));
  };

  return (
    <aside
      aria-label="Production stations"
      className="w-56 shrink-0 border-r border-[#EAEAEA] dark:border-zinc-800 flex flex-col self-stretch bg-white dark:bg-[#111113]"
    >
      <div className="px-4 py-3 border-b border-[#EAEAEA] dark:border-zinc-800 shrink-0">
        <p className="text-[10px] font-medium tracking-widest text-[#9A9A9A] dark:text-zinc-500 uppercase mb-0.5">
          Stations
        </p>
        <p className="text-sm font-bold text-[#242424] dark:text-zinc-100 tabular-nums">
          {stations.length > 0 ? (
            <>
              <span
                className={
                  criticalCount > 0 ? "text-[#CE8E33]" : "text-[#1A7C4B]"
                }
              >
                {criticalCount}
              </span>
              <span className="text-[#9A9A9A] dark:text-zinc-500 font-normal text-xs ml-1">
                / {stations.length} critical
              </span>
            </>
          ) : (
            <span className="text-[#9A9A9A] dark:text-zinc-600">Loading…</span>
          )}
        </p>
      </div>

      <nav className={`flex-1 overflow-y-auto ${SCROLLBAR}`}>
        {stations.length === 0 ? (
          <div className="flex flex-col divide-y divide-[#F1F1F1] dark:divide-zinc-800/60">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3">
                <div className="w-2 h-2 bg-[#F1F1F1] dark:bg-zinc-800 animate-pulse" />
                <div className="flex-1">
                  <div className="h-3 w-20 bg-[#F1F1F1] dark:bg-zinc-800 animate-pulse mb-1.5" />
                  <div className="h-2 w-12 bg-[#F1F1F1] dark:bg-zinc-800 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col">
            {Object.entries(groupedStations).map(([lineId, lineStations]) => {
              const isExpanded = !!expandedLines[lineId];
              const hasCritical = lineStations.some((s) => s.is_bottleneck);

              return (
                <div
                  key={lineId}
                  className="border-b border-[#EAEAEA] dark:border-zinc-800/60 last:border-b-0"
                >
                  <button
                    onClick={() => toggleLine(lineId)}
                    className="w-full flex items-center justify-between px-4 py-2.5 bg-[#F8F8F8] dark:bg-zinc-900 hover:bg-[#F1F1F1] dark:hover:bg-zinc-800 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown size={14} className="text-[#9A9A9A]" />
                      ) : (
                        <ChevronRight size={14} className="text-[#9A9A9A]" />
                      )}
                      <span className="text-xs font-bold text-[#242424] dark:text-zinc-200 uppercase tracking-wide">
                        {lineId}
                      </span>
                    </div>
                    {hasCritical && (
                      <span className="w-1.5 h-1.5  bg-[#CE8E33] animate-pulse" />
                    )}
                  </button>

                  {isExpanded && (
                    <ul className="divide-y divide-[#F1F1F1] dark:divide-zinc-800/60 bg-white dark:bg-[#111113]">
                      {lineStations.map((b) => {
                        const isActive = active?.station_id === b.station_id;
                        const pct =
                          b.targeted_productivity && b.actual_productivity
                            ? Math.round(
                                (b.actual_productivity /
                                  b.targeted_productivity) *
                                  100,
                              )
                            : null;

                        // Check if station is in cooldown
                        const inTransit = isStationInTransit(b.cooldown_until);

                        return (
                          <li key={b.station_id}>
                            <button
                              onClick={() => onSelect(b)}
                              aria-pressed={isActive}
                              className={`
                                w-full text-left px-4 py-3 flex items-start gap-3 transition-colors duration-100
                                focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#1A7C4B]
                                ${
                                  isActive
                                    ? "bg-[#F8F8F8] dark:bg-zinc-800/60 border-l-2 border-l-[#1A7C4B]"
                                    : "border-l-2 border-l-transparent hover:bg-[#FDFEFE] dark:hover:bg-zinc-800/30"
                                }
                              `}
                            >
                              <span
                                aria-hidden="true"
                                className={`mt-1.5 w-1.5 h-1.5 shrink-0 ${
                                  inTransit
                                    ? "bg-[#3B82F6] animate-pulse"
                                    : b.is_bottleneck
                                      ? "bg-[#CE8E33] animate-pulse"
                                      : "bg-[#1A7C4B]"
                                }`}
                              />
                              <div className="flex-1 min-w-0">
                                <p
                                  className={`text-xs font-semibold truncate ${isActive ? "text-[#242424] dark:text-zinc-100" : "text-[#424242] dark:text-zinc-300"}`}
                                >
                                  {b.station_id}
                                </p>
                                <p className="text-[10px] text-[#9A9A9A] dark:text-zinc-600 truncate">
                                  {b.required_skill}
                                </p>
                                {pct !== null && (
                                  <div className="mt-1.5">
                                    <GapBar
                                      value={b.actual_productivity! * 100}
                                      max={100}
                                      color={
                                        inTransit
                                          ? "#3B82F6"
                                          : b.is_bottleneck
                                            ? "#CE8E33"
                                            : "#1A7C4B"
                                      }
                                    />
                                  </div>
                                )}
                              </div>
                              <span
                                className={`mt-0.5 text-[10px] font-mono font-bold tabular-nums ${
                                  inTransit
                                    ? "text-[#3B82F6]"
                                    : b.is_bottleneck
                                      ? "text-[#CE8E33]"
                                      : "text-[#9A9A9A] dark:text-zinc-500"
                                }`}
                              >
                                {inTransit ? <Clock size={12} /> : b.wip}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </nav>
      <div className="px-4 py-3 border-t border-[#EAEAEA] dark:border-zinc-800 flex flex-col items-start justify-center gap-2 bg-white dark:bg-[#111113]">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-[#1A7C4B] shrink-0" />
          <span className="text-[10px] text-[#9A9A9A] dark:text-zinc-600">
            On target
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-[#CE8E33] shrink-0" />
          <span className="text-[10px] text-[#9A9A9A] dark:text-zinc-600">
            Critical / bottleneck
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-[#3B82F6] shrink-0" />
          <span className="text-[10px] text-[#9A9A9A] dark:text-zinc-600">
            Worker in transit
          </span>
        </div>
      </div>
    </aside>
  );
}

// ─── KPI Stat ─────────────────────────────────────────────────────────────────

function KpiTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "green" | "amber" | "blue" | "none";
}) {
  const valueColor =
    accent === "green"
      ? "text-[#1A7C4B] dark:text-[#47966F]"
      : accent === "amber"
        ? "text-[#CE8E33] dark:text-[#D7A45A]"
        : accent === "blue"
          ? "text-[#3B82F6]"
          : "text-[#242424] dark:text-zinc-100";

  return (
    <div className="flex-1 border-r border-[#EAEAEA] dark:border-zinc-800 last:border-r-0 px-5 py-4">
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

// ─── Recommendation Panel ─────────────────────────────────────────────────────

export function RecommendationPanel({
  recommendation,
  loading,
  isBottleneck,
  inTransit,
  cooldownUntil,
  lastUpdated,
  onRefresh,
}: {
  recommendation: RecommendResponse | null;
  loading: boolean;
  isBottleneck: boolean;
  inTransit: boolean;
  cooldownUntil: string | null;
  lastUpdated: Date | null;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 flex bg-white items-center justify-between border-b border-[#EAEAEA] dark:border-zinc-800 px-5  h-12">
        <p className="text-[10px] font-medium tracking-widest text-[#9A9A9A] dark:text-zinc-500 uppercase">
          Move Recommendation
        </p>
        <div className="flex items-center gap-3">
          {loading ? (
            <span
              aria-live="polite"
              className="text-[10px] text-[#9A9A9A] dark:text-zinc-600 animate-pulse"
            >
              Computing…
            </span>
          ) : lastUpdated ? (
            <time className="text-[10px] text-[#9A9A9A] dark:text-zinc-600 tabular-nums">
              {lastUpdated.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          ) : null}
          <button
            onClick={onRefresh}
            disabled={loading || (!isBottleneck && !inTransit)}
            className="w-6 h-6 flex items-center justify-center text-[#9A9A9A] hover:text-[#242424] disabled:opacity-30 transition-colors cursor-pointer"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="square"
              strokeLinejoin="miter"
            >
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M8 16H3v5" />
            </svg>
          </button>
        </div>
      </div>

      <div
        className={`flex-1 px-5 py-4 overflow-y-auto flex flex-col min-h-0 bg-white dark:bg-[#111113] ${SCROLLBAR}`}
      >
        {inTransit ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8">
            <div className="w-8 h-8 border border-[#3B82F6]/30 flex items-center justify-center bg-[#EFF6FF] dark:bg-[#1E3A8A]/30">
              <Clock size={16} className="text-[#3B82F6] animate-pulse" />
            </div>
            <p className="text-sm font-semibold text-[#333333] dark:text-zinc-200">
              Worker in Transit
            </p>
            <p className="text-xs text-[#9A9A9A] dark:text-zinc-600">
              Station is stabilizing. Check back after{" "}
              {cooldownUntil
                ? new Date(cooldownUntil).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "cooldown period"}
              .
            </p>
          </div>
        ) : !isBottleneck ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8">
            <div className="w-8 h-8 border border-[#1A7C4B]/30 flex items-center justify-center bg-[#E6F1EC] dark:bg-[#0A321E]/30">
              <span className="text-[#1A7C4B] text-sm" aria-hidden="true">
                ✓
              </span>
            </div>
            <p className="text-sm font-semibold text-[#333333] dark:text-zinc-200">
              Station on target
            </p>
            <p className="text-xs text-[#9A9A9A] dark:text-zinc-600">
              No operator reallocation needed
            </p>
          </div>
        ) : loading && !recommendation ? (
          <div className="flex-1 flex flex-col gap-3 py-2">
            {[100, 80, 100, 60, 100].map((w, i) => (
              <div
                key={i}
                className={`h-3 bg-[#F1F1F1] dark:bg-zinc-800 animate-pulse`}
                style={{ width: `${w}%` }}
              />
            ))}
            <div className="mt-auto h-10 bg-[#F1F1F1] dark:bg-zinc-800 animate-pulse" />
          </div>
        ) : recommendation ? (
          <div
            className={`flex-1 flex flex-col gap-4 transition-opacity duration-300 opacity-100`}
          >
            {!recommendation.recommended ? (
              <>
                <div
                  role="alert"
                  className="flex items-center gap-2 px-3 py-2.5 bg-[#F4E5D1] border-l-2  border border-[#F4E5D1]"
                >
                  <span className="text-[#CE8E33] text-xs" aria-hidden="true">
                    ⚠
                  </span>
                  <span className="text-xs font-semibold text-[#A77329] uppercase tracking-wider">
                    No Move Recommended
                  </span>
                </div>
                <p className="text-xs text-[#5F5F5F] dark:text-zinc-400 leading-relaxed">
                  {recommendation.no_move_reason}
                </p>
              </>
            ) : (
              <>
                <div>
                  <div className="flex justify-between text-[11px] mb-1.5">
                    <span className="text-[#9A9A9A] dark:text-zinc-500">
                      {recommendation.workers_found} of{" "}
                      {recommendation.workers_needed} workers needed
                    </span>
                    <span className="font-semibold text-[#1A7C4B] tabular-nums">
                      {recommendation.gap_coverage_pct.toFixed(0)}% gap covered
                    </span>
                  </div>
                  <div className="w-full h-1 bg-[#EAEAEA] dark:bg-zinc-800">
                    <div
                      className="h-full bg-[#1A7C4B] transition-[width] duration-500"
                      style={{ width: `${recommendation.gap_coverage_pct}%` }}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  {recommendation.moves.map((move, i) => {
                    const gapMatch =
                      move.donor_risk_detail?.match(/gap:\s*([\d.]+)%/);
                    const projectedGap = gapMatch ? parseFloat(gapMatch[1]) : 0;

                    const specificWarningRaw =
                      recommendation.cascade_warnings?.find((w) =>
                        w.includes(move.operator_id),
                      );
                    const specificWarning = specificWarningRaw
                      ? specificWarningRaw.replace(
                          move.operator_id,
                          move.operator_name ||
                            move.operator_id.slice(0, 8).toUpperCase(),
                        )
                      : null;

                    return (
                      <div
                        key={move.operator_id}
                        className={`p-3.5 text-[11px] bg-[#F8F8F8]/30 dark:bg-[#111113] border border-[#EAEAEA] dark:border-zinc-800 transition-all ${
                          move.donor_cascade_risk ? "" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <span className="font-bold text-[#333333] dark:text-zinc-200 text-xs tracking-tight">
                              {i + 1}.{" "}
                              {move.operator_name ||
                                (move.operator_id
                                  ? `${move.operator_id.slice(0, 8)}...`
                                  : "Unknown")}
                            </span>
                            <span className="ml-1.5 text-[10px] text-[#9A9A9A] dark:text-zinc-500 font-mono">
                              ({move.worker_pin || "PIN"})
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] px-2 py-0.5 bg-[#F8F8F8] dark:bg-zinc-900 border border-[#EAEAEA] dark:border-zinc-800 text-[#5F5F5F] dark:text-zinc-400 font-semibold uppercase tracking-wide">
                              Grade {move.proficiency_grade}
                            </span>
                            <span className="text-[11px] text-[#1A7C4B] dark:text-[#47966F] font-bold bg-[#E6F1EC] dark:bg-[#0A321E]/40 px-2 py-0.5">
                              +{move.net_profit.toFixed(1)}m
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 mb-3 px-1">
                          <div className="flex items-center gap-1.5 text-[#5F5F5F] dark:text-zinc-400">
                            <span className="text-[9px] uppercase tracking-widest text-[#9A9A9A] dark:text-zinc-500">
                              From
                            </span>
                            <span className="font-mono font-medium">
                              {move.from_station ?? "Unassigned Pool"}
                            </span>
                          </div>
                          <span className="text-[#D4D4D4] dark:text-zinc-700">
                            →
                          </span>
                          <div className="flex items-center gap-1.5 text-[#1A7C4B] dark:text-[#47966F]">
                            <span className="text-[9px] uppercase tracking-widest opacity-80">
                              To
                            </span>
                            <span className="font-mono font-bold">
                              {move.to_station}
                            </span>
                          </div>
                        </div>

                        {move.donor_cascade_risk && (
                          <div className="mt-3 pt-3 border-t border-dashed border-[#EAEAEA] dark:border-zinc-800">
                            {specificWarning && (
                              <p className="text-[10px] text-[#A77329] dark:text-[#E1BA82] leading-relaxed mb-2.5 flex gap-1.5">
                                <span className="animate-pulse">⚠</span>
                                <span>{specificWarning}</span>
                              </p>
                            )}

                            <div className="flex items-end justify-between mb-1.5 px-1">
                              <span className="text-[9px] text-[#9A9A9A] dark:text-zinc-500 uppercase tracking-widest">
                                Projected Gap
                              </span>
                              <span className="text-[10px] text-[#A77329] dark:text-[#E1BA82] font-mono font-bold">
                                {projectedGap}%
                              </span>
                            </div>

                            <div className="w-full h-1 bg-[#F1F1F1] dark:bg-zinc-800 overflow-hidden mb-2.5">
                              <div
                                className="h-full bg-[#CE8E33] transition-all duration-500"
                                style={{
                                  width: `${Math.min(100, projectedGap)}%`,
                                }}
                              />
                            </div>

                            {move.donor_replacement_id && (
                              <div className="inline-flex items-center gap-1.5 mt-1 bg-[#F8F8F8] dark:bg-zinc-900 border border-[#EAEAEA] dark:border-zinc-800 px-2 py-1">
                                <span className="text-[9px] text-[#1A7C4B] dark:text-[#47966F] uppercase tracking-widest">
                                  ↩ Auto-Backfill
                                </span>
                                <span className="text-[10px] font-mono font-bold text-[#333333] dark:text-zinc-300">
                                  {move.donor_replacement_id
                                    .slice(0, 8)
                                    .toUpperCase()}
                                </span>
                                <span className="text-[9px] text-[#9A9A9A] dark:text-zinc-500">
                                  (Grade {move.donor_replacement_grade})
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center py-8">
            <p className="text-xs text-[#9A9A9A]">Awaiting station data</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Profitability Panel ──────────────────────────────────────────────────────

const NET_PROFIT_MIN = -15;
const NET_PROFIT_MAX = 20;

function ProfitabilityPanel({
  recommendation,
}: {
  recommendation: RecommendResponse | null;
}) {
  if (!recommendation) {
    return (
      <div className="flex flex-col h-full border-l border-[#EAEAEA] dark:border-zinc-800 bg-white dark:bg-[#111113]">
        <div className="border-b border-[#EAEAEA] dark:border-zinc-800 px-5 py-3">
          <p className="text-[10px] font-medium tracking-widest text-[#9A9A9A] dark:text-zinc-500 uppercase">
            Profitability
          </p>
        </div>
        <div className="flex-1 flex items-center justify-center px-5 py-4">
          <p className="text-xs text-[#9A9A9A] dark:text-zinc-600">
            Awaiting recommendation…
          </p>
        </div>
      </div>
    );
  }

  const score =
    recommendation.total_net_profit ?? recommendation.net_profit ?? 0;
  const profPct = Math.max(
    0,
    Math.min(
      100,
      ((score - NET_PROFIT_MIN) / (NET_PROFIT_MAX - NET_PROFIT_MIN)) * 100,
    ),
  );
  const costOfMove = Math.max(
    0,
    recommendation.expected_production_gain - score,
  );
  const barColor = score > 8 ? "#1A7C4B" : score > 0 ? "#D7A45A" : "#CE8E33";

  return (
    <div className="flex flex-col h-full overflow-hidden border-l border-[#EAEAEA] dark:border-zinc-800 bg-[#F8F8F8] dark:bg-[#111113]">
      <div className="shrink-0 border-b border-[#EAEAEA] dark:border-zinc-800 px-5  h-12 flex items-center">
        <p className="text-[10px] font-medium tracking-widest text-[#9A9A9A] dark:text-zinc-500 uppercase">
          Cost breakdown
        </p>
      </div>

      <div
        className={`flex-1 px-5 py-4 flex flex-col gap-5 overflow-y-auto min-h-0 ${SCROLLBAR}`}
      >
        <div>
          <p
            className={`text-4xl font-bold tabular-nums leading-none ${score > 0 ? "text-[#1A7C4B] dark:text-[#47966F]" : "text-[#CE8E33]"}`}
          >
            {score > 0 ? "+" : ""}
            {score.toFixed(1)}
            <span className="text-base font-normal text-[#9A9A9A] ml-1.5">
              min
            </span>
          </p>
          <p className="text-xs text-[#9A9A9A] mt-1.5">
            total net gain · {recommendation.workers_found ?? 1} worker
            {(recommendation.workers_found ?? 1) > 1 ? "s" : ""}
          </p>
        </div>

        <div>
          <div className="w-full h-2 bg-[#EAEAEA] dark:bg-zinc-800">
            <div
              className="h-full transition-[width] duration-500"
              style={{ width: `${profPct}%`, backgroundColor: barColor }}
            />
          </div>
        </div>

        {recommendation.gap_coverage_pct !== undefined && (
          <div>
            <div className="flex justify-between text-[10px] font-medium text-[#9A9A9A] uppercase tracking-wider mb-1">
              <span>Gap Coverage</span>
              <span className="text-[#333333] dark:text-zinc-200 tabular-nums normal-case">
                {recommendation.gap_coverage_pct.toFixed(0)}%
              </span>
            </div>
            <div className="w-full h-1 bg-[#EAEAEA] dark:bg-zinc-800">
              <div
                className="h-full bg-[#47966F] transition-[width] duration-500"
                style={{ width: `${recommendation.gap_coverage_pct}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-auto pt-4 border-t border-[#F1F1F1] dark:border-zinc-800/50">
          <p className="text-[10px] font-medium text-[#9A9A9A] uppercase tracking-wider mb-2.5">
            Where the minutes go
          </p>
          <SegmentedBar
            height={28}
            items={[
              {
                id: "gain",
                label: "Expected gain",
                value: recommendation.expected_production_gain,
                displayValue: `+${recommendation.expected_production_gain.toFixed(1)}m`,
                color: "#1A7C4B",
              },
              {
                id: "cost",
                label: `Cost of move${(recommendation.workers_found ?? 1) > 1 ? "s" : ""}`,
                value: costOfMove,
                displayValue: `-${costOfMove.toFixed(1)}m`,
                color: "#CE8E33",
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WorkerReallocationPage() {
  const supabase = createClient();

  const [bottlenecks, setBottlenecks] = useState<Bottleneck[]>([]);
  const [bottlenecksError, setBottlenecksError] = useState<string | null>(null);
  const [activeBottleneck, setActiveBottleneck] = useState<Bottleneck | null>(
    null,
  );
  const [recommendation, setRecommendation] =
    useState<RecommendResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [skillMatrix, setSkillMatrix] = useState<SkillMatrixEntry[]>([]);
  const [skillMatrixError, setSkillMatrixError] = useState<string | null>(null);

  // 1. Extracted fetch logic so we can call it after accepting a move
  const fetchStations = useCallback(async () => {
    try {
      const headers = await getAuthHeaders(supabase);
      const r = await fetch(`${API_BASE}/stations`, { headers });
      if (!r.ok) throw new Error(`Stations error ${r.status}`);
      const data: Bottleneck[] = await r.json();
      setBottlenecks(data);

      // Update active bottleneck with new data if it exists
      setActiveBottleneck((prev) =>
        prev
          ? data.find((d) => d.station_id === prev.station_id) || prev
          : (data[0] ?? null),
      );
    } catch (e) {
      setBottlenecksError(
        e instanceof Error ? e.message : "Could not load stations",
      );
    }
  }, [supabase]);

  useEffect(() => {
    fetchStations();
  }, [fetchStations]);

  useEffect(() => {
    (async () => {
      const headers = await getAuthHeaders(supabase);
      fetch(`${API_BASE}/skill-matrix`, { headers })
        .then((r) => {
          if (!r.ok) throw new Error(`Skill matrix error ${r.status}`);
          return r.json();
        })
        .then((data: SkillMatrixEntry[]) => setSkillMatrix(data))
        .catch((e) =>
          setSkillMatrixError(
            e instanceof Error ? e.message : "Could not load skill matrix",
          ),
        );
    })();
  }, []);

  const fetchRecommendation = useCallback(
    async (b: Bottleneck) => {
      try {
        const headers = await getAuthHeaders(supabase);
        const res = await fetch(`${API_BASE}/recommend`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({
            bottleneck_station: b.station_id,
            required_skill: b.required_skill,
            targeted_productivity: b.targeted_productivity,
            actual_productivity: b.actual_productivity,
          }),
        });
        if (!res.ok) {
          const body = await res
            .json()
            .catch(() => ({ detail: res.statusText }));
          throw new Error(body.detail ?? "Error");
        }
        setRecommendation(await res.json());
        setError(null);
        setAccepted(false);
        setLastUpdated(new Date());
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Failed to fetch recommendation",
        );
      } finally {
        setLoading(false);
      }
    },
    [supabase],
  );

  useEffect(() => {
    if (!activeBottleneck) return;

    // Check if the current station is in transit
    const inTransit = isStationInTransit(activeBottleneck.cooldown_until);

    if (!activeBottleneck.is_bottleneck || inTransit) {
      setRecommendation(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchRecommendation(activeBottleneck);
    const id = setInterval(
      () => fetchRecommendation(activeBottleneck),
      RECOMMEND_INTERVAL_MS,
    );
    return () => clearInterval(id);
  }, [activeBottleneck, fetchRecommendation]);

  const handleAcceptMove = async () => {
    if (!recommendation || !activeBottleneck) return;
    setAccepting(true);
    try {
      const headers = await getAuthHeaders(supabase);
      const rawMoves =
        recommendation.moves?.length > 0
          ? recommendation.moves
          : [
              {
                operator_id: recommendation.operator_id,
                from_station: recommendation.from_station,
                to_station: recommendation.to_station,
                proficiency_grade: recommendation.proficiency_grade,
              },
            ];
      const res = await fetch(`${API_BASE}/accept-move`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          moves: rawMoves.map((m) => ({
            operator_id: m.operator_id,
            from_station: m.from_station ?? null,
            to_station: m.to_station ?? activeBottleneck.station_id,
            machine_type: activeBottleneck.required_skill,
            proficiency_grade: m.proficiency_grade,
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(body.detail ?? "Failed");
      }
      setAccepted(true);

      // 2. Automatically refresh the stations to trigger the UI update!
      await fetchStations();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to accept move");
    } finally {
      setAccepting(false);
    }
  };

  const selectBottleneck = (b: Bottleneck) => {
    if (b.station_id === activeBottleneck?.station_id) return;
    setActiveBottleneck(b);
    setLoading(true);
    setAccepted(false);
    setRecommendation(null);
  };

  const gap =
    activeBottleneck?.targeted_productivity &&
    activeBottleneck?.actual_productivity
      ? ((activeBottleneck.targeted_productivity -
          activeBottleneck.actual_productivity) /
          activeBottleneck.targeted_productivity) *
        100
      : null;

  const bottleneckCount = bottlenecks.filter((b) => b.is_bottleneck).length;

  // Calculate if the active station is currently in transit
  const activeInTransit = isStationInTransit(activeBottleneck?.cooldown_until);

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 overflow-hidden">
      <header className="shrink-0 border-b border-[#EAEAEA] dark:border-zinc-800 px-4 py-4 flex items-center justify-between bg-white dark:bg-[#0d0d0f]">
        <div>
          <h1 className="text-lg font-bold text-[#242424] dark:text-zinc-100 tracking-tight">
            Bottleneck &amp; Move Engine
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <time className="hidden sm:block text-[11px] text-[#9A9A9A] dark:text-zinc-600 tabular-nums">
              Last updated{" "}
              {lastUpdated.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          )}
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 border ${bottleneckCount > 0 ? "text-[#A77329] bg-[#EACFA9]/40 border-[#EACFA9] dark:bg-amber-950/20 dark:border-amber-800/40 dark:text-[#E1BA82]" : "text-[#1A7C4B] bg-[#E6F1EC] border-[#B9D7C8] dark:bg-[#0A321E]/20 dark:border-[#104A2D] dark:text-[#47966F]"}`}
          >
            <span
              className={`w-1.5 h-1.5 ${bottleneckCount > 0 ? "bg-[#CE8E33] animate-pulse" : "bg-[#1A7C4B]"}`}
              aria-hidden="true"
            />
            {bottleneckCount > 0
              ? `${bottleneckCount} bottleneck${bottleneckCount > 1 ? "s" : ""} active`
              : "All stations on target"}
          </span>
        </div>
      </header>

      {(bottlenecksError || error) && (
        <div className="shrink-0 px-6 py-2 space-y-1">
          {bottlenecksError && (
            <div className="flex items-center gap-2 border-l-2 border-l-[#CE8E33] border border-[#F4E5D1] bg-[#FDFBF8] dark:bg-amber-950/10 dark:border-amber-800/30 px-3 py-2 text-xs text-[#A77329] dark:text-[#E1BA82]">
              <span aria-hidden="true">⚠</span> {bottlenecksError}
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 border-l-2 border-l-[#CE8E33] border border-[#F4E5D1] bg-[#FDFBF8] dark:bg-amber-950/10 dark:border-amber-800/30 px-3 py-2 text-xs text-[#A77329] dark:text-[#E1BA82]">
              <span aria-hidden="true">⚠</span> {error}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* LEFT: Station List */}
        <StationList
          stations={bottlenecks}
          active={activeBottleneck}
          onSelect={selectBottleneck}
        />

        {/* MIDDLE: Operational Core */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#F8F8F8] dark:bg-[#0a0a0c]">
          <section className="shrink-0 border-b border-[#EAEAEA] dark:border-zinc-800 bg-white dark:bg-[#111113] flex">
            {activeBottleneck ? (
              <>
                <KpiTile
                  label="Station"
                  value={activeBottleneck.station_id}
                  sub={activeBottleneck.required_skill}
                />
                <KpiTile
                  label="WIP Queue"
                  value={`${activeBottleneck.wip}`}
                  sub="units in queue"
                  accent={
                    activeInTransit
                      ? "blue"
                      : activeBottleneck.wip > 40
                        ? "amber"
                        : "none"
                  }
                />
                <KpiTile
                  label="Actual Productivity"
                  value={`${fmt(activeBottleneck.actual_productivity)}%`}
                  sub={`Target: ${fmt(activeBottleneck.targeted_productivity)}%`}
                  accent={
                    activeInTransit
                      ? "blue"
                      : activeBottleneck.is_bottleneck
                        ? "amber"
                        : "green"
                  }
                />
                <KpiTile
                  label="Productivity Gap"
                  value={gap !== null ? `${gap.toFixed(1)}%` : "—"}
                  sub={
                    activeInTransit
                      ? "Worker relocating..."
                      : activeBottleneck.is_bottleneck
                        ? "Below threshold"
                        : "Within normal range"
                  }
                  accent={
                    activeInTransit
                      ? "blue"
                      : activeBottleneck.is_bottleneck
                        ? "amber"
                        : "green"
                  }
                />
              </>
            ) : (
              [1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex-1 border-r border-[#EAEAEA] dark:border-zinc-800 px-5 py-4"
                >
                  <div className="h-2 w-16 bg-[#F1F1F1] dark:bg-zinc-800 animate-pulse mb-3" />
                  <div className="h-7 w-20 bg-[#F1F1F1] dark:bg-zinc-800 animate-pulse mb-2" />
                  <div className="h-2 w-12 bg-[#F1F1F1] dark:bg-zinc-800 animate-pulse" />
                </div>
              ))
            )}
          </section>

          <section className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[2fr_1fr]">
            <RecommendationPanel
              recommendation={recommendation}
              loading={loading}
              isBottleneck={activeBottleneck?.is_bottleneck ?? false}
              inTransit={activeInTransit}
              cooldownUntil={activeBottleneck?.cooldown_until ?? null}
              lastUpdated={lastUpdated}
              onRefresh={() => {
                // ADD THIS GUARD CLAUSE FIRST:
                if (!activeBottleneck) return; 
                
                // Now TypeScript knows activeBottleneck is strictly a 'Bottleneck'
                if (!activeBottleneck.is_bottleneck && !activeInTransit) return;
                
                setLoading(true);
                setAccepted(false);
                fetchRecommendation(activeBottleneck); 
              }}
            />
            <ProfitabilityPanel recommendation={recommendation} />
          </section>

          {/* Accept Move Area - Includes Global Cascade Risk Badge */}
          <div className="shrink-0 flex flex-col border-t border-[#EAEAEA]  justify-between h-16 dark:border-zinc-800 bg-white dark:bg-[#111113]">
            <div className="p-3 flex items-center justify-between">
              <p className="text-[10px] text-[#9A9A9A] dark:text-zinc-500 uppercase tracking-widest hidden sm:block">
                {activeInTransit
                  ? "Move in Progress"
                  : recommendation?.recommended
                    ? "Action Required"
                    : "No Action Needed"}
              </p>
              <button
                onClick={handleAcceptMove}
                disabled={
                  accepted ||
                  accepting ||
                  activeInTransit ||
                  !recommendation?.recommended
                }
                className={`
                  py-2 px-8 text-sm font-semibold tracking-wide border transition-colors cursor-pointer disabled:cursor-not-allowed
                  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A7C4B]
                  ${accepted || activeInTransit ? "bg-[#EFF6FF] text-[#3B82F6] border-[#BFDBFE] dark:bg-[#1E3A8A]/40 dark:text-[#60A5FA] dark:border-[#1E3A8A]" : accepting ? "bg-[#F1F1F1] text-[#9A9A9A] border-[#EAEAEA] dark:bg-zinc-800 dark:border-zinc-700" : "bg-[#1A7C4B] hover:bg-[#15633C] text-white border-[#15633C]"}
                `}
              >
                {accepted || activeInTransit
                  ? "✓ Move in Progress"
                  : accepting
                    ? "Processing…"
                    : `Accept ${recommendation?.workers_found && recommendation.workers_found > 1 ? `${recommendation.workers_found} Moves` : "Move"}`}
              </button>
            </div>
          </div>
        </main>

        {/* RIGHT: Heatmap Panel */}
        <aside className="w-95 shrink-0 border-l border-[#EAEAEA] dark:border-zinc-800 flex flex-col bg-white dark:bg-[#111113]">
          <div className="shrink-0 border-b border-[#EAEAEA] dark:border-zinc-800 px-5 py-3">
            <p className="text-[10px] font-medium tracking-widest text-[#9A9A9A] dark:text-zinc-500 uppercase mb-0.5">
              {activeBottleneck
                ? `${activeBottleneck.station_id} · ${activeBottleneck.required_skill}`
                : "Qualified operators"}
            </p>
            <h2 className="text-sm font-bold text-[#242424] dark:text-zinc-100">
              Workforce Efficiency
            </h2>
          </div>

          <div
            className={`flex-1 overflow-y-auto px-5 py-4 min-h-0 [&>div]:flex-col [&>div]:items-start [&>div>div:first-child]:mb-2 ${SCROLLBAR}`}
          >
            {skillMatrixError && (
              <div className="flex items-center gap-2 border-l-2 border-l-[#CE8E33] bg-[#FDFBF8] dark:bg-[#1A1510] px-3 py-2 text-xs text-[#A77329] dark:text-[#E1BA82] mb-4">
                <span aria-hidden="true">⚠</span> {skillMatrixError}
              </div>
            )}
            <StationWorkersGrid
              stations={activeBottleneck ? [activeBottleneck] : []}
              skillMatrix={skillMatrix}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
