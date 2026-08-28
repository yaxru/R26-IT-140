"use client";

const TONES = {
  amber: { ring: "#f2a93b", track: "rgba(242,169,59,0.15)" },
  red: { ring: "#d94f3d", track: "rgba(217,79,61,0.15)" },
  blue: { ring: "#3b6ea5", track: "rgba(59,110,165,0.15)" },
  green: { ring: "#3f9d63", track: "rgba(63,157,99,0.15)" },
} as const;

export default function CountdownRing({
  secondsLeft,
  totalSeconds,
  label,
  tone = "amber",
  size = 132,
}: {
  secondsLeft: number;
  totalSeconds: number;
  label: string;
  tone?: keyof typeof TONES;
  size?: number;
}) {
  const strokeWidth = 8;
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, secondsLeft / totalSeconds));
  const offset = c * (1 - pct);
  const colors = TONES[tone];

  return (
    <div className="flex flex-col items-center gap-2" role="timer" aria-live="polite">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} stroke={colors.track} strokeWidth={strokeWidth} fill="none" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={colors.ring}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1s linear" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="led-digits text-3xl text-white">{secondsLeft}s</span>
        </div>
      </div>
      <span className="eyebrow text-[var(--ink-muted)]">{label}</span>
    </div>
  );
}
