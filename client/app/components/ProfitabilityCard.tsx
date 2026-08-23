import type { RecommendResponse } from "../types";
import { SegmentedBar } from "./SegmentedBar";

const NET_PROFIT_MIN = -15;
const NET_PROFIT_MAX = 20;

interface ProfitabilityCardProps {
  recommendation: RecommendResponse | null;
}

// Skeleton matches real card structure exactly
function Skeleton() {
  return (
    <div className="bg-white dark:bg-[#111113] border border-[#EAEAEA] dark:border-zinc-800/60 rounded-xl p-6 flex flex-col h-full min-h-[220px]">
      <div className="h-3 w-40 bg-[#F1F1F1] dark:bg-zinc-800 rounded animate-pulse mb-6" />
      <div className="mb-1">
        <div className="h-12 w-28 bg-[#F1F1F1] dark:bg-zinc-800 rounded animate-pulse mb-2" />
        <div className="h-3 w-24 bg-[#F1F1F1] dark:bg-zinc-800 rounded animate-pulse" />
      </div>
      <div className="h-2.5 w-full bg-[#F1F1F1] dark:bg-zinc-800 rounded-full animate-pulse mt-5" />
      <div className="mt-auto pt-5 border-t border-[#F1F1F1] dark:border-zinc-800/40">
        <div className="h-3 w-32 bg-[#F1F1F1] dark:bg-zinc-800 rounded animate-pulse mb-3" />
        <div className="h-7 w-full bg-[#F1F1F1] dark:bg-zinc-800 rounded animate-pulse" />
      </div>
    </div>
  );
}

export function ProfitabilityCard({ recommendation }: ProfitabilityCardProps) {
  if (!recommendation) return <Skeleton />;

  const score = recommendation.total_net_profit ?? recommendation.net_profit ?? 0;
  const profitabilityPct = Math.max(
    0,
    Math.min(100, ((score - NET_PROFIT_MIN) / (NET_PROFIT_MAX - NET_PROFIT_MIN)) * 100)
  );
  const costOfMove = Math.max(0, recommendation.expected_production_gain - score);

  const isPositive = score > 0;
  const isHighProfit = score > 8;

  const barColor = isHighProfit
    ? "#1A7C4B"   // brand-600
    : score > 0
      ? "#D7A45A"  // amber-brand-500
      : "#CE8E33"; // amber-brand-600

  return (
    <article
      aria-label={`Profitability: ${score.toFixed(1)} minutes net gain`}
      className="bg-white dark:bg-[#111113] border border-[#EAEAEA] dark:border-zinc-800/60 rounded-xl p-6 flex flex-col h-full min-h-[220px]"
    >
      <span className="text-[11px] font-medium tracking-widest text-[#9A9A9A] dark:text-zinc-500 uppercase mb-5">
        Profitability · Cost breakdown
      </span>

      {/* Big number */}
      <div className="mb-5">
        <p
          className={`text-4xl font-bold tabular-nums leading-none tracking-tight ${
            isPositive
              ? "text-brand-600 dark:text-brand-400"
              : "text-[#CE8E33] dark:text-[#D7A45A]"
          }`}
        >
          {isPositive ? "+" : ""}{score.toFixed(1)}
          <span className="text-lg font-normal text-[#9A9A9A] dark:text-zinc-600 ml-1.5">min</span>
        </p>
        <p className="text-xs text-[#9A9A9A] dark:text-zinc-600 mt-1.5">
          total net gain · {recommendation.workers_found ?? 1} worker
          {(recommendation.workers_found ?? 1) > 1 ? "s" : ""}
        </p>
      </div>

      {/* Profitability bar */}
      <div className="mb-5">
        <div
          role="progressbar"
          aria-valuenow={Math.round(profitabilityPct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Profitability score"
          className="w-full h-2.5 bg-[#F1F1F1] dark:bg-zinc-900 rounded-full overflow-hidden"
        >
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${profitabilityPct}%`, backgroundColor: barColor }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] text-[#9A9A9A] dark:text-zinc-600">
          <span>Low</span>
          <span className="tabular-nums font-medium">{profitabilityPct.toFixed(0)}%</span>
          <span>High</span>
        </div>
      </div>

      {/* Gap coverage */}
      {recommendation.gap_coverage_pct !== undefined && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-1.5 text-[10px] font-medium text-[#9A9A9A] dark:text-zinc-600 uppercase tracking-wider">
            <span>Gap Coverage</span>
            <span className="text-[#333333] dark:text-zinc-300 tabular-nums">
              {recommendation.gap_coverage_pct.toFixed(0)}%
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={Math.round(recommendation.gap_coverage_pct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Gap coverage percentage"
            className="w-full h-1.5 bg-[#F1F1F1] dark:bg-zinc-900 rounded-full overflow-hidden"
          >
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${recommendation.gap_coverage_pct}%`, backgroundColor: "#47966F" }}
            />
          </div>
        </div>
      )}

      {/* Cost breakdown segmented bar */}
      <div className="mt-auto pt-4 border-t border-[#F1F1F1] dark:border-zinc-800/40">
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
    </article>
  );
}
