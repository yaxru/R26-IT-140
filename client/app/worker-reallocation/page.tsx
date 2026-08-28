"use client";

import { useEffect, useState, useCallback } from "react";
import type { Bottleneck, RecommendResponse, SkillMatrixEntry } from "../types";
import { StationWorkersGrid } from "../components/StationWorkersGrid";
import { RankedBarList } from "../components/RankedBarList";
import { SegmentedBar } from "../components/SegmentedBar";
import { HoverTooltip } from "../components/HoverTooltip";
import { createClient } from "@/lib/supabase/client";
import { getAuthHeaders } from "@/shared/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const RECOMMEND_INTERVAL_MS = 3_600_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, digits = 0) {
  if (n == null) return "—";
  return (n * 100).toFixed(digits);
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

// ─── Station List (left panel) ────────────────────────────────────────────────

function StationList({
  stations,
  active,
  onSelect,
}: {
  stations: Bottleneck[];
  active: Bottleneck | null;
  onSelect: (b: Bottleneck) => void;
}) {
  const criticalCount = stations.filter((s) => s.is_bottleneck).length;

  return (
    <aside
      aria-label="Production stations"
      className="w-56 shrink-0 border-r border-[#EAEAEA] dark:border-zinc-800 flex flex-col self-stretch"
    >
      {/* Panel header */}
      <div className="px-4 py-3 border-b border-[#EAEAEA] dark:border-zinc-800">
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

      {/* Station rows */}
      <nav className="flex-1 overflow-y-auto">
        {stations.length === 0 ? (
          <div className="flex flex-col divide-y divide-[#F1F1F1] dark:divide-zinc-800/60">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3">
                <div className="w-2 h-2 bg-[#F1F1F1] dark:bg-zinc-800 animate-pulse" />
                <div className="flex-1">
                  <div className="h-3 w-20 bg-[#F1F1F1] dark:bg-zinc-800 animate-pulse mb-1.5" />
                  <div className="h-2 w-12 bg-[#F1F1F1] dark:bg-zinc-800 animate-pulse" />
                </div>
                <div className="h-3 w-5 bg-[#F1F1F1] dark:bg-zinc-800 animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-[#F1F1F1] dark:divide-zinc-800/60">
            {stations.map((b) => {
              const isActive = active?.station_id === b.station_id;
              const pct =
                b.targeted_productivity && b.actual_productivity
                  ? Math.round(
                      (b.actual_productivity / b.targeted_productivity) * 100,
                    )
                  : null;

              return (
                <li key={b.station_id}>
                  <button
                    onClick={() => onSelect(b)}
                    aria-pressed={isActive}
                    aria-label={`${b.station_id}, ${b.is_bottleneck ? "critical bottleneck" : "on target"}, WIP ${b.wip}`}
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
                    {/* Status dot */}
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 w-1.5 h-1.5 shrink-0 ${b.is_bottleneck ? "bg-[#CE8E33] animate-pulse" : "bg-[#1A7C4B]"}`}
                    />

                    {/* Station info */}
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
                            color={b.is_bottleneck ? "#CE8E33" : "#1A7C4B"}
                          />
                        </div>
                      )}
                    </div>

                    {/* WIP badge */}
                    <span
                      className={`mt-0.5 text-[10px] font-mono font-bold tabular-nums ${b.is_bottleneck ? "text-[#CE8E33]" : "text-[#9A9A9A] dark:text-zinc-500"}`}
                    >
                      {b.wip}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      {/* Legend */}
      <div className="px-4 py-3 border-t border-[#EAEAEA] dark:border-zinc-800 flex flex-col gap-1.5">
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
        <p className="text-[10px] text-[#C6C6C6] dark:text-zinc-700 mt-0.5">
          Bar = actual productivity
        </p>
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
  accent?: "green" | "amber" | "none";
}) {
  const valueColor =
    accent === "green"
      ? "text-[#1A7C4B] dark:text-[#47966F]"
      : accent === "amber"
        ? "text-[#CE8E33] dark:text-[#D7A45A]"
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
  accepted,
  accepting,
  isBottleneck,
  lastUpdated,
  onRefresh,
  onAccept,
}: {
  recommendation: RecommendResponse | null;
  loading: boolean;
  accepted: boolean;
  accepting: boolean;
  isBottleneck: boolean;
  lastUpdated: Date | null;
  onRefresh: () => void;
  onAccept: () => void;
}) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Panel header */}
      <div className="shrink-0 flex items-center justify-between border-b border-[#EAEAEA] dark:border-zinc-800 px-5 py-3">
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
            <time
              dateTime={lastUpdated.toISOString()}
              className="text-[10px] text-[#9A9A9A] dark:text-zinc-600 tabular-nums"
            >
              {lastUpdated.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          ) : null}
          <button
            onClick={onRefresh}
            disabled={loading || !isBottleneck}
            aria-label="Refresh recommendation"
            className="w-6 h-6 flex items-center justify-center text-[#9A9A9A] hover:text-[#242424] dark:hover:text-zinc-200 disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-not-allowed hover:bg-[#F1F1F1] dark:hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-[#1A7C4B]"
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
              aria-hidden="true"
            >
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M8 16H3v5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Panel body */}
      <div className="flex-1 px-5 py-4 overflow-y-auto flex flex-col min-h-0">
        {!isBottleneck ? (
          /* Healthy station */
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
          /* Loading skeleton */
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
            className={`flex-1 flex flex-col gap-4 transition-opacity duration-300 ${accepted ? "opacity-40" : "opacity-100"}`}
          >
            {!recommendation.recommended ? (
              /* No move justified */
              <>
                <div
                  role="alert"
                  className="flex items-center gap-2 px-3 py-2.5 bg-[#FDFBF8] dark:bg-amber-950/10 border-l-2 border-l-[#CE8E33] border border-[#F4E5D1] dark:border-amber-800/30"
                >
                  <span className="text-[#CE8E33] text-xs" aria-hidden="true">
                    ⚠
                  </span>
                  <span className="text-xs font-semibold text-[#A77329] dark:text-[#E1BA82] uppercase tracking-wider">
                    No Move Recommended
                  </span>
                </div>
                <p className="text-xs text-[#5F5F5F] dark:text-zinc-400 leading-relaxed">
                  {recommendation.no_move_reason}
                </p>
                <div className="grid grid-cols-2 gap-2 opacity-60 mt-auto">
                  {[
                    {
                      label: "Best Available",
                      value: recommendation.operator_id,
                    },
                    { label: "Grade", value: recommendation.proficiency_grade },
                    {
                      label: "Gain",
                      value: `${recommendation.expected_production_gain.toFixed(1)} min`,
                    },
                    {
                      label: "Cost",
                      value: `${recommendation.cost_of_move.toFixed(1)} min`,
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="bg-[#F8F8F8] dark:bg-zinc-900 border border-[#F1F1F1] dark:border-zinc-800/40 px-3 py-2"
                    >
                      <p className="text-[10px] text-[#9A9A9A] dark:text-zinc-600 uppercase tracking-wide mb-0.5">
                        {item.label}
                      </p>
                      <p className="text-xs font-semibold text-[#333333] dark:text-zinc-200 truncate tabular-nums">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              /* Move plan */
              <>
                {/* Coverage summary */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1.5">
                    <span className="text-[#9A9A9A] dark:text-zinc-500">
                      {recommendation.workers_found} of{" "}
                      {recommendation.workers_needed} workers needed
                    </span>
                    <span className="font-semibold text-[#1A7C4B] dark:text-[#47966F] tabular-nums">
                      {recommendation.gap_coverage_pct.toFixed(0)}% gap covered
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-valuenow={Math.round(recommendation.gap_coverage_pct)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Gap coverage"
                    className="w-full h-1 bg-[#EAEAEA] dark:bg-zinc-800"
                  >
                    <div
                      className="h-full bg-[#1A7C4B] transition-[width] duration-500"
                      style={{ width: `${recommendation.gap_coverage_pct}%` }}
                    />
                  </div>
                </div>

                {/* Ranked bar chart for multi-worker */}
                {recommendation.moves.length > 1 && (
                  <div>
                    <p className="text-[10px] font-medium text-[#9A9A9A] dark:text-zinc-600 uppercase tracking-wider mb-2">
                      Ranked by contribution
                    </p>
                    <RankedBarList
                      items={[...recommendation.moves]
                        .sort((a, b) => b.net_profit - a.net_profit)
                        .map((m) => ({
                          id: m.operator_id,
                          label: m.operator_id,
                          sublabel: `Grade ${m.proficiency_grade}`,
                          value: Math.max(m.net_profit, 0.01),
                          displayValue: `${m.net_profit >= 0 ? "+" : ""}${m.net_profit.toFixed(1)}m`,
                          accent: m.donor_cascade_risk ? "amber" : "emerald",
                        }))}
                    />
                  </div>
                )}

                {/* Worker rows */}
                <div className="flex flex-col divide-y divide-[#F1F1F1] dark:divide-zinc-800/50 border border-[#EAEAEA] dark:border-zinc-800">
                  {recommendation.moves.map((move, i) => (
                    <div
                      key={move.operator_id}
                      className={`px-3 py-2.5 text-[11px] ${move.donor_cascade_risk ? "bg-[#FDFBF8] dark:bg-amber-950/10" : "bg-white dark:bg-transparent"}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-[#333333] dark:text-zinc-200">
                          {i + 1}. {move.operator_id}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-[#EAEAEA] dark:bg-zinc-800 text-[#5F5F5F] dark:text-zinc-400 font-medium">
                          Grade {move.proficiency_grade}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[#9A9A9A] dark:text-zinc-500 font-mono">
                        <span>
                          {move.from_station ?? "—"} → {move.to_station}
                        </span>
                        <span className="ml-auto text-[#1A7C4B] dark:text-[#47966F] font-semibold">
                          +{move.net_profit.toFixed(1)} min
                        </span>
                      </div>
                      {move.donor_cascade_risk && (
                        <p className="mt-1.5 text-[10px] text-[#A77329] dark:text-[#E1BA82]">
                          ⚠ {move.donor_risk_detail}
                        </p>
                      )}
                      {move.donor_cascade_risk && move.donor_replacement_id && (
                        <p className="text-[10px] text-[#1A7C4B] dark:text-[#47966F]">
                          ↩ Backfill {move.from_station}:{" "}
                          {move.donor_replacement_id} (Grade{" "}
                          {move.donor_replacement_grade})
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Cascade warning */}
                {recommendation.cascade_warnings.length > 0 && (
                  <div
                    role="alert"
                    className="border-l-2 border-l-[#CE8E33] border border-[#F4E5D1] dark:border-amber-800/30 px-3 py-2 bg-[#FDFBF8] dark:bg-amber-950/10"
                  >
                    <p className="text-[10px] font-semibold text-[#A77329] dark:text-[#E1BA82] uppercase tracking-wider mb-1">
                      Cascade Risk
                    </p>
                    {recommendation.cascade_warnings.map((w, i) => (
                      <p
                        key={i}
                        className="text-[10px] text-[#A77329] dark:text-[#E1BA82] leading-relaxed"
                      >
                        {w}
                      </p>
                    ))}
                  </div>
                )}

                {/* Accept */}
                <button
                  onClick={onAccept}
                  disabled={accepted || accepting}
                  className={`
                    mt-auto w-full py-2.5 px-4 text-sm font-semibold tracking-wide border
                    transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed
                    focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A7C4B]
                    ${
                      accepted
                        ? "bg-[#E6F1EC] dark:bg-[#0A321E]/40 text-[#1A7C4B] dark:text-[#47966F] border-[#B9D7C8] dark:border-[#104A2D]"
                        : accepting
                          ? "bg-[#F1F1F1] dark:bg-zinc-800 text-[#9A9A9A] border-[#EAEAEA] dark:border-zinc-700"
                          : "bg-[#1A7C4B] hover:bg-[#15633C] text-white border-[#15633C]"
                    }
                  `}
                >
                  {accepted
                    ? "✓ Moves Accepted"
                    : accepting
                      ? "Processing…"
                      : `Accept ${recommendation.workers_found > 1 ? `${recommendation.workers_found} Moves` : "Move"}`}
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center py-8">
            <p className="text-xs text-[#9A9A9A] dark:text-zinc-600">
              Awaiting station data
            </p>
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
      <div className="flex flex-col h-full">
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
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-[#EAEAEA] dark:border-zinc-800 px-5 py-3">
        <p className="text-[10px] font-medium tracking-widest text-[#9A9A9A] dark:text-zinc-500 uppercase">
          Profitability · Cost breakdown
        </p>
      </div>

      <div className="flex-1 px-5 py-4 flex flex-col gap-5 overflow-y-auto min-h-0">
        {/* Big score */}
        <div>
          <p
            className={`text-4xl font-bold tabular-nums leading-none ${score > 0 ? "text-[#1A7C4B] dark:text-[#47966F]" : "text-[#CE8E33]"}`}
          >
            {score > 0 ? "+" : ""}
            {score.toFixed(1)}
            <span className="text-base font-normal text-[#9A9A9A] dark:text-zinc-600 ml-1.5">
              min
            </span>
          </p>
          <p className="text-xs text-[#9A9A9A] dark:text-zinc-600 mt-1.5">
            total net gain · {recommendation.workers_found ?? 1} worker
            {(recommendation.workers_found ?? 1) > 1 ? "s" : ""}
          </p>
        </div>

        {/* Score bar */}
        <div>
          <div
            role="progressbar"
            aria-valuenow={Math.round(profPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Profitability score"
            className="w-full h-2 bg-[#EAEAEA] dark:bg-zinc-800"
          >
            <div
              className="h-full transition-[width] duration-500"
              style={{ width: `${profPct}%`, backgroundColor: barColor }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-[#9A9A9A] dark:text-zinc-600 mt-1">
            <span>Low</span>
            <span className="tabular-nums font-medium">
              {profPct.toFixed(0)}%
            </span>
            <span>High</span>
          </div>
        </div>

        {/* Gap coverage */}
        {recommendation.gap_coverage_pct !== undefined && (
          <div>
            <div className="flex justify-between text-[10px] font-medium text-[#9A9A9A] dark:text-zinc-600 uppercase tracking-wider mb-1">
              <span>Gap Coverage</span>
              <span className="text-[#333333] dark:text-zinc-300 tabular-nums normal-case">
                {recommendation.gap_coverage_pct.toFixed(0)}%
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={Math.round(recommendation.gap_coverage_pct)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Gap coverage percentage"
              className="w-full h-1 bg-[#EAEAEA] dark:bg-zinc-800"
            >
              <div
                className="h-full bg-[#47966F] transition-[width] duration-500"
                style={{ width: `${recommendation.gap_coverage_pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Cost breakdown */}
        <div className="mt-auto pt-4 border-t border-[#F1F1F1] dark:border-zinc-800/50">
          <p className="text-[10px] font-medium text-[#9A9A9A] dark:text-zinc-600 uppercase tracking-wider mb-2.5">
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

  useEffect(() => {
    (async () => {
      const headers = await getAuthHeaders(supabase);
      fetch(`${API_BASE}/stations`, { headers })
        .then((r) => {
          if (!r.ok) throw new Error(`Stations error ${r.status}`);
          return r.json();
        })
        .then((data: Bottleneck[]) => {
          setBottlenecks(data);
          setActiveBottleneck(data[0] ?? null);
        })
        .catch((e) =>
          setBottlenecksError(
            e instanceof Error ? e.message : "Could not load stations",
          ),
        );
    })();
  }, []); // eslint-disable-line

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
  }, []); // eslint-disable-line

  const fetchRecommendation = useCallback(async (b: Bottleneck) => {
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
        const body = await res.json().catch(() => ({ detail: res.statusText }));
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
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!activeBottleneck) return;
    if (!activeBottleneck.is_bottleneck) {
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

  // Derived KPIs for the active station
  const gap =
    activeBottleneck?.targeted_productivity &&
    activeBottleneck?.actual_productivity
      ? ((activeBottleneck.targeted_productivity -
          activeBottleneck.actual_productivity) /
          activeBottleneck.targeted_productivity) *
        100
      : null;

  const bottleneckCount = bottlenecks.filter((b) => b.is_bottleneck).length;

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 overflow-hidden">
      {/* ── Top bar ──────────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-[#EAEAEA] dark:border-zinc-800 px-6 py-4 flex items-center justify-between bg-white dark:bg-[#0d0d0f]">
        <div>
          <p className="text-[10px] font-medium tracking-widest text-[#9A9A9A] dark:text-zinc-500 uppercase mb-0.5">
            Management · Worker Reallocation
          </p>
          <h1 className="text-lg font-bold text-[#242424] dark:text-zinc-100 tracking-tight">
            Bottleneck &amp; Move Engine
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <time
              dateTime={lastUpdated.toISOString()}
              className="hidden sm:block text-[11px] text-[#9A9A9A] dark:text-zinc-600 tabular-nums"
            >
              Last updated{" "}
              {lastUpdated.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          )}
          <span
            role="status"
            aria-live="polite"
            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 border ${
              bottleneckCount > 0
                ? "text-[#A77329] dark:text-[#E1BA82] bg-[#FDFBF8] dark:bg-amber-950/20 border-[#EACFA9] dark:border-amber-800/40"
                : "text-[#1A7C4B] dark:text-[#47966F] bg-[#E6F1EC] dark:bg-[#0A321E]/20 border-[#B9D7C8] dark:border-[#104A2D]"
            }`}
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

      {/* Error banners */}
      {(bottlenecksError || error) && (
        <div className="shrink-0 px-6 py-2 space-y-1">
          {bottlenecksError && (
            <div
              role="alert"
              className="flex items-center gap-2 border-l-2 border-l-[#CE8E33] border border-[#F4E5D1] dark:border-amber-800/30 bg-[#FDFBF8] dark:bg-amber-950/10 px-3 py-2 text-xs text-[#A77329] dark:text-[#E1BA82]"
            >
              <span aria-hidden="true">⚠</span> {bottlenecksError}
            </div>
          )}
          {error && (
            <div
              role="alert"
              className="flex items-center gap-2 border-l-2 border-l-[#CE8E33] border border-[#F4E5D1] dark:border-amber-800/30 bg-[#FDFBF8] dark:bg-amber-950/10 px-3 py-2 text-xs text-[#A77329] dark:text-[#E1BA82]"
            >
              <span aria-hidden="true">⚠</span> {error}
            </div>
          )}
        </div>
      )}

      {/* ── Main body: left station list + right detail ──────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Station list — always visible */}
        <StationList
          stations={bottlenecks}
          active={activeBottleneck}
          onSelect={selectBottleneck}
        />

        {/* Right: Station detail — scrollable */}
        <main className="flex-1 flex flex-col min-h-0 bg-[#F8F8F8] dark:bg-[#0a0a0c]">
          {" "}
          {/* ── KPI row ─────────────────────────────────────────── */}
          <section
            aria-label="Station key metrics"
            className="shrink-0 border-b border-[#EAEAEA] dark:border-zinc-800 bg-white dark:bg-[#111113] flex"
          >
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
                  accent={activeBottleneck.wip > 40 ? "amber" : "none"}
                />
                <KpiTile
                  label="Actual Productivity"
                  value={`${fmt(activeBottleneck.actual_productivity)}%`}
                  sub={`Target: ${fmt(activeBottleneck.targeted_productivity)}%`}
                  accent={activeBottleneck.is_bottleneck ? "amber" : "green"}
                />
                <KpiTile
                  label="Productivity Gap"
                  value={gap !== null ? `${gap.toFixed(1)}%` : "—"}
                  sub={
                    activeBottleneck.is_bottleneck
                      ? "Below threshold"
                      : "Within normal range"
                  }
                  accent={activeBottleneck.is_bottleneck ? "amber" : "green"}
                />
              </>
            ) : (
              /* KPI skeleton */
              [1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex-1 border-r border-[#EAEAEA] dark:border-zinc-800 last:border-r-0 px-5 py-4"
                >
                  <div className="h-2 w-16 bg-[#F1F1F1] dark:bg-zinc-800 animate-pulse mb-3" />
                  <div className="h-7 w-20 bg-[#F1F1F1] dark:bg-zinc-800 animate-pulse mb-2" />
                  <div className="h-2 w-12 bg-[#F1F1F1] dark:bg-zinc-800 animate-pulse" />
                </div>
              ))
            )}
          </section>
          {/* ── Recommendation + Profitability ─────────────────── */}
          <section
            aria-label="Move recommendation and profitability"
            className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[2fr_1fr] border-b border-[#EAEAEA] dark:border-zinc-800"
          >
            {/* Recommendation */}
            <div className="border-r border-[#EAEAEA] dark:border-zinc-800 bg-white dark:bg-[#111113] min-h-0 flex flex-col">
              <RecommendationPanel
                recommendation={recommendation}
                loading={loading}
                accepted={accepted}
                accepting={accepting}
                isBottleneck={activeBottleneck?.is_bottleneck ?? false}
                lastUpdated={lastUpdated}
                onRefresh={() => {
                  if (!activeBottleneck?.is_bottleneck) return;
                  setLoading(true);
                  setAccepted(false);
                  fetchRecommendation(activeBottleneck);
                }}
                onAccept={handleAcceptMove}
              />
            </div>

            {/* Profitability */}
            <div className="bg-white dark:bg-[#111113] min-h-0 flex flex-col">
              <ProfitabilityPanel recommendation={recommendation} />
            </div>
          </section>
          {/* ── Workforce efficiency heatmap ───────────────────── */}
          <section
            aria-labelledby="workforce-heading"
            className="shrink-0 h-[40%] min-h-0 flex flex-col bg-white dark:bg-[#111113] border-b border-[#EAEAEA] dark:border-zinc-800"
          >
            <div className="shrink-0 border-b border-[#EAEAEA] dark:border-zinc-800 px-5 py-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium tracking-widest text-[#9A9A9A] dark:text-zinc-500 uppercase mb-0.5">
                  {activeBottleneck
                    ? `${activeBottleneck.station_id} · ${activeBottleneck.required_skill}`
                    : "Qualified operators"}
                </p>
                <h2
                  id="workforce-heading"
                  className="text-sm font-bold text-[#242424] dark:text-zinc-100"
                >
                  Workforce Efficiency
                </h2>
              </div>
              <p className="text-[11px] text-[#9A9A9A] dark:text-zinc-600 text-right hidden sm:block">
                Hover a block to view operator details
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
              {skillMatrixError && (
                <div
                  role="alert"
                  className="flex items-center gap-2 border-l-2 border-l-[#CE8E33] border border-[#F4E5D1] dark:border-amber-800/30 bg-[#FDFBF8] dark:bg-amber-950/10 px-3 py-2 text-xs text-[#A77329] dark:text-[#E1BA82] mb-4"
                >
                  <span aria-hidden="true">⚠</span> {skillMatrixError}
                </div>
              )}
              <StationWorkersGrid
                stations={activeBottleneck ? [activeBottleneck] : []}
                skillMatrix={skillMatrix}
              />
            </div>
          </section>
          {/* ── Footer ─────────────────────────────────────────── */}
          <footer className="shrink-0 px-5 py-3">
            <p className="text-[11px] text-[#C6C6C6] dark:text-zinc-700">
              Opsis · Profitability Engine v1.0 · Recommendations refresh hourly
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
