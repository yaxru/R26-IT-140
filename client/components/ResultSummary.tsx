import type { JobCardSubmitResponse } from "@/app/(dashboard)/types";

function StatItem({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-zinc-50 dark:bg-zinc-900/60 p-3 border border-zinc-100 dark:border-zinc-800/40">
      <div className="text-[9px] font-mono text-zinc-400 dark:text-zinc-600 uppercase tracking-wider mb-1">
        {label}
      </div>
      <div
        className={`text-sm font-mono font-semibold truncate ${accent ?? "text-zinc-800 dark:text-zinc-200"}`}
      >
        {value}
      </div>
    </div>
  );
}

function statusBadgeClasses(status: string) {
  if (status === "HIGH")
    return "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-200 dark:ring-emerald-900/60";
  if (status === "MEDIUM")
    return "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 ring-1 ring-amber-200 dark:ring-amber-900/60";
  return "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 ring-1 ring-orange-200 dark:ring-orange-900/60";
}

function riskBadgeClasses(level: string) {
  if (level === "LOW")
    return "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-200 dark:ring-emerald-900/60";
  if (level === "MEDIUM")
    return "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 ring-1 ring-amber-200 dark:ring-amber-900/60";
  return "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 ring-1 ring-orange-200 dark:ring-orange-900/60";
}

export function ResultSummary({ result }: { result: JobCardSubmitResponse }) {
  const { entry, prediction, risk, flagged_now } = result;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono tracking-widest text-zinc-400 dark:text-zinc-500 uppercase">
          Submission logged
        </span>
        <span
          className={`inline-flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 uppercase ${statusBadgeClasses(entry.status)}`}
        >
          {entry.efficiency.toFixed(1)}% · {entry.status}
        </span>
      </div>

      {flagged_now && (
        <div className="flex items-start gap-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50 px-4 py-3 text-[11px] font-mono text-orange-600 dark:text-orange-400">
          <span className="shrink-0 mt-px">⚑</span>
          <span>
            This operator has been flagged for review — under {" "}
            {result.submission_count <= 3 ? "50%" : ""} efficiency in their
            early submissions. Not a penalty — a support signal.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <StatItem label="Predicted output" value={`${prediction.predicted_output.toFixed(0)} pcs`} />
        <StatItem label="Model class" value={prediction.efficiency_class} />
        <StatItem
          label="Batch completion"
          value={
            prediction.batch_completion_time != null
              ? `${prediction.batch_completion_time.toFixed(0)} min`
              : "—"
          }
        />
        <StatItem
          label="Risk"
          value={`${risk.risk_level} · ${risk.risk_score.toFixed(1)}%`}
          accent={
            riskBadgeClasses(risk.risk_level).split(" ")[0] // reuse the text-color class only
          }
        />
      </div>

      {risk.is_outlier && (
        <p className="text-[10px] font-mono text-amber-600 dark:text-amber-400">
          ⚠ Flagged as a statistical outlier — actual output is far from the
          predicted range.
        </p>
      )}

      {entry.downtime_reason && (
        <p className="text-[10px] font-mono text-zinc-400 dark:text-zinc-600">
          Downtime reason: {entry.downtime_reason}
        </p>
      )}
    </div>
  );
}
