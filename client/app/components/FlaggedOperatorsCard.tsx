import type { FlaggedOperator } from "../types";

interface FlaggedOperatorsCardProps {
  operators: FlaggedOperator[];
  onClear: (operatorId: string) => void;
  clearingId: string | null;
}

export function FlaggedOperatorsCard({
  operators,
  onClear,
  clearingId,
}: FlaggedOperatorsCardProps) {
  return (
    <div className="bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800/60 p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono tracking-widest text-zinc-400 dark:text-zinc-500 uppercase">
          Flagged Operators
        </span>
        {operators.length > 0 && (
          <span className="text-[10px] font-mono px-2 py-0.5 bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 ring-1 ring-orange-200 dark:ring-orange-900/60">
            {operators.length}
          </span>
        )}
      </div>

      {operators.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <div className="w-8 h-8 border-2 border-emerald-200 dark:border-emerald-900 flex items-center justify-center">
            <span className="text-emerald-500 text-sm font-mono">✓</span>
          </div>
          <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-600 text-center">
            No one flagged right now
          </span>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {operators.map((op) => (
            <li
              key={op.operator_id}
              className="p-3 border border-orange-200 dark:border-orange-900/50 bg-orange-50 dark:bg-orange-950/20 text-[11px] font-mono"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {op.operator_id}
                </span>
                <span className="text-zinc-400 dark:text-zinc-600">
                  {op.current_station ?? "—"}
                </span>
              </div>
              <p className="text-zinc-500 dark:text-zinc-500 leading-relaxed mb-2">
                {op.flag_reason}
              </p>
              <button
                onClick={() => onClear(op.operator_id)}
                disabled={clearingId === op.operator_id}
                className="w-full py-1.5 text-[10px] tracking-widest uppercase bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                {clearingId === op.operator_id ? "Clearing…" : "Clear flag"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
