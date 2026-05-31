"use client";

import { useState } from "react";

// ─── Data ────────────────────────────────────────────────────────────────────

type StationStatus = "running" | "bottleneck" | "idle" | "blocked" | "complete";

interface Station {
  id: string;
  worker: string;
  role: string;
  status: StationStatus;
  efficiency: number;
  wip: number;
}

interface Line {
  id: string;
  label: string;
  style: string;
  color: string;
  stations: Station[];
}

interface Notification {
  id: number;
  time: string;
  type: "alert" | "info" | "success" | "warning";
  title: string;
  detail: string;
}

const LINES: Line[] = [
  {
    id: "LINE-A",
    label: "Line A",
    style: "Polo Shirt – Ref #4421",
    color: "#3b82f6",
    stations: [
      {
        id: "A-01",
        worker: "Amara S.",
        role: "Cutting",
        status: "running",
        efficiency: 91,
        wip: 12,
      },
      {
        id: "A-02",
        worker: "Priya K.",
        role: "Fusing",
        status: "running",
        efficiency: 85,
        wip: 9,
      },
      {
        id: "A-03",
        worker: "Li Wei",
        role: "Stitching",
        status: "bottleneck",
        efficiency: 47,
        wip: 34,
      },
      {
        id: "A-04",
        worker: "Fatou D.",
        role: "Assembly",
        status: "running",
        efficiency: 78,
        wip: 7,
      },
      {
        id: "A-05",
        worker: "Rania M.",
        role: "Pressing",
        status: "idle",
        efficiency: 0,
        wip: 0,
      },
      {
        id: "A-06",
        worker: "Yuki T.",
        role: "QC Check",
        status: "running",
        efficiency: 88,
        wip: 5,
      },
      {
        id: "A-07",
        worker: "Selin A.",
        role: "Packing",
        status: "running",
        efficiency: 92,
        wip: 4,
      },
      {
        id: "A-08",
        worker: "Nina O.",
        role: "Labelling",
        status: "complete",
        efficiency: 100,
        wip: 0,
      },
    ],
  },
  {
    id: "LINE-B",
    label: "Line B",
    style: "Denim Jacket – Ref #3310",
    color: "#f59e0b",
    stations: [
      {
        id: "B-01",
        worker: "Carlos R.",
        role: "Cutting",
        status: "running",
        efficiency: 72,
        wip: 18,
      },
      {
        id: "B-02",
        worker: "Ana P.",
        role: "Fusing",
        status: "blocked",
        efficiency: 0,
        wip: 42,
      },
      {
        id: "B-03",
        worker: "Meera V.",
        role: "Stitching",
        status: "bottleneck",
        efficiency: 38,
        wip: 51,
      },
      {
        id: "B-04",
        worker: "Tom H.",
        role: "Assembly",
        status: "idle",
        efficiency: 0,
        wip: 0,
      },
      {
        id: "B-05",
        worker: "Sara L.",
        role: "Pressing",
        status: "running",
        efficiency: 65,
        wip: 11,
      },
      {
        id: "B-06",
        worker: "Jin Y.",
        role: "QC Check",
        status: "running",
        efficiency: 80,
        wip: 6,
      },
    ],
  },
  {
    id: "LINE-C",
    label: "Line C",
    style: "T-Shirt – Ref #5502",
    color: "#10b981",
    stations: [
      {
        id: "C-01",
        worker: "Aiko N.",
        role: "Cutting",
        status: "running",
        efficiency: 95,
        wip: 8,
      },
      {
        id: "C-02",
        worker: "Bola T.",
        role: "Fusing",
        status: "running",
        efficiency: 90,
        wip: 7,
      },
      {
        id: "C-03",
        worker: "Cleo M.",
        role: "Stitching",
        status: "running",
        efficiency: 88,
        wip: 9,
      },
      {
        id: "C-04",
        worker: "Dana F.",
        role: "Assembly",
        status: "running",
        efficiency: 85,
        wip: 6,
      },
      {
        id: "C-05",
        worker: "Elan R.",
        role: "Pressing",
        status: "running",
        efficiency: 93,
        wip: 5,
      },
      {
        id: "C-06",
        worker: "Femi A.",
        role: "QC Check",
        status: "running",
        efficiency: 91,
        wip: 4,
      },
      {
        id: "C-07",
        worker: "Gita S.",
        role: "Packing",
        status: "complete",
        efficiency: 100,
        wip: 0,
      },
      {
        id: "C-08",
        worker: "Hana K.",
        role: "Labelling",
        status: "complete",
        efficiency: 100,
        wip: 0,
      },
      {
        id: "C-09",
        worker: "Ivan L.",
        role: "Dispatch",
        status: "running",
        efficiency: 87,
        wip: 3,
      },
    ],
  },
  {
    id: "LINE-D",
    label: "Line D",
    style: "Hoodie – Ref #2210",
    color: "#8b5cf6",
    stations: [
      {
        id: "D-01",
        worker: "Jade W.",
        role: "Cutting",
        status: "complete",
        efficiency: 100,
        wip: 0,
      },
      {
        id: "D-02",
        worker: "Kosi E.",
        role: "Fusing",
        status: "complete",
        efficiency: 100,
        wip: 0,
      },
      {
        id: "D-03",
        worker: "Lena B.",
        role: "Stitching",
        status: "complete",
        efficiency: 100,
        wip: 0,
      },
      {
        id: "D-04",
        worker: "Mona Z.",
        role: "Assembly",
        status: "complete",
        efficiency: 100,
        wip: 0,
      },
      {
        id: "D-05",
        worker: "Noel C.",
        role: "Pressing",
        status: "complete",
        efficiency: 100,
        wip: 0,
      },
      {
        id: "D-06",
        worker: "Ora V.",
        role: "QC Check",
        status: "complete",
        efficiency: 100,
        wip: 0,
      },
    ],
  },
];

const NOTIFICATIONS: Notification[] = [
  {
    id: 1,
    time: "09:42",
    type: "alert",
    title: "Bottleneck Detected",
    detail: "A-03 (Li Wei) – WIP 34, efficiency 47%",
  },
  {
    id: 2,
    time: "09:38",
    type: "warning",
    title: "Line B Blocked",
    detail: "B-02 (Ana P.) waiting on material feed",
  },
  {
    id: 3,
    time: "09:31",
    type: "info",
    title: "Worker Reassigned",
    detail: "Rania M. moved from A-05 → B-04 support",
  },
  {
    id: 4,
    time: "09:20",
    type: "alert",
    title: "Bottleneck Detected",
    detail: "B-03 (Meera V.) – WIP 51, efficiency 38%",
  },
  {
    id: 5,
    time: "09:15",
    type: "success",
    title: "Line D Completed",
    detail: "All 6 stations finished target output",
  },
  {
    id: 6,
    time: "09:02",
    type: "info",
    title: "Maintenance Cleared",
    detail: "B-05 pressing station back online",
  },
  {
    id: 7,
    time: "08:55",
    type: "success",
    title: "Line C On Track",
    detail: "9 stations running above 85% efficiency",
  },
  {
    id: 8,
    time: "08:40",
    type: "warning",
    title: "QC Hold",
    detail: "3 units flagged at A-06 for re-inspection",
  },
  {
    id: 9,
    time: "08:22",
    type: "info",
    title: "Shift Started",
    detail: "All lines initialized – morning shift",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  StationStatus,
  { top: string; side: string; front: string; badge: string; label: string }
> = {
  running: {
    top: "#22c55e",
    side: "#15803d",
    front: "#16a34a",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    label: "Running",
  },
  bottleneck: {
    top: "#ef4444",
    side: "#991b1b",
    front: "#dc2626",
    badge: "bg-red-50 text-red-700 border-red-200",
    label: "Bottleneck",
  },
  idle: {
    top: "#a1a1aa",
    side: "#71717a",
    front: "#8d8d96",
    badge: "bg-zinc-100 text-zinc-600 border-zinc-300",
    label: "Idle",
  },
  blocked: {
    top: "#f97316",
    side: "#9a3412",
    front: "#ea580c",
    badge: "bg-orange-50 text-orange-700 border-orange-200",
    label: "Blocked",
  },
  complete: {
    top: "#3b82f6",
    side: "#1d4ed8",
    front: "#2563eb",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    label: "Complete",
  },
};

const NOTIF_CONFIG: Record<
  Notification["type"],
  { border: string; dot: string; icon: string }
> = {
  alert: { border: "border-red-300", dot: "bg-red-500", icon: "⚠" },
  warning: { border: "border-orange-300", dot: "bg-orange-400", icon: "!" },
  info: { border: "border-blue-300", dot: "bg-blue-400", icon: "i" },
  success: {
    border: "border-emerald-300",
    dot: "bg-emerald-500",
    icon: "✓",
  },
};

// ─── Isometric Station Block ──────────────────────────────────────────────────

function IsoBlock({
  station,
  lineColor,
  selected,
  onClick,
}: {
  station: Station;
  lineColor: string;
  selected: boolean;
  onClick: () => void;
}) {
  const cfg = STATUS_CONFIG[station.status];
  const W = 72;
  const H = 36;
  const D = 20;

  const topFace = `${W / 2},0 ${W},${H / 2} ${W / 2},${H} 0,${H / 2}`;
  const leftFace = `0,${H / 2} ${W / 2},${H} ${W / 2},${H + D} 0,${H / 2 + D}`;
  const rightFace = `${W / 2},${H} ${W},${H / 2} ${W},${H / 2 + D} ${W / 2},${H + D}`;

  const isProblem =
    station.status === "bottleneck" || station.status === "blocked";

  return (
    <div
      className="flex flex-col items-center gap-1.5 cursor-pointer"
      onClick={onClick}
    >
      <div
        className={`relative transition-transform duration-200 ${selected ? "scale-110" : "hover:scale-105"}`}
      >
        {selected && (
          <div
            className="absolute rounded-full blur-2xl opacity-50 pointer-events-none"
            style={{
              backgroundColor: lineColor,
              width: W,
              height: H,
              top: H / 3,
              left: 0,
            }}
          />
        )}
        {isProblem && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div
              className="absolute rounded-full animate-ping opacity-25"
              style={{
                backgroundColor:
                  station.status === "bottleneck" ? "#ef4444" : "#f97316",
                width: W * 1.1,
                height: H,
                top: H * 0.4,
                left: -W * 0.05,
              }}
            />
          </div>
        )}
        <svg
          width={W}
          height={H + D + 2}
          style={{ overflow: "visible", display: "block" }}
        >
          <polygon
            points={topFace}
            fill={cfg.top}
            opacity={selected ? 1 : 0.9}
          />
          <polygon points={leftFace} fill={cfg.side} />
          <polygon points={rightFace} fill={cfg.front} />
          <text
            x={W / 2}
            y={H / 2 + 5}
            textAnchor="middle"
            fontSize="12"
            fontWeight="800"
            fill="white"
            opacity="0.95"
          >
            {station.worker.charAt(0)}
          </text>
          {selected && (
            <polygon
              points={topFace}
              fill="none"
              stroke="white"
              strokeWidth="2"
              opacity="0.8"
            />
          )}
        </svg>
      </div>

      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[9px] font-mono font-bold text-zinc-700">
          {station.id}
        </span>
        <span className="text-[8px] font-mono text-zinc-500 max-w-19 text-center leading-tight truncate">
          {station.worker}
        </span>
      </div>
    </div>
  );
}

// ─── Station Detail Card ──────────────────────────────────────────────────────

function StationDetail({
  station,
  lineColor,
  onClose,
}: {
  station: Station;
  lineColor: string;
  onClose: () => void;
}) {
  const cfg = STATUS_CONFIG[station.status];
  return (
    <div className="absolute bottom-4 left-4 z-20 w-60 bg-white border border-zinc-200 shadow-xl">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200">
        <span className="text-[10px] font-mono font-bold text-zinc-700">
          {station.id}
        </span>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-700 text-xs leading-none"
        >
          ✕
        </button>
      </div>
      <div className="p-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-zinc-900">
            {station.worker}
          </span>
          <span
            className={`text-[9px] font-mono px-2 py-0.5 border rounded uppercase ${cfg.badge}`}
          >
            {cfg.label}
          </span>
        </div>
        <p className="text-[10px] font-mono text-zinc-500 -mt-1">
          {station.role}
        </p>

        <div>
          <div className="flex justify-between mb-1">
            <span className="text-[9px] font-mono text-zinc-500 uppercase">
              Efficiency
            </span>
            <span className="text-[9px] font-mono text-zinc-700">
              {station.efficiency}%
            </span>
          </div>
          <div className="h-1.5 bg-zinc-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${station.efficiency}%`,
                backgroundColor:
                  station.efficiency > 75
                    ? "#22c55e"
                    : station.efficiency > 40
                      ? "#f59e0b"
                      : "#ef4444",
              }}
            />
          </div>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-[9px] font-mono text-zinc-500 uppercase">
            WIP Queue
          </span>
          <span
            className={`text-[11px] font-mono font-bold ${station.wip > 20 ? "text-red-600" : "text-zinc-700"}`}
          >
            {station.wip} units
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsBar({ line }: { line: Line }) {
  const counts = {
    running: line.stations.filter((s) => s.status === "running").length,
    bottleneck: line.stations.filter((s) => s.status === "bottleneck").length,
    blocked: line.stations.filter((s) => s.status === "blocked").length,
    idle: line.stations.filter((s) => s.status === "idle").length,
    complete: line.stations.filter((s) => s.status === "complete").length,
  };
  const avgEff = Math.round(
    line.stations.reduce((a, s) => a + s.efficiency, 0) / line.stations.length,
  );

  return (
    <div className="flex flex-wrap gap-4">
      {[
        { label: "Total", value: line.stations.length, color: "text-zinc-700" },
        { label: "Running", value: counts.running, color: "text-emerald-600" },
        {
          label: "Bottleneck",
          value: counts.bottleneck,
          color: "text-red-600",
        },
        { label: "Blocked", value: counts.blocked, color: "text-orange-600" },
        { label: "Idle", value: counts.idle, color: "text-zinc-500" },
        { label: "Complete", value: counts.complete, color: "text-blue-600" },
        { label: "Avg Eff.", value: `${avgEff}%`, color: "text-zinc-700" },
      ].map(({ label, value, color }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono text-zinc-400 uppercase">
            {label}
          </span>
          <span className={`text-[11px] font-mono font-bold ${color}`}>
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FloorMapPage() {
  const [selectedLine, setSelectedLine] = useState<string>("LINE-A");
  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(true);

  const line = LINES.find((l) => l.id === selectedLine)!;
  const station = line.stations.find((s) => s.id === selectedStation) ?? null;

  const allStations = LINES.flatMap((l) => l.stations);
  const totalRunning = allStations.filter((s) => s.status === "running").length;
  const totalBottleneck = allStations.filter(
    (s) => s.status === "bottleneck",
  ).length;
  const totalBlocked = allStations.filter((s) => s.status === "blocked").length;
  const totalIdle = allStations.filter((s) => s.status === "idle").length;

  const unreadAlerts = NOTIFICATIONS.filter(
    (n) => n.type === "alert" || n.type === "warning",
  ).length;

  return (
    <div className="flex h-full bg-zinc-50 text-zinc-900 overflow-hidden">
      {/* ── Main area ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-200 shrink-0">
          <div>
            <p className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">
              Floor Map
            </p>
            <h1 className="mt-0.5 text-lg font-semibold text-zinc-900">
              Factory Floor Map
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE
            </span>
            <button
              onClick={() => setNotifOpen((v) => !v)}
              className="relative flex items-center gap-1.5 text-[10px] font-mono text-zinc-600 bg-zinc-100 border border-zinc-300 px-2.5 py-1 hover:bg-zinc-200 transition-colors"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              Events
              {unreadAlerts > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-[8px] font-mono font-bold text-white">
                  {unreadAlerts}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Global stats */}
        <div className="grid grid-cols-4 gap-px border-b border-zinc-200 shrink-0 bg-zinc-200">
          {[
            {
              label: "Running",
              value: totalRunning,
              color: "text-emerald-600",
            },
            {
              label: "Bottleneck",
              value: totalBottleneck,
              color: "text-red-600",
            },
            { label: "Blocked", value: totalBlocked, color: "text-orange-600" },
            { label: "Idle", value: totalIdle, color: "text-zinc-500" },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="flex flex-col items-center justify-center py-3 bg-white"
            >
              <span className={`text-xl font-bold font-mono ${color}`}>
                {value}
              </span>
              <span className="text-[9px] font-mono text-zinc-400 uppercase mt-0.5">
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Line tabs */}
        <div className="flex border-b border-zinc-200 shrink-0 overflow-x-auto">
          {LINES.map((l) => {
            const active = l.id === selectedLine;
            const hasProblem = l.stations.some(
              (s) => s.status === "bottleneck" || s.status === "blocked",
            );
            return (
              <button
                key={l.id}
                onClick={() => {
                  setSelectedLine(l.id);
                  setSelectedStation(null);
                }}
                className={`relative flex flex-col items-start gap-0.5 px-5 py-3 shrink-0 border-r border-zinc-200 transition-colors ${
                  active
                    ? "bg-zinc-100 text-zinc-900"
                    : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {active && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ backgroundColor: l.color }}
                  />
                )}
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: active ? l.color : "#d4d4d8" }}
                  />
                  <span className="text-[11px] font-mono font-bold uppercase">
                    {l.label}
                  </span>
                  {hasProblem && (
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  )}
                </div>
                <span className="text-[9px] font-mono text-zinc-400 pl-4 leading-tight max-w-30 truncate">
                  {l.style}
                </span>
              </button>
            );
          })}
        </div>

        {/* Line stats bar */}
        <div className="px-6 py-2.5 border-b border-zinc-200 bg-zinc-50 shrink-0">
          <StatsBar line={line} />
        </div>

        {/* ISO grid */}
        <div className="flex-1 overflow-auto relative">
          <div className="p-8 min-h-full">
            {/* Flow label */}
            <div className="flex items-center gap-2 mb-8">
              <span className="text-[9px] font-mono text-zinc-400 uppercase">
                Flow direction
              </span>
              <div className="flex items-center gap-1">
                <div className="w-16 h-px bg-zinc-300" />
                <svg width="6" height="6" viewBox="0 0 6 6">
                  <polygon points="0,0 6,3 0,6" fill="#a1a1aa" />
                </svg>
              </div>
            </div>

            {/* Stations */}
            <div className="flex flex-wrap items-end gap-x-4 gap-y-10">
              {line.stations.map((s, idx) => (
                <div key={s.id} className="flex items-end gap-0">
                  <div className="flex flex-col items-center">
                    {/* Step badge */}
                    <span
                      className="text-[8px] font-mono mb-2 px-1.5 py-0.5"
                      style={{
                        color: line.color,
                        backgroundColor: `${line.color}18`,
                        border: `1px solid ${line.color}30`,
                      }}
                    >
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <IsoBlock
                      station={s}
                      lineColor={line.color}
                      selected={selectedStation === s.id}
                      onClick={() =>
                        setSelectedStation(
                          selectedStation === s.id ? null : s.id,
                        )
                      }
                    />
                  </div>

                  {/* Arrow connector */}
                  {idx < line.stations.length - 1 && (
                    <div className="flex items-center self-center mb-6 mx-1">
                      <div className="w-5 h-px bg-zinc-300" />
                      <svg
                        width="5"
                        height="5"
                        viewBox="0 0 5 5"
                        className="opacity-70"
                      >
                        <polygon points="0,0 5,2.5 0,5" fill="#a1a1aa" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-14 flex flex-wrap gap-5">
              {(
                Object.entries(STATUS_CONFIG) as [
                  StationStatus,
                  (typeof STATUS_CONFIG)[StationStatus],
                ][]
              ).map(([status, cfg]) => (
                <div key={status} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: cfg.top }}
                  />
                  <span className="text-[9px] font-mono text-zinc-500 uppercase">
                    {cfg.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Station detail popup */}
          {station && (
            <StationDetail
              station={station}
              lineColor={line.color}
              onClose={() => setSelectedStation(null)}
            />
          )}
        </div>
      </div>

      {/* ── Notification panel ── */}
      {notifOpen && (
        <div className="w-72 border-l border-zinc-200 flex flex-col shrink-0 bg-white">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold text-zinc-700 uppercase">
                Event Log
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 bg-red-50 text-red-600 border border-red-200">
                {unreadAlerts} alerts
              </span>
            </div>
            <button
              onClick={() => setNotifOpen(false)}
              className="text-zinc-400 hover:text-zinc-700 text-xs"
            >
              ✕
            </button>
          </div>

          {/* Events list */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
            {NOTIFICATIONS.map((n) => {
              const cfg = NOTIF_CONFIG[n.type];
              return (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-l-2 ${cfg.border} hover:bg-zinc-50 transition-colors`}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`flex items-center justify-center w-4 h-4 rounded-full text-[8px] font-mono font-bold text-white shrink-0 mt-0.5 ${cfg.dot}`}
                    >
                      {cfg.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-[10px] font-semibold text-zinc-800 truncate">
                          {n.title}
                        </span>
                        <span className="text-[9px] font-mono text-zinc-400 shrink-0">
                          {n.time}
                        </span>
                      </div>
                      <p className="text-[9px] font-mono text-zinc-500 leading-relaxed">
                        {n.detail}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* All-lines summary */}
          <div className="border-t border-zinc-200 px-4 py-3 flex flex-col gap-2">
            <span className="text-[9px] font-mono text-zinc-400 uppercase mb-1">
              All Lines Status
            </span>
            {LINES.map((l) => {
              const problems = l.stations.filter(
                (s) => s.status === "bottleneck" || s.status === "blocked",
              ).length;
              const avgEff = Math.round(
                l.stations.reduce((a, s) => a + s.efficiency, 0) /
                  l.stations.length,
              );
              return (
                <div key={l.id} className="flex items-center gap-2">
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: l.color }}
                  />
                  <span className="text-[9px] font-mono text-zinc-600 flex-1">
                    {l.label}
                  </span>
                  <span className="text-[9px] font-mono text-zinc-600">
                    {avgEff}%
                  </span>
                  {problems > 0 && (
                    <span className="text-[8px] font-mono text-red-400 border border-red-500/20 px-1">
                      {problems} issues
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
