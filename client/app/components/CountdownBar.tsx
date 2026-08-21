interface CountdownBarProps {
  secondsLeft: number;
  totalSeconds: number;
  label: string;
  accent?: "emerald" | "amber";
}

export function CountdownBar({
  secondsLeft,
  totalSeconds,
  label,
  accent = "emerald",
}: CountdownBarProps) {
  const pct = Math.max(0, Math.min(100, (secondsLeft / totalSeconds) * 100));
  const barColor = accent === "amber" ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="flex flex-col items-center gap-3 py-6" role="timer" aria-live="polite">
      <span className="text-3xl font-mono font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
        {secondsLeft}s
      </span>
      <div className="w-full max-w-xs h-1.5 bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-1000 ease-linear`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-mono tracking-widest uppercase text-zinc-400 dark:text-zinc-600">
        {label}
      </span>
    </div>
  );
}
