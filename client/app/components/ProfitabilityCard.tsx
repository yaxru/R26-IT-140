import type { RecommendResponse } from "../types";

const NET_PROFIT_MIN = -15;
const NET_PROFIT_MAX = 20;

interface ProfitabilityCardProps {
  recommendation: RecommendResponse | null;
}

export function ProfitabilityCard({ recommendation }: ProfitabilityCardProps) {
  const score =
    recommendation?.total_net_profit ?? recommendation?.net_profit ?? 0;
  const profitabilityPct = recommendation
    ? Math.max(
        0,
        Math.min(
          100,
          ((score - NET_PROFIT_MIN) / (NET_PROFIT_MAX - NET_PROFIT_MIN)) * 100,
        ),
      )
    : 0;

  const barGradient = !recommendation
    ? "from-zinc-500 to-zinc-400"
    : score > 8
      ? "from-emerald-500 to-teal-400"
      : score > 0
        ? "from-amber-500 to-yellow-400"
        : "from-red-600 to-rose-500";

  return (
    <div className="bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800/60 p-6 flex flex-col gap-5">
      <span className="text-[10px] font-mono tracking-widest text-zinc-400 dark:text-zinc-500 uppercase">
        Profitability Score
      </span>

      {recommendation ? (
        <>
          {/* Big number */}
          <div>
            <div
              className={`text-5xl font-bold font-mono tracking-tight tabular-nums ${
                score > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {score > 0 ? "+" : ""}
              {score.toFixed(1)}
              <span className="text-lg font-normal text-zinc-400 dark:text-zinc-600 ml-1.5">
                min
              </span>
            </div>
            <div className="text-xs font-mono text-zinc-400 dark:text-zinc-600 mt-1">
              total net gain · {recommendation.workers_found ?? 1} worker
              {(recommendation.workers_found ?? 1) > 1 ? "s" : ""}
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div className="w-full h-2.5 bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
              <div
                className={`h-full bg-linear-to-r ${barGradient} transition-all duration-500`}
                style={{ width: `${profitabilityPct}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-[9px] font-mono text-zinc-400 dark:text-zinc-600">
              <span>Low</span>
              <span className="tabular-nums">
                {profitabilityPct.toFixed(0)}%
              </span>
              <span>High</span>
            </div>
          </div>

          {/* Gap coverage */}
          {recommendation.gap_coverage_pct !== undefined && (
            <div>
              <div className="flex items-center justify-between mb-1 text-[9px] font-mono text-zinc-400 dark:text-zinc-600 uppercase tracking-wider">
                <span>Gap Coverage</span>
                <span className="text-zinc-600 dark:text-zinc-400 font-semibold tabular-nums">
                  {recommendation.gap_coverage_pct.toFixed(0)}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
                <div
                  className="h-full bg-sky-500 transition-all duration-500"
                  style={{ width: `${recommendation.gap_coverage_pct}%` }}
                />
              </div>
            </div>
          )}

          {/* Gain / Cost breakdown */}
          <div className="mt-auto grid grid-cols-2 gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800/50">
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 p-3">
              <div className="text-[9px] font-mono text-emerald-600 dark:text-emerald-700 uppercase tracking-wider mb-1.5">
                Expected Gain
              </div>
              <div className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                +{recommendation.expected_production_gain.toFixed(1)} min
              </div>
            </div>
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 p-3">
              <div className="text-[9px] font-mono text-red-500 dark:text-red-700 uppercase tracking-wider mb-1.5">
                Cost of Move{(recommendation.workers_found ?? 1) > 1 ? "s" : ""}
              </div>
              <div className="text-sm font-mono font-bold text-red-500 dark:text-red-400 tabular-nums">
                −{(recommendation.expected_production_gain - score).toFixed(1)}{" "}
                min
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center py-10">
          <span className="text-sm font-mono text-zinc-400 dark:text-zinc-600">
            Awaiting recommendation…
          </span>
        </div>
      )}
    </div>
  );
}
