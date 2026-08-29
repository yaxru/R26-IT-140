"use client";

import { useMemo } from "react";
import type { Bottleneck } from "@/app/(dashboard)/types";
import { SankeyFlow, type SankeyNode, type SankeyLink } from "./SankeyFlow";

interface StationFlowDiagramProps {
  stations: Bottleneck[];
}

const STATUS_OK = "status:ok";
const STATUS_BOTTLENECK = "status:bottleneck";

export function StationFlowDiagram({ stations }: StationFlowDiagramProps) {
  const { columns, links } = useMemo(() => {
    if (stations.length === 0) {
      return {
        columns: [[], [], []] as SankeyNode[][],
        links: [] as SankeyLink[],
      };
    }

    const stationNodes: SankeyNode[] = stations.map((s) => ({
      id: `st:${s.station_id}`,
      label: s.station_id,
    }));

    const skillIds = Array.from(new Set(stations.map((s) => s.required_skill)));
    const skillNodes: SankeyNode[] = skillIds.map((sk) => ({
      id: `sk:${sk}`,
      label: sk,
    }));

    const statusNodes: SankeyNode[] = [
      { id: STATUS_OK, label: "On Target" },
      { id: STATUS_BOTTLENECK, label: "Bottleneck" },
    ];

    const linkList: SankeyLink[] = [];
    stations.forEach((s) => {
      const weight = Math.max(s.wip, 1);
      linkList.push({
        source: `st:${s.station_id}`,
        target: `sk:${s.required_skill}`,
        value: weight,
      });
    });
    skillIds.forEach((sk) => {
      const inSkill = stations.filter((s) => s.required_skill === sk);
      const okWeight = inSkill
        .filter((s) => !s.is_bottleneck)
        .reduce((sum, s) => sum + Math.max(s.wip, 1), 0);
      const bnWeight = inSkill
        .filter((s) => s.is_bottleneck)
        .reduce((sum, s) => sum + Math.max(s.wip, 1), 0);
      if (okWeight > 0) {
        linkList.push({
          source: `sk:${sk}`,
          target: STATUS_OK,
          value: okWeight,
        });
      }
      if (bnWeight > 0) {
        linkList.push({
          source: `sk:${sk}`,
          target: STATUS_BOTTLENECK,
          value: bnWeight,
        });
      }
    });

    return {
      columns: [stationNodes, skillNodes, statusNodes],
      links: linkList,
    };
  }, [stations]);

  const hasData = stations.length > 0;

  return (
    <div className="bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800/60 p-5">
      <div className="flex items-start justify-between mb-2">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-zinc-400 dark:text-zinc-500 uppercase">
            Station &rarr; Skill &rarr; Status
          </span>
          <h2 className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Where WIP is flowing
          </h2>
        </div>
        <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-600">
          {stations.length} stations
        </span>
      </div>

      {hasData ? (
        <>
          <SankeyFlow
            columns={columns}
            links={links}
            height={Math.max(
              220,
              34 * Math.max(...columns.map((c) => c.length)),
            )}
            nodeColor={(node, ci) => {
              if (ci === columns.length - 1) {
                return node.id === STATUS_BOTTLENECK ? "#fb923c" : "#10b981";
              }
              return ci === 0 ? "#a1a1aa" : "#10b981";
            }}
            linkColor={(link) =>
              link.target === STATUS_BOTTLENECK ? "#fb923c" : "#10b981"
            }
          />
          <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/40 text-[9px] font-mono text-zinc-400 dark:text-zinc-600 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-zinc-400 dark:bg-zinc-500" />
              Stations
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-emerald-500" />
              Skill / On target
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-orange-400" />
              Bottleneck
            </span>
            <span className="normal-case tracking-normal ml-auto">
              darker ribbon = more WIP &middot; width = flow volume
            </span>
          </div>
        </>
      ) : (
        <div className="h-40 flex items-center justify-center text-[10px] font-mono text-zinc-300 dark:text-zinc-700">
          No station data yet
        </div>
      )}
    </div>
  );
}
