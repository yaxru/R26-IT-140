"use client";

import { useState } from "react";
import type { Bottleneck } from "../types";

// ─── 1. Interactive Line Chart (Hourly Pace) ─────────────────────────────────

function InteractiveLineChart() {
  const shiftData = [
    { hour: "08:00", target: 150, lineA: 142, lineB: 120 },
    { hour: "09:00", target: 150, lineA: 155, lineB: 125 },
    { hour: "10:00", target: 150, lineA: 148, lineB: 110 },
    { hour: "11:00", target: 150, lineA: 132, lineB: 105 },
    { hour: "12:00", target: 100, lineA: 95, lineB: 80 }, // lunch dip
    { hour: "13:00", target: 150, lineA: 145, lineB: 135 },
    { hour: "14:00", target: 150, lineA: 152, lineB: 140 },
    { hour: "15:00", target: 150, lineA: 158, lineB: 145 },
  ];

  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const margin = { top: 20, right: 30, bottom: 40, left: 35 };
  const w = 600;
  const h = 180;
  const maxVal = 200;
  const outerW = w + margin.left + margin.right;
  const outerH = h + margin.top + margin.bottom;

  const getX = (i: number) => margin.left + (i / (shiftData.length - 1)) * w;
  const getY = (val: number) => margin.top + h - (val / maxVal) * h;

  const pathA = shiftData
    .map((d, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(d.lineA)}`)
    .join(" ");

  const pathB = shiftData
    .map((d, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(d.lineB)}`)
    .join(" ");

  const targetPath = shiftData
    .map((d, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(d.target)}`)
    .join(" ");

  const fillA = `${pathA} L ${getX(shiftData.length - 1)} ${margin.top + h} L ${margin.left} ${margin.top + h} Z`;

  return (
    <div className="w-full relative mt-4">
      <svg
        viewBox={`0 0 ${outerW} ${outerH}`}
        className="w-full h-auto overflow-visible group"
      >
        <defs>
          <linearGradient id="gradA" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1A7C4B" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#1A7C4B" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Y-Axis Grid Lines & Labels */}
        {[0, 50, 100, 150, 200].map((val) => (
          <g key={val}>
            <line
              x1={margin.left}
              y1={getY(val)}
              x2={margin.left + w}
              y2={getY(val)}
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="2 4"
              className="text-[#EAEAEA] dark:text-zinc-800"
            />
            <text
              x={margin.left - 10}
              y={getY(val) + 4}
              textAnchor="end"
              fontSize="11"
              className="fill-[#9A9A9A] dark:fill-zinc-500 font-mono"
            >
              {val}
            </text>
          </g>
        ))}

        {/* Target Line */}
        <path
          d={targetPath}
          fill="none"
          stroke="#9A9A9A"
          strokeWidth="2"
          strokeDasharray="4 4"
          className="opacity-40"
        />

        {/* Line A (Stn 01) */}
        <path
          d={fillA}
          fill="url(#gradA)"
          className="transition-opacity duration-300 group-hover:opacity-60"
        />
        <path
          d={pathA}
          fill="none"
          stroke="#1A7C4B"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        {/* Line B (Stn 02) */}
        <path
          d={pathB}
          fill="none"
          stroke="#CE8E33"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        {/* Hover Crosshair & Tooltip */}
        {hoverIndex !== null && (
          <g className="transition-opacity duration-150">
            {/* Vertical Guide Line */}
            <line
              x1={getX(hoverIndex)}
              y1={margin.top}
              x2={getX(hoverIndex)}
              y2={margin.top + h}
              stroke="#5F5F5F"
              strokeWidth="1"
              strokeDasharray="4 4"
            />

            {/* Hover Points */}
            <circle
              cx={getX(hoverIndex)}
              cy={getY(shiftData[hoverIndex].target)}
              r="4.5"
              fill="#9A9A9A"
            />
            <circle
              cx={getX(hoverIndex)}
              cy={getY(shiftData[hoverIndex].lineB)}
              r="4.5"
              fill="#CE8E33"
              stroke="#FFFFFF"
              strokeWidth="1.5"
              className="dark:stroke-[#111113]"
            />
            <circle
              cx={getX(hoverIndex)}
              cy={getY(shiftData[hoverIndex].lineA)}
              r="4.5"
              fill="#1A7C4B"
              stroke="#FFFFFF"
              strokeWidth="1.5"
              className="dark:stroke-[#111113]"
            />

            {/* Tooltip Box */}
            <g
              transform={`translate(${getX(hoverIndex) > margin.left + w - 120 ? getX(hoverIndex) - 125 : getX(hoverIndex) + 15}, ${getY(shiftData[hoverIndex].lineA) - 40})`}
            >
              <rect
                x="0"
                y="0"
                width="110"
                height="66"
                fill="#242424"
                className="dark:fill-[#FFFFFF]"
              />
              <text
                x="10"
                y="16"
                fontSize="10"
                fill="#9A9A9A"
                className="font-mono uppercase tracking-widest"
              >
                {shiftData[hoverIndex].hour}
              </text>
              <text
                x="10"
                y="32"
                fontSize="11"
                fill="#FFFFFF"
                className="dark:fill-[#111113] font-bold"
              >
                Stn 01: {shiftData[hoverIndex].lineA}
              </text>
              <text
                x="10"
                y="46"
                fontSize="11"
                fill="#FFFFFF"
                className="dark:fill-[#111113] font-bold"
              >
                Stn 02: {shiftData[hoverIndex].lineB}
              </text>
              <text
                x="10"
                y="58"
                fontSize="10"
                fill="#9A9A9A"
                className="font-mono"
              >
                Target: {shiftData[hoverIndex].target}
              </text>
            </g>
          </g>
        )}

        {/* X-Axis Labels (Static) */}
        {shiftData.map((d, i) => (
          <text
            key={i}
            x={getX(i)}
            y={margin.top + h + 22}
            textAnchor="middle"
            fontSize="11"
            className={`font-mono transition-colors duration-200 ${hoverIndex === i ? "fill-[#242424] dark:fill-zinc-100 font-bold" : "fill-[#9A9A9A] dark:fill-zinc-500"}`}
          >
            {d.hour}
          </text>
        ))}

        {/* Invisible Hover Zones for Interaction */}
        {shiftData.map((_, i) => {
          const zoneW = w / (shiftData.length - 1);
          const zoneX = getX(i) - zoneW / 2;
          return (
            <rect
              key={i}
              x={zoneX}
              y={margin.top}
              width={zoneW}
              height={h}
              fill="transparent"
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
              className="cursor-crosshair"
            />
          );
        })}
      </svg>
    </div>
  );
}

// ─── 2. Interactive Interactive Donut Chart (Health) ──────────────────────────

function InteractiveDonutChart({ stations }: { stations: Bottleneck[] }) {
  const [hoverSlice, setHoverSlice] = useState<
    "optimal" | "bottleneck" | "offline" | null
  >(null);

  const totalLines = stations.length || 1;
  const bottlenecksCount = stations.filter((s) => s.is_bottleneck).length;
  const offlineCount = stations.filter(
    (s) => s.actual_productivity === null || s.actual_productivity === 0,
  ).length;
  const optimalCount = totalLines - bottlenecksCount - offlineCount;

  const radius = 42;
  const circumference = 2 * Math.PI * radius;

  const optPct = optimalCount / totalLines;
  const botPct = bottlenecksCount / totalLines;
  const offPct = offlineCount / totalLines;

  // Calculate Dash Arrays (Length of stroke, followed by gap that hides the rest of the circle)
  const optDash = optPct * circumference;
  const botDash = botPct * circumference;
  const offDash = offPct * circumference;

  // Offsets to start each slice where the previous left off
  const botOffset = -optDash;
  const offOffset = -(optDash + botDash);

  const handleHover = (slice: "optimal" | "bottleneck" | "offline" | null) =>
    setHoverSlice(slice);

  // Center display data
  const centerValue =
    hoverSlice === "optimal"
      ? optimalCount
      : hoverSlice === "bottleneck"
        ? bottlenecksCount
        : hoverSlice === "offline"
          ? offlineCount
          : totalLines;

  const centerLabel =
    hoverSlice === "optimal"
      ? "Optimal"
      : hoverSlice === "bottleneck"
        ? "Bottleneck"
        : hoverSlice === "offline"
          ? "Offline"
          : "Total Stations";

  return (
    <div className="flex-1 flex flex-col items-center justify-center relative my-4">
      <svg viewBox="0 0 100 100" className="w-36 h-36 transform -rotate-90">
        {/* Offline Slice */}
        {offlineCount > 0 && (
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={
              hoverSlice === "offline" || !hoverSlice ? "#F1F1F1" : "#F8F8F8"
            }
            className="dark:stroke-zinc-800 transition-all duration-300"
            strokeWidth={hoverSlice === "offline" ? "14" : "10"}
            strokeDasharray={`${offDash} ${circumference}`}
            strokeDashoffset={offOffset}
            pointerEvents="stroke"
            onMouseEnter={() => handleHover("offline")}
            onMouseLeave={() => handleHover(null)}
          />
        )}

        {/* Bottleneck Slice */}
        {bottlenecksCount > 0 && (
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={
              hoverSlice === "bottleneck" || !hoverSlice ? "#CE8E33" : "#F4E5D1"
            }
            className="transition-all duration-300 dark:stroke-amber-900"
            strokeWidth={hoverSlice === "bottleneck" ? "14" : "10"}
            strokeDasharray={`${botDash} ${circumference}`}
            strokeDashoffset={botOffset}
            pointerEvents="stroke"
            onMouseEnter={() => handleHover("bottleneck")}
            onMouseLeave={() => handleHover(null)}
          />
        )}

        {/* Optimal Slice */}
        {optimalCount > 0 && (
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={
              hoverSlice === "optimal" || !hoverSlice ? "#1A7C4B" : "#E6F1EC"
            }
            className="transition-all duration-300 dark:stroke-[#0A321E]"
            strokeWidth={hoverSlice === "optimal" ? "14" : "10"}
            strokeDasharray={`${optDash} ${circumference}`}
            strokeDashoffset="0"
            pointerEvents="stroke"
            onMouseEnter={() => handleHover("optimal")}
            onMouseLeave={() => handleHover(null)}
          />
        )}
      </svg>

      {/* Dynamic Center Text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-3xl font-bold tabular-nums text-[#242424] dark:text-zinc-100 leading-none">
          {centerValue}
        </span>
        <span className="text-[9px] font-medium text-[#9A9A9A] dark:text-zinc-500 uppercase tracking-widest mt-1">
          {centerLabel}
        </span>
      </div>
    </div>
  );
}

// ─── 3. Interactive Bar Chart (WIP Load) ──────────────────────────────────────

function InteractiveBarChart({ stations }: { stations: Bottleneck[] }) {
  const wipStations = [...stations].slice(0, 15); // limit for clean display
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const w = 800;
  const h = 140;
  const maxWip = Math.max(...wipStations.map((s) => s.wip), 50);
  const threshold = 40;

  return (
    <div className="w-full relative mt-4">
      <svg
        viewBox={`0 -20 ${w} ${h + 40}`}
        className="w-full h-auto overflow-visible"
      >
        {/* Y-Axis Grid Lines */}
        {[0, Math.round(maxWip / 2), maxWip].map((val, idx) => {
          const y = h - (val / maxWip) * h;
          return (
            <g key={idx}>
              <line
                x1="0"
                y1={y}
                x2={w}
                y2={y}
                stroke="currentColor"
                strokeWidth="0.5"
                strokeDasharray="2 2"
                className="text-[#EAEAEA] dark:text-zinc-800"
              />
              <text
                x="-10"
                y={y + 3}
                textAnchor="end"
                fontSize="9"
                className="fill-[#9A9A9A] dark:fill-zinc-600 font-mono"
              >
                {val}
              </text>
            </g>
          );
        })}

        {/* Threshold Warning Line */}
        <line
          x1="0"
          y1={h - (threshold / maxWip) * h}
          x2={w}
          y2={h - (threshold / maxWip) * h}
          stroke="#CE8E33"
          strokeWidth="1"
          strokeDasharray="4 4"
          className="opacity-60"
        />
        <text
          x={w + 5}
          y={h - (threshold / maxWip) * h + 3}
          fontSize="9"
          className="fill-[#CE8E33] font-mono"
        >
          LIMIT
        </text>

        {/* Bars */}
        {wipStations.length === 0 ? (
          <text
            x={w / 2}
            y={h / 2}
            textAnchor="middle"
            fontSize="12"
            className="fill-[#9A9A9A]"
          >
            No station data available
          </text>
        ) : (
          wipStations.map((s, i) => {
            const barW = w / wipStations.length - 16;
            const x = i * (w / wipStations.length) + 8;
            const barH = (s.wip / maxWip) * h;
            const y = h - barH;

            // Determine Color based on Status and Hover State
            const isHovered = hoverIndex === i;
            const isDimmed = hoverIndex !== null && hoverIndex !== i;

            let fillClass = s.is_bottleneck
              ? "fill-[#CE8E33]"
              : "fill-[#1A7C4B]";
            if (isDimmed)
              fillClass = s.is_bottleneck
                ? "fill-[#F4E5D1] dark:fill-amber-900"
                : "fill-[#E6F1EC] dark:fill-[#0A321E]";

            return (
              <g key={s.station_id}>
                {/* Invisible Hover Zone covering full height to catch mouse earlier */}
                <rect
                  x={x - 4}
                  y={0}
                  width={barW + 8}
                  height={h}
                  fill="transparent"
                  onMouseEnter={() => setHoverIndex(i)}
                  onMouseLeave={() => setHoverIndex(null)}
                  className="cursor-pointer"
                />

                {/* Visible Bar */}
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={barH}
                  className={`${fillClass} transition-colors duration-200 pointer-events-none`}
                />

                {/* X-Axis Label */}
                <text
                  x={x + barW / 2}
                  y={h + 16}
                  textAnchor="middle"
                  fontSize="9"
                  className={`font-mono transition-colors duration-200 ${isHovered ? "fill-[#242424] dark:fill-zinc-100 font-bold" : "fill-[#9A9A9A] dark:fill-zinc-600"}`}
                >
                  {s.station_id}
                </text>

                {/* Tooltip on Hover */}
                {isHovered && (
                  <g
                    className="pointer-events-none"
                    transform={`translate(${x + barW / 2}, ${y - 8})`}
                  >
                    <rect
                      x="-35"
                      y="-30"
                      width="70"
                      height="24"
                      fill="#242424"
                      className="dark:fill-[#FFFFFF]"
                    />
                    <polygon
                      points="-5,-6 5,-6 0,0"
                      fill="#242424"
                      className="dark:fill-[#FFFFFF]"
                    />
                    <text
                      x="0"
                      y="-14"
                      textAnchor="middle"
                      fontSize="10"
                      fill="#FFFFFF"
                      className="dark:fill-[#111113] font-bold font-mono"
                    >
                      {s.wip} units
                    </text>
                  </g>
                )}
              </g>
            );
          })
        )}
      </svg>
    </div>
  );
}

// ─── Main Analytics Layout ────────────────────────────────────────────────────

interface OverviewAnalyticsProps {
  stations: Bottleneck[];
}

export function OverviewAnalytics({ stations }: OverviewAnalyticsProps) {
  const totalLines = stations.length || 1;
  const bottlenecksCount = stations.filter((s) => s.is_bottleneck).length;
  const offlineCount = stations.filter(
    (s) => s.actual_productivity === null || s.actual_productivity === 0,
  ).length;
  const optimalCount = totalLines - bottlenecksCount - offlineCount;

  return (
    <div className="flex flex-col lg:flex-row">
      {/* ── Left Column: Hourly Velocity Line Chart ── */}
      <div className="lg:w-2/3 border-b lg:border-b-0 lg:border-r border-[#EAEAEA] dark:border-zinc-800 p-5 lg:p-6 flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-[10px] font-medium tracking-widest text-[#9A9A9A] dark:text-zinc-500 uppercase">
              Production Velocity Trend
            </p>
            <h3 className="text-sm font-bold text-[#242424] dark:text-zinc-100 mt-0.5">
              Hourly Output vs Target (Current Shift)
            </h3>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-[#5F5F5F] dark:text-zinc-400 font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-[2px] bg-[#1A7C4B]" /> Stn 01
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-[2px] bg-[#CE8E33]" /> Stn 02
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-[2px] bg-[#9A9A9A] border-t border-dashed border-[#9A9A9A] bg-transparent" />{" "}
              Target
            </span>
          </div>
        </div>

        <InteractiveLineChart />
      </div>

      {/* ── Right Column: Health Donut & WIP Bar Chart ── */}
      <div className="lg:w-1/3 flex flex-col">
        {/* Health Donut Chart */}
        <div className="border-b border-[#EAEAEA] dark:border-zinc-800 p-5 lg:p-6 flex flex-col">
          <div>
            <p className="text-[10px] font-medium tracking-widest text-[#9A9A9A] dark:text-zinc-500 uppercase">
              Line Health Distribution
            </p>
            <h3 className="text-sm font-bold text-[#242424] dark:text-zinc-100 mt-0.5">
              Current Station Status
            </h3>
          </div>

          <InteractiveDonutChart stations={stations} />

          {/* Legend */}
          <div className="space-y-2 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[#5F5F5F] dark:text-zinc-400">
                <span className="w-2 h-2 bg-[#1A7C4B]" /> Optimal
              </span>
              <span className="font-semibold text-[#242424] dark:text-zinc-100 tabular-nums">
                {optimalCount}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[#5F5F5F] dark:text-zinc-400">
                <span className="w-2 h-2 bg-[#CE8E33]" /> Bottleneck
              </span>
              <span className="font-semibold text-[#242424] dark:text-zinc-100 tabular-nums">
                {bottlenecksCount}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[#5F5F5F] dark:text-zinc-400">
                <span className="w-2 h-2 bg-[#F1F1F1] dark:bg-zinc-800" />{" "}
                Offline/Maintenance
              </span>
              <span className="font-semibold text-[#242424] dark:text-zinc-100 tabular-nums">
                {offlineCount}
              </span>
            </div>
          </div>
        </div>

        {/* WIP Bar Chart */}
        <div className="p-5 lg:p-6 flex flex-col">
          <div className="mb-2">
            <p className="text-[10px] font-medium tracking-widest text-[#9A9A9A] dark:text-zinc-500 uppercase">
              Work-In-Progress Queue
            </p>
            <h3 className="text-sm font-bold text-[#242424] dark:text-zinc-100 mt-0.5">
              WIP Load by Station
            </h3>
          </div>
          <InteractiveBarChart stations={stations} />
        </div>
      </div>
    </div>
  );
}
