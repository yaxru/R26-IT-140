"use client";

import { useState } from "react";
import Link from "next/link";
import type { Bottleneck } from "@/app/(dashboard)/types";

export interface OverviewNotification {
  id: string;
  type: "critical" | "warning" | "info";
  timestamp: string;
  title: string;
  message: string;
  stationId?: string;
  actionUrl?: string;
  actionLabel?: string;
}

interface OverviewNotificationPanelProps {
  stations: Bottleneck[];
}

export function OverviewNotificationPanel({
  stations,
}: OverviewNotificationPanelProps) {
  const [filter, setFilter] = useState<"all" | "critical" | "warning" | "info">(
    "all",
  );
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  // Generate dynamic notifications based on real station data + system events
  const generateNotifications = (): OverviewNotification[] => {
    const notifications: OverviewNotification[] = [];

    // Critical bottlenecks from station data
    const bottlenecks = stations.filter((s) => s.is_bottleneck);
    bottlenecks.forEach((b) => {
      const gap =
        b.targeted_productivity && b.actual_productivity
          ? Math.round(
              ((b.targeted_productivity - b.actual_productivity) /
                b.targeted_productivity) *
                100,
            )
          : 0;
      notifications.push({
        id: `bottleneck-${b.station_id}`,
        type: "critical",
        timestamp: "Just now",
        title: `Critical Bottleneck: Station ${b.station_id}`,
        message: `Line throughput down by ${gap}%. WIP accumulated to ${b.wip} units. Operator reallocation recommended.`,
        stationId: b.station_id,
        actionUrl: "/worker-reallocation",
        actionLabel: "Reallocate Workers →",
      });
    });

    // High WIP warnings
    const highWipStations = stations.filter(
      (s) => !s.is_bottleneck && s.wip > 35,
    );
    highWipStations.forEach((s) => {
      notifications.push({
        id: `wip-${s.station_id}`,
        type: "warning",
        timestamp: "12m ago",
        title: `High WIP Queue: Station ${s.station_id}`,
        message: `Queue size reached ${s.wip} units (${s.required_skill}). Approaching capacity threshold.`,
        stationId: s.station_id,
        actionUrl: "/worker-reallocation",
        actionLabel: "View Station →",
      });
    });

    // Static system status info notifications
    notifications.push({
      id: "system-shift-sync",
      type: "info",
      timestamp: "35m ago",
      title: "Shift Schedule Synchronized",
      message:
        "Morning shift targets applied across all 12 active production stations.",
    });

    notifications.push({
      id: "system-[#1A7C4B]-rebal",
      type: "info",
      timestamp: "1h ago",
      title: "Automated Rebalancing Engine",
      message:
        "Hourly optimization scan completed. 1 move recommendation generated.",
      actionUrl: "/worker-reallocation",
      actionLabel: "View Engine →",
    });

    return notifications;
  };

  const allNotifications = generateNotifications();
  const visibleNotifications = allNotifications
    .filter((n) => !dismissedIds.includes(n.id))
    .filter((n) => filter === "all" || n.type === filter);

  const criticalCount = allNotifications.filter(
    (n) => n.type === "critical" && !dismissedIds.includes(n.id),
  ).length;
  const warningCount = allNotifications.filter(
    (n) => n.type === "warning" && !dismissedIds.includes(n.id),
  ).length;
  const infoCount = allNotifications.filter(
    (n) => n.type === "info" && !dismissedIds.includes(n.id),
  ).length;

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => [...prev, id]);
  };

  return (
    <div className="bg-white dark:bg-[#111113] h-full flex flex-col">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-[#EAEAEA] dark:border-zinc-800 flex items-center justify-between flex-wrap gap-2 shrink-0">
        <div className="flex items-center gap-3">
          <p className="text-[10px] font-medium tracking-widest text-[#9A9A9A] dark:text-zinc-500 uppercase">
            Alert Center
          </p>
          {criticalCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-semibold text-[#A77329] bg-[#FDFBF8] dark:bg-amber-950/20 border border-[#EACFA9] dark:border-amber-800/40">
              <span className="w-1.5 h-1.5 bg-[#CE8E33] animate-pulse" />
              {criticalCount} Critical
            </span>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 text-[11px] font-medium">
          {(
            [
              {
                id: "all",
                label: "All",
                count: allNotifications.length - dismissedIds.length,
              },
              { id: "critical", label: "Critical", count: criticalCount },
              { id: "warning", label: "Warnings", count: warningCount },
              { id: "info", label: "System", count: infoCount },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-2 py-1 transition-colors border ${
                filter === tab.id
                  ? "bg-[#1A7C4B] text-white border-[#1A7C4B]"
                  : "bg-transparent text-[#5F5F5F] dark:text-zinc-400 border-transparent hover:bg-[#F8F8F8] dark:hover:bg-zinc-800"
              }`}
            >
              {tab.label}
              <span
                className={`ml-1 text-[9px] tabular-nums ${
                  filter === tab.id
                    ? "text-white/80"
                    : "text-[#9A9A9A] dark:text-zinc-500"
                }`}
              >
                ({tab.count})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#F1F1F1] dark:divide-zinc-800/60 min-h-[260px]">
        {visibleNotifications.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#9A9A9A] dark:text-zinc-600">
            No active notifications.
          </div>
        ) : (
          visibleNotifications.map((item) => (
            <div
              key={item.id}
              className={`p-4 flex items-start justify-between gap-4 transition-colors ${
                item.type === "critical"
                  ? "bg-[#FDFBF8] dark:bg-amber-950/10 border-l-2 border-l-[#CE8E33]"
                  : item.type === "warning"
                    ? "bg-[#FDFBF8]/60 dark:bg-amber-950/5 border-l-2 border-l-[#D7A45A]"
                    : "bg-white dark:bg-transparent border-l-2 border-l-[#1A7C4B]"
              }`}
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {/* Indicator Dot */}
                <span
                  className={`mt-1.5 w-2 h-2 shrink-0 ${
                    item.type === "critical"
                      ? "bg-[#CE8E33] animate-pulse"
                      : item.type === "warning"
                        ? "bg-[#D7A45A]"
                        : "bg-[#1A7C4B]"
                  }`}
                  aria-hidden="true"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-xs font-bold text-[#242424] dark:text-zinc-100">
                      {item.title}
                    </span>
                    <span className="text-[10px] text-[#9A9A9A] dark:text-zinc-500 font-mono">
                      • {item.timestamp}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#5F5F5F] dark:text-zinc-400 leading-relaxed pr-2">
                    {item.message}
                  </p>
                </div>
              </div>

              {/* Action Button & Dismiss */}
              <div className="flex flex-col sm:flex-row items-center gap-2 shrink-0 mt-1 sm:mt-0">
                {item.actionUrl && (
                  <Link
                    href={item.actionUrl}
                    className={`text-[10px] font-semibold px-2.5 py-1.5 border transition-colors ${
                      item.type === "critical"
                        ? "bg-[#1A7C4B] text-white border-[#15633C] hover:bg-[#15633C]"
                        : "bg-[#F8F8F8] dark:bg-zinc-800 text-[#333333] dark:text-zinc-200 border-[#EAEAEA] dark:border-zinc-700 hover:bg-[#EAEAEA]"
                    }`}
                  >
                    {item.actionLabel || "View →"}
                  </Link>
                )}
                <button
                  onClick={() => handleDismiss(item.id)}
                  className="text-[#9A9A9A] hover:text-[#242424] dark:hover:text-zinc-200 text-xs px-2 py-1"
                  title="Dismiss notification"
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
