"use client";

import { useState } from "react";
import Link from "next/link";
import type { Bottleneck } from "../types";

interface OverviewStationTableProps {
  stations: Bottleneck[];
}

export function OverviewStationTable({ stations }: OverviewStationTableProps) {
  const [filter, setFilter] = useState<"all" | "bottlenecks" | "active">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredStations = stations.filter((s) => {
    if (filter === "bottlenecks" && !s.is_bottleneck) return false;
    if (
      filter === "active" &&
      (s.actual_productivity === null || s.actual_productivity === 0)
    )
      return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        s.station_id.toLowerCase().includes(q) ||
        s.required_skill.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const bottleneckCount = stations.filter((s) => s.is_bottleneck).length;
  const activeCount = stations.filter(
    (s) => s.actual_productivity !== null && s.actual_productivity > 0,
  ).length;

  return (
    <div className="bg-white dark:bg-[#111113]">
      {/* Table Header & Controls */}
      <div className="px-5 py-4 border-b border-[#EAEAEA] dark:border-zinc-800 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] font-medium tracking-widest text-[#9A9A9A] dark:text-zinc-500 uppercase">
            Factory Floor Status Table
          </p>
          <h3 className="text-sm font-bold text-[#242424] dark:text-zinc-100 mt-0.5">
            Production Line &amp; Station Overview
          </h3>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Search Box */}
          <input
            type="text"
            placeholder="Filter stations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1 text-xs border border-[#EAEAEA] dark:border-zinc-700 bg-[#F8F8F8] dark:bg-zinc-800 text-[#333333] dark:text-zinc-200 outline-none focus:border-[#1A7C4B] w-44"
          />

          {/* Filter Pills */}
          <div className="flex items-center border border-[#EAEAEA] dark:border-zinc-800">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                filter === "all"
                  ? "bg-[#1A7C4B] text-white"
                  : "bg-transparent text-[#5F5F5F] dark:text-zinc-400 hover:bg-[#F8F8F8] dark:hover:bg-zinc-800"
              }`}
            >
              All ({stations.length})
            </button>
            <button
              onClick={() => setFilter("bottlenecks")}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                filter === "bottlenecks"
                  ? "bg-[#CE8E33] text-white"
                  : "bg-transparent text-[#5F5F5F] dark:text-zinc-400 hover:bg-[#F8F8F8] dark:hover:bg-zinc-800"
              }`}
            >
              Bottlenecks ({bottleneckCount})
            </button>
            <button
              onClick={() => setFilter("active")}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                filter === "active"
                  ? "bg-[#1A7C4B] text-white"
                  : "bg-transparent text-[#5F5F5F] dark:text-zinc-400 hover:bg-[#F8F8F8] dark:hover:bg-zinc-800"
              }`}
            >
              Active ({activeCount})
            </button>
          </div>
        </div>
      </div>

      {/* Table Element */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#EAEAEA] dark:border-zinc-800 text-[#9A9A9A] dark:text-zinc-500 bg-[#F8F8F8] dark:bg-zinc-900/50 uppercase text-[10px] tracking-wider">
              <th className="text-left px-5 py-3 font-medium">Station ID</th>
              <th className="text-left px-4 py-3 font-medium">
                Skill / Machine
              </th>
              <th className="text-left px-4 py-3 font-medium">WIP Queue</th>
              <th className="text-left px-4 py-3 font-medium">Target Output</th>
              <th className="text-left px-4 py-3 font-medium">Actual Output</th>
              <th className="text-left px-4 py-3 font-medium">
                Efficiency Gap
              </th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-right px-5 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F1F1] dark:divide-zinc-800/40">
            {filteredStations.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="py-8 text-center text-[#9A9A9A] dark:text-zinc-600"
                >
                  No stations match the selected filter query.
                </td>
              </tr>
            ) : (
              filteredStations.map((s) => {
                const target = s.targeted_productivity
                  ? s.targeted_productivity * 100
                  : null;
                const actual = s.actual_productivity
                  ? s.actual_productivity * 100
                  : null;
                const gap =
                  target && actual ? ((target - actual) / target) * 100 : null;

                return (
                  <tr
                    key={s.station_id}
                    className={`hover:bg-[#F8F8F8] dark:hover:bg-zinc-800/30 transition-colors ${
                      s.is_bottleneck ? "bg-[#FDFBF8] dark:bg-amber-950/10" : ""
                    }`}
                  >
                    {/* Station ID */}
                    <td className="px-5 py-3 font-bold text-[#242424] dark:text-zinc-100">
                      {s.station_id}
                    </td>

                    {/* Skill / Machine */}
                    <td className="px-4 py-3 text-[#5F5F5F] dark:text-zinc-300 font-mono">
                      {s.required_skill}
                    </td>

                    {/* WIP Queue */}
                    <td className="px-4 py-3 font-mono font-bold tabular-nums text-[#333333] dark:text-zinc-200">
                      {s.wip} units
                    </td>

                    {/* Target Output */}
                    <td className="px-4 py-3 text-[#5F5F5F] dark:text-zinc-400 font-mono tabular-nums">
                      {target !== null ? `${target.toFixed(0)}%` : "—"}
                    </td>

                    {/* Actual Output */}
                    <td className="px-4 py-3 text-[#333333] dark:text-zinc-200 font-mono font-semibold tabular-nums">
                      {actual !== null ? `${actual.toFixed(0)}%` : "—"}
                    </td>

                    {/* Efficiency Gap */}
                    <td className="px-4 py-3 font-mono tabular-nums">
                      {gap !== null ? (
                        <span
                          className={`font-semibold ${
                            gap > 10
                              ? "text-[#CE8E33]"
                              : gap > 0
                                ? "text-[#D7A45A]"
                                : "text-[#1A7C4B] dark:text-[#47966F]"
                          }`}
                        >
                          {gap > 0
                            ? `-${gap.toFixed(1)}%`
                            : `+${Math.abs(gap).toFixed(1)}%`}
                        </span>
                      ) : (
                        <span className="text-[#9A9A9A]">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      {s.actual_productivity === null ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-[#9A9A9A]">
                          <span className="w-1.5 h-1.5 bg-[#D4D4D4]" />
                          Maintenance
                        </span>
                      ) : s.is_bottleneck ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#A77329] bg-[#FDFBF8] border border-[#EACFA9] px-2 py-0.5">
                          <span className="w-1.5 h-1.5 bg-[#CE8E33] animate-pulse" />
                          Bottleneck
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#1A7C4B] bg-[#E6F1EC] border border-[#B9D7C8] px-2 py-0.5">
                          <span className="w-1.5 h-1.5 bg-[#1A7C4B]" />
                          Normal
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="px-5 py-3 text-right">
                      {s.is_bottleneck ? (
                        <Link
                          href="/worker-reallocation"
                          className="inline-block text-[11px] font-semibold text-white bg-[#1A7C4B] hover:bg-[#15633C] px-2.5 py-1 border border-[#15633C] transition-colors"
                        >
                          Reallocate →
                        </Link>
                      ) : (
                        <Link
                          href="/worker-reallocation"
                          className="inline-block text-[11px] font-medium text-[#5F5F5F] hover:text-[#242424] dark:text-zinc-400 dark:hover:text-zinc-100 hover:underline"
                        >
                          View Line
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
