"use client";

export default function EfficiencyGauge({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(150, value));
  const pct = Math.min(1, clamped / 150); // scale gauge to 150% max
  const size = 180;
  const strokeWidth = 14;
  const r = (size - strokeWidth) / 2;
  const c = Math.PI * r; // half circle
  const offset = c * (1 - pct);

  const color = clamped >= 85 ? "#3f9d63" : clamped >= 60 ? "#f2a93b" : "#d94f3d";
  const zoneLabel = clamped >= 85 ? "HIGH" : clamped >= 60 ? "MEDIUM" : "LOW";

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size / 2 + 20 }}>
        <svg width={size} height={size / 2 + 10} viewBox={`0 0 ${size} ${size / 2 + 10}`}>
          <path
            d={`M ${strokeWidth / 2} ${size / 2} A ${r} ${r} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
            fill="none"
            stroke="var(--ink-line)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <path
            d={`M ${strokeWidth / 2} ${size / 2} A ${r} ${r} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
          <span className="led-digits text-4xl text-white">{clamped.toFixed(1)}%</span>
          <span className="eyebrow" style={{ color }}>{zoneLabel}</span>
        </div>
      </div>
    </div>
  );
}
