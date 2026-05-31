"use client";

export interface ChartPoint {
  label: string; // HH:MM
  efficiency: number; // avg actual/target across all active stations (0-100)
}

interface EfficiencyChartProps {
  data: ChartPoint[];
}

const W = 600;
const H = 160;
const PAD = { top: 16, right: 20, bottom: 28, left: 40 };

function vy(v: number, innerH: number) {
  return PAD.top + innerH - (v / 100) * innerH;
}

function buildPoints(
  data: ChartPoint[],
  innerW: number,
  innerH: number,
): string {
  if (data.length < 2) return "";
  return data
    .map((d, i) => {
      const x = PAD.left + (i / (data.length - 1)) * innerW;
      const y = vy(d.efficiency, innerH);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function EfficiencyChart({ data }: EfficiencyChartProps) {
  const isEmpty = data.length < 2;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const points = buildPoints(data, innerW, innerH);
  const latest = data.length > 0 ? data[data.length - 1].efficiency : null;

  const xLabels: { label: string; x: number }[] = [];
  if (data.length >= 2) {
    for (const i of [
      ...new Set([0, Math.floor((data.length - 1) / 2), data.length - 1]),
    ]) {
      xLabels.push({
        label: data[i].label,
        x: PAD.left + (i / (data.length - 1)) * innerW,
      });
    }
  } else if (data.length === 1) {
    xLabels.push({ label: data[0].label, x: PAD.left });
  }

  return (
    <div className="bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800/60 p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-zinc-400 dark:text-zinc-500 uppercase">
            Overall Progress
          </span>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-500 dark:text-emerald-400">
              <svg width="18" height="8" className="overflow-visible">
                <line
                  x1="0"
                  y1="4"
                  x2="18"
                  y2="4"
                  stroke="#10b981"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              Avg Station Efficiency
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400 dark:text-zinc-600">
              <svg width="18" height="8" className="overflow-visible">
                <line
                  x1="0"
                  y1="4"
                  x2="18"
                  y2="4"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeDasharray="3 2"
                />
              </svg>
              Target 100%
            </span>
          </div>
        </div>

        {latest !== null && (
          <div className="text-right">
            <div className="text-[9px] font-mono text-zinc-400 dark:text-zinc-600 uppercase tracking-wider mb-0.5">
              Now
            </div>
            <div
              className={`text-2xl font-bold font-mono tabular-nums tracking-tight leading-none ${
                latest >= 85
                  ? "text-emerald-600 dark:text-emerald-400"
                  : latest >= 60
                    ? "text-amber-500 dark:text-amber-400"
                    : "text-red-600 dark:text-red-400"
              }`}
            >
              {latest.toFixed(1)}
              <span className="text-sm font-normal text-zinc-400 ml-0.5">
                %
              </span>
            </div>
          </div>
        )}
      </div>

      {/* SVG */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: H }}
        aria-label="Overall factory efficiency"
      >
        <defs>
          <linearGradient id="effGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Grid + Y labels */}
        {[0, 25, 50, 75, 100].map((v) => {
          const y = vy(v, innerH);
          return (
            <g key={v}>
              <line
                x1={PAD.left}
                y1={y}
                x2={PAD.left + innerW}
                y2={y}
                stroke="currentColor"
                strokeWidth={0.5}
                strokeDasharray={v === 0 ? undefined : "3 3"}
                className="text-zinc-200 dark:text-zinc-800"
              />
              <text
                x={PAD.left - 5}
                y={y + 3.5}
                textAnchor="end"
                fontSize={8}
                className="fill-zinc-400 dark:fill-zinc-600 font-mono"
              >
                {v}
              </text>
            </g>
          );
        })}

        {/* Target line */}
        <line
          x1={PAD.left}
          y1={PAD.top}
          x2={PAD.left + innerW}
          y2={PAD.top}
          stroke="currentColor"
          strokeWidth={0.75}
          strokeDasharray="4 4"
          className="text-zinc-300 dark:text-zinc-700"
        />

        {isEmpty ? (
          <text
            x={PAD.left + innerW / 2}
            y={PAD.top + innerH / 2 + 4}
            textAnchor="middle"
            fontSize={9}
            className="fill-zinc-300 dark:fill-zinc-700 font-mono"
          >
            Snapshot loads on first working-hour check
          </text>
        ) : (
          <>
            {/* Area fill */}
            <polygon
              points={`${PAD.left},${PAD.top + innerH} ${points} ${PAD.left + innerW},${PAD.top + innerH}`}
              fill="url(#effGrad)"
            />
            {/* Line */}
            <polyline
              points={points}
              fill="none"
              stroke="#10b981"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {/* Latest dot */}
            {(() => {
              const last = data[data.length - 1];
              const lx = data.length > 1 ? PAD.left + innerW : PAD.left;
              const ly = vy(last.efficiency, innerH);
              return (
                <circle
                  cx={lx}
                  cy={ly}
                  r={3.5}
                  fill="#10b981"
                  stroke="#18181b"
                  strokeWidth={1.5}
                />
              );
            })()}
          </>
        )}

        {/* X timestamps */}
        {xLabels.map(({ label, x }, i) => (
          <text
            key={`${label}-${i}`}
            x={x}
            y={H - 5}
            textAnchor="middle"
            fontSize={7.5}
            className="fill-zinc-400 dark:fill-zinc-600 font-mono"
          >
            {label}
          </text>
        ))}
      </svg>
    </div>
  );
}
