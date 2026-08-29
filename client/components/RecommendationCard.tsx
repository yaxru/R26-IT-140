import type { RecommendResponse, SingleMove } from "@/app/(dashboard)/types";
import { RankedBarList } from "./RankedBarList";

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

// Matches exact card height — zero layout shift
function Skeleton() {
  return (
    <div className="bg-white dark:bg-[#111113] border border-[#EAEAEA] dark:border-zinc-800/60 rounded-xl p-6 flex flex-col h-full min-h-[220px]">
      <div className="flex items-center justify-between mb-5">
        <div className="h-3 w-36 bg-[#F1F1F1] dark:bg-zinc-800 rounded animate-pulse" />
        <div className="h-3 w-16 bg-[#F1F1F1] dark:bg-zinc-800 rounded animate-pulse" />
      </div>
      <div className="flex-1 flex flex-col gap-3">
        <div className="h-3 w-full bg-[#F1F1F1] dark:bg-zinc-800 rounded animate-pulse" />
        <div className="h-1.5 w-full bg-[#F1F1F1] dark:bg-zinc-800 rounded-full animate-pulse" />
        <div className="flex flex-col gap-2 mt-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-14 bg-[#F8F8F8] dark:bg-zinc-900 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
      <div className="h-11 w-full bg-[#F1F1F1] dark:bg-zinc-800 rounded-lg animate-pulse mt-4" />
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#F8F8F8] dark:bg-zinc-900/60 border border-[#F1F1F1] dark:border-zinc-800/40 rounded-lg p-3">
      <p className="text-[10px] font-medium text-[#9A9A9A] dark:text-zinc-600 uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-sm font-semibold text-[#333333] dark:text-zinc-200 truncate tabular-nums">
        {value}
      </p>
    </div>
  );
}

function WorkerRow({ move, index }: { move: SingleMove; index: number }) {
  const isCascade = move.donor_cascade_risk;
  return (
    <div
      className={`rounded-lg p-3.5 border text-[11px] ${
        isCascade
          ? "border-[#EACFA9] dark:border-amber-800/40 bg-[#FDFBF8] dark:bg-amber-950/10"
          : "border-[#F1F1F1] dark:border-zinc-800/40 bg-[#F8F8F8] dark:bg-zinc-900/40"
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-semibold text-[#333333] dark:text-zinc-200">
          {index + 1}. {move.operator_id}
        </span>
        <span className="text-[10px] px-2 py-0.5 bg-[#EAEAEA] dark:bg-zinc-800 text-[#5F5F5F] dark:text-zinc-400 rounded-md font-medium">
          Grade {move.proficiency_grade}
        </span>
      </div>
      <div className="flex gap-3 text-[#9A9A9A] dark:text-zinc-500 font-mono">
        <span>{move.from_station ?? "—"} → {move.to_station}</span>
        <span className="ml-auto text-brand-600 dark:text-brand-400 font-semibold">
          +{move.net_profit.toFixed(1)} min
        </span>
      </div>
      {isCascade && (
        <p className="mt-2 flex items-center gap-1.5 text-[#A77329] dark:text-[#E1BA82] text-[10px]">
          <span aria-hidden="true">⚠</span>
          <span>{move.donor_risk_detail}</span>
        </p>
      )}
      {isCascade && move.donor_replacement_id && (
        <p className="mt-1 flex items-center gap-1.5 text-[#47966F] dark:text-brand-400 text-[10px]">
          <span aria-hidden="true">↩</span>
          <span>
            Backfill {move.from_station}: {move.donor_replacement_id} (Grade{" "}
            {move.donor_replacement_grade})
          </span>
        </p>
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
  // Shared header used in all states — keeps card height stable
  const Header = () => (
    <div className="flex items-center justify-between mb-5">
      <span className="text-[11px] font-medium tracking-widest text-[#9A9A9A] dark:text-zinc-500 uppercase">
        Move Recommendation
      </span>
      <div className="flex items-center gap-2">
        {loading ? (
          <span aria-live="polite" className="text-[10px] font-medium text-[#9A9A9A] dark:text-zinc-600 animate-pulse">
            Updating…
          </span>
        ) : lastUpdated ? (
          <time
            dateTime={lastUpdated.toISOString()}
            className="text-[10px] text-[#9A9A9A] dark:text-zinc-600 tabular-nums"
          >
            {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </time>
        ) : null}
        <button
          onClick={onRefresh}
          disabled={loading}
          aria-label="Refresh recommendation"
          title="Refresh recommendation"
          className="w-6 h-6 flex items-center justify-center text-[#9A9A9A] dark:text-zinc-600 hover:text-[#242424] dark:hover:text-zinc-200 disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-not-allowed rounded-md hover:bg-[#F1F1F1] dark:hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-brand-600"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M8 16H3v5" />
          </svg>
        </button>
      </div>
    </div>
  );

  // Healthy station — no move needed
  if (!isBottleneck) {
    return (
      <article className="bg-white dark:bg-[#111113] border border-[#EAEAEA] dark:border-zinc-800/60 rounded-xl p-6 flex flex-col h-full min-h-[220px]">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-6">
          <div
            aria-hidden="true"
            className="w-10 h-10 rounded-full border-2 border-brand-200 dark:border-brand-800 flex items-center justify-center bg-brand-50 dark:bg-brand-900/20"
          >
            <span className="text-brand-600 dark:text-brand-400 text-base">✓</span>
          </div>
          <p className="text-sm font-semibold text-[#333333] dark:text-zinc-200">Station is on target</p>
          <p className="text-xs text-[#9A9A9A] dark:text-zinc-600">No operator move needed</p>
        </div>
      </article>
    );
  }

  // Loading first fetch
  if (loading && !recommendation) return <Skeleton />;

  return (
    <article className="bg-white dark:bg-[#111113] border border-[#EAEAEA] dark:border-zinc-800/60 rounded-xl p-6 flex flex-col h-full min-h-[220px]">
      <Header />

      {recommendation ? (
        <>
          {!recommendation.recommended ? (
            /* ── No move recommended ── */
            <div className="flex-1 flex flex-col gap-4">
              <div
                role="alert"
                className="flex items-center gap-2.5 px-3.5 py-2.5 bg-[#FDFBF8] dark:bg-amber-950/20 border border-[#EACFA9] dark:border-amber-800/40 rounded-lg"
              >
                <span className="text-[#CE8E33] text-sm" aria-hidden="true">⚠</span>
                <span className="text-xs font-semibold text-[#A77329] dark:text-[#E1BA82] uppercase tracking-wider">
                  No Move Recommended
                </span>
              </div>
              <p className="text-xs text-[#5F5F5F] dark:text-zinc-400 leading-relaxed">
                {recommendation.no_move_reason}
              </p>
              <div className="mt-auto grid grid-cols-2 gap-2 opacity-60">
                <StatTile label="Best Available" value={recommendation.operator_id} />
                <StatTile label="Grade" value={recommendation.proficiency_grade} />
                <StatTile label="Gain" value={`${recommendation.expected_production_gain.toFixed(1)} min`} />
                <StatTile label="Cost" value={`${recommendation.cost_of_move.toFixed(1)} min`} />
              </div>
            </div>
          ) : (
            /* ── Move(s) recommended ── */
            <div
              className={`flex-1 flex flex-col gap-4 transition-opacity duration-300 ${accepted ? "opacity-40" : "opacity-100"}`}
            >
              {/* Coverage summary */}
              <div>
                <div className="flex items-center justify-between text-[11px] font-medium text-[#9A9A9A] dark:text-zinc-500 mb-2">
                  <span>
                    {recommendation.workers_found} of {recommendation.workers_needed} workers needed
                  </span>
                  <span className="text-brand-600 dark:text-brand-400 font-semibold tabular-nums">
                    {recommendation.gap_coverage_pct.toFixed(0)}% covered
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={Math.round(recommendation.gap_coverage_pct)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Gap coverage"
                  className="w-full h-1.5 bg-[#EAEAEA] dark:bg-zinc-900 rounded-full overflow-hidden"
                >
                  <div
                    className="h-full bg-brand-600 rounded-full transition-[width] duration-500"
                    style={{ width: `${recommendation.gap_coverage_pct}%` }}
                  />
                </div>
              </div>

              {/* Ranked bar chart when multiple workers */}
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

              {/* Worker list */}
              <div className="flex flex-col gap-2">
                {recommendation.moves.map((move, i) => (
                  <WorkerRow key={move.operator_id} move={move} index={i} />
                ))}
              </div>

              {/* Cascade warnings */}
              {recommendation.cascade_warnings.length > 0 && (
                <div
                  role="alert"
                  className="p-3 bg-[#FDFBF8] dark:bg-amber-950/10 border border-[#EACFA9] dark:border-amber-800/40 rounded-lg"
                >
                  <p className="text-[10px] font-semibold text-[#A77329] dark:text-[#E1BA82] uppercase tracking-wider mb-1.5">
                    Cascade Risk
                  </p>
                  {recommendation.cascade_warnings.map((w, i) => (
                    <p key={i} className="text-[10px] text-[#A77329] dark:text-[#E1BA82] leading-relaxed">
                      {w}
                    </p>
                  ))}
                </div>
              )}

              {/* Accept button */}
              <button
                onClick={onAccept}
                disabled={accepted || accepting}
                aria-label={
                  accepted
                    ? "Moves have been accepted"
                    : accepting
                      ? "Processing move"
                      : `Accept ${recommendation.workers_found > 1 ? `${recommendation.workers_found} moves` : "move"}`
                }
                className={`
                  mt-auto w-full py-3 px-4 rounded-lg text-sm font-semibold tracking-wide
                  transition-all duration-200 cursor-pointer disabled:cursor-not-allowed
                  focus-visible:outline-2 focus-visible:outline-brand-600 focus-visible:outline-offset-2
                  ${accepted
                    ? "bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 border border-brand-200 dark:border-brand-800/40"
                    : accepting
                      ? "bg-[#F1F1F1] dark:bg-zinc-800 text-[#9A9A9A] dark:text-zinc-600"
                      : "bg-[#1A7C4B] hover:bg-[#15633C] text-white shadow-sm hover:shadow-md"
                  }
                `}
              >
                {accepted
                  ? "✓ Moves Accepted"
                  : accepting
                    ? "Processing…"
                    : `Accept ${recommendation.workers_found > 1 ? `${recommendation.workers_found} Moves` : "Move"}`}
              </button>
            </div>
          )}
        </>
      ) : (
        /* Awaiting data state */
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-6">
          <div
            aria-hidden="true"
            className="w-10 h-10 rounded-full border-2 border-dashed border-[#EAEAEA] dark:border-zinc-800 flex items-center justify-center"
          >
            <span className="text-[#C6C6C6] dark:text-zinc-700 text-lg">—</span>
          </div>
          <p className="text-xs text-[#9A9A9A] dark:text-zinc-600">Awaiting station data</p>
        </div>
      )}
    </article>
  );
}
