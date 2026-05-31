import type { RecommendResponse, SingleMove } from "../types";

interface RecommendationCardProps {
  recommendation: RecommendResponse | null;
  loading: boolean;
  accepted: boolean;
  accepting: boolean;
  isBottleneck: boolean;
  lastUpdated: Date | null;
  onRefresh: () => void;
  onAccept: () => void;
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-50 dark:bg-zinc-900/60 p-3 border border-zinc-100 dark:border-zinc-800/40">
      <div className="text-[9px] font-mono text-zinc-400 dark:text-zinc-600 uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="text-sm font-mono font-semibold text-zinc-800 dark:text-zinc-200 truncate">
        {value}
      </div>
    </div>
  );
}

function WorkerRow({ move, index }: { move: SingleMove; index: number }) {
  return (
    <div
      className={`p-3 border text-[11px] font-mono ${
        move.donor_cascade_risk
          ? "border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20"
          : "border-zinc-100 dark:border-zinc-800/40 bg-zinc-50 dark:bg-zinc-900/40"
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-semibold text-zinc-800 dark:text-zinc-200">
          {index + 1}. {move.operator_id}
        </span>
        <span className="text-[9px] px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
          Grade {move.proficiency_grade}
        </span>
      </div>
      <div className="flex gap-3 text-zinc-500 dark:text-zinc-500">
        <span>
          {move.from_station ?? "—"} → {move.to_station}
        </span>
        <span className="ml-auto text-emerald-600 dark:text-emerald-400">
          +{move.net_profit.toFixed(1)} min
        </span>
      </div>
      {move.donor_cascade_risk && (
        <div className="mt-1.5 flex items-center gap-1 text-amber-600 dark:text-amber-400">
          <span>⚠</span>
          <span className="text-[9px]">{move.donor_risk_detail}</span>
        </div>
      )}
      {move.donor_cascade_risk && move.donor_replacement_id && (
        <div className="mt-1 flex items-center gap-1 text-sky-600 dark:text-sky-400">
          <span className="text-[10px]">↩</span>
          <span className="text-[9px]">
            Backfill {move.from_station}: {move.donor_replacement_id} (Grade{" "}
            {move.donor_replacement_grade})
          </span>
        </div>
      )}
    </div>
  );
}

export function RecommendationCard({
  recommendation,
  loading,
  accepted,
  accepting,
  isBottleneck,
  lastUpdated,
  onRefresh,
  onAccept,
}: RecommendationCardProps) {
  // Station is healthy — show info, no action needed
  if (!isBottleneck) {
    return (
      <div className="bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800/60 p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono tracking-widest text-zinc-400 dark:text-zinc-500 uppercase">
            Move Recommendation
          </span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center py-10 gap-3">
          <div className="w-10 h-10 border-2 border-emerald-200 dark:border-emerald-900 flex items-center justify-center">
            <span className="text-emerald-500 text-lg font-mono">✓</span>
          </div>
          <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 text-center">
            Station is on target
          </span>
          <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-600 text-center">
            No operator move needed
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800/60 p-6 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono tracking-widest text-zinc-400 dark:text-zinc-500 uppercase">
          Move Recommendation
        </span>
        <div className="flex items-center gap-2">
          {loading ? (
            <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-600 animate-pulse">
              UPDATING…
            </span>
          ) : lastUpdated ? (
            <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-600 tabular-nums">
              {lastUpdated.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          ) : null}
          <button
            onClick={onRefresh}
            disabled={loading}
            title="Refresh recommendation"
            className="text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300 disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M8 16H3v5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && !recommendation ? (
        <div className="flex-1 flex items-center justify-center py-10">
          <div className="w-8 h-8 border-2 border-zinc-200 dark:border-zinc-700 border-t-emerald-500 animate-spin" />
        </div>
      ) : recommendation ? (
        <>
          {!recommendation.recommended ? (
            <div className="flex-1 flex flex-col gap-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 ring-1 ring-amber-200 dark:ring-amber-900/50">
                <span className="text-amber-500 text-sm">⚠</span>
                <span className="text-[11px] font-mono font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                  No Move Recommended
                </span>
              </div>
              <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {recommendation.no_move_reason}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 opacity-50">
                <StatItem
                  label="Best Available"
                  value={recommendation.operator_id}
                />
                <StatItem
                  label="Grade"
                  value={recommendation.proficiency_grade}
                />
                <StatItem
                  label="Gain"
                  value={`${recommendation.expected_production_gain.toFixed(1)} min`}
                />
                <StatItem
                  label="Cost"
                  value={`${recommendation.cost_of_move.toFixed(1)} min`}
                />
              </div>
            </div>
          ) : (
            <>
              {/* Summary header */}
              <div
                className={`flex-1 flex flex-col gap-3 transition-opacity duration-300 ${accepted ? "opacity-40" : "opacity-100"}`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 dark:text-zinc-500">
                  <span>
                    {recommendation.workers_found} of{" "}
                    {recommendation.workers_needed} workers needed
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {recommendation.gap_coverage_pct.toFixed(0)}% gap covered
                  </span>
                </div>

                {/* Gap coverage bar */}
                <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${recommendation.gap_coverage_pct}%` }}
                  />
                </div>

                {/* Worker list */}
                <div className="flex flex-col gap-2">
                  {recommendation.moves.map((move, i) => (
                    <WorkerRow key={move.operator_id} move={move} index={i} />
                  ))}
                </div>

                {/* Cascade warnings */}
                {recommendation.cascade_warnings.length > 0 && (
                  <div className="mt-1 p-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
                    <div className="text-[9px] font-mono font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">
                      Cascade Risk
                    </div>
                    {recommendation.cascade_warnings.map((w, i) => (
                      <p
                        key={i}
                        className="text-[10px] font-mono text-amber-700 dark:text-amber-400"
                      >
                        {w}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {/* Accept button */}
              <button
                onClick={onAccept}
                disabled={accepted || accepting}
                className={`w-full py-3 text-sm font-semibold tracking-wide transition-all duration-200 cursor-pointer disabled:cursor-not-allowed ${
                  accepted
                    ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-900"
                    : accepting
                      ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600"
                      : "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-100 shadow-sm hover:shadow-md"
                }`}
              >
                {accepted
                  ? "✓ Moves Accepted"
                  : accepting
                    ? "Processing…"
                    : `Accept ${recommendation.workers_found > 1 ? `${recommendation.workers_found} Moves` : "Move"}`}
              </button>
            </>
          )}
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center py-10 gap-3">
          <div className="w-10 h-10 border-2 border-dashed border-zinc-200 dark:border-zinc-800 flex items-center justify-center">
            <span className="text-zinc-300 dark:text-zinc-700 text-lg font-mono">
              —
            </span>
          </div>
          <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-600">
            Awaiting station data
          </span>
        </div>
      )}
    </div>
  );
}
