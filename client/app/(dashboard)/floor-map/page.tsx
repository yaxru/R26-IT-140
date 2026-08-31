"use client";

import { useEffect, useState, DragEvent } from "react";
import { createClient } from "@/lib/supabase/client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Station {
  id: string; // React key for managing unsaved stations
  station_id: string;
  required_skill: string;
  sequence_order: number;
}

interface Worker {
  operator_id: string;
  operator_name: string;
  worker_id: string;
  station_id: string | null;
  primary_skill: string;
  proficiency_grade: string;
}

export default function UnifiedRoutingPage() {
  const supabase = createClient();
  const [lineId, setLineId] = useState("");
  const [availableLines, setAvailableLines] = useState<string[]>([]);
  const [availableSkills, setAvailableSkills] = useState<string[]>([]);

  const [stations, setStations] = useState<Station[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  const [draggedWorkerId, setDraggedWorkerId] = useState<string | null>(null);

  // 1. Initial Load: Fetch available lines and machine skills
  useEffect(() => {
    const fetchGlobals = async () => {
      try {
        const { data: lineData } = await supabase
          .from("vw_line_assignments")
          .select("line_id");
        if (lineData) {
          const uniqueLines = Array.from(
            new Set(lineData.map((r) => r.line_id)),
          ).sort();
          setAvailableLines(uniqueLines);
          if (uniqueLines.length > 0) setLineId(uniqueLines[0]);
        }

        const { data: skillData } = await supabase
          .from("skill_matrix")
          .select("machine_type");
        if (skillData) {
          const uniqueSkills = Array.from(
            new Set(skillData.map((r) => r.machine_type)),
          ).sort();
          setAvailableSkills(uniqueSkills);
        }
      } catch (e) {
        console.error("Failed to load global data", e);
      }
    };
    fetchGlobals();
  }, [supabase]);

  // 2. Line Load: Fetch layout and workers when line changes
  useEffect(() => {
    if (!lineId) return;

    const fetchLineData = async () => {
      setIsLoading(true);
      setMessage(null);
      try {
        const { data: stationData, error: stationError } = await supabase
          .from("production_status")
          .select("station_id, required_skill, sequence_order")
          .eq("line_id", lineId)
          .order("sequence_order", { ascending: true });

        if (stationError) throw stationError;

        setStations(
          (stationData || []).map((s) => ({ ...s, id: crypto.randomUUID() })),
        );

        const { data: workerData, error: workerError } = await supabase
          .from("vw_line_assignments")
          .select("*")
          .eq("line_id", lineId);

        if (workerError) throw workerError;
        setWorkers(workerData || []);
      } catch (e) {
        setMessage({ text: "Failed to load floor data.", type: "error" });
      } finally {
        setIsLoading(false);
      }
    };

    fetchLineData();
  }, [lineId, supabase]);

  // --- Station Management ---
const handleAddStation = () => {
    const nextNum = stations.length + 1;
    const defaultSkill = availableSkills.length > 0 ? availableSkills[0] : "";
    setStations([
      ...stations,
      {
        id: crypto.randomUUID(),
        // Add the lineId prefix here
        station_id: `${lineId}-St-${nextNum.toString().padStart(2, "0")}`, 
        required_skill: defaultSkill,
        sequence_order: nextNum,
      },
    ]);
  };

  // NEW: Instantly create a station and move an entire skill group into it
const handleCreateStationFromGroup = (skill: string, groupWorkers: Worker[]) => {
    const nextNum = stations.length + 1;
    // Add the lineId prefix here too
    const newStationId = `${lineId}-St-${nextNum.toString().padStart(2, "0")}`;

    setStations([
      ...stations,
      {
        id: crypto.randomUUID(),
        station_id: newStationId,
        required_skill: skill,
        sequence_order: nextNum,
      },
    ]);

    setWorkers((prev) =>
      prev.map((w) => {
        if (groupWorkers.some((gw) => gw.operator_id === w.operator_id)) {
          return { ...w, station_id: newStationId };
        }
        return w;
      })
    );
  };

  const handleRemoveStation = (idToRemove: string) => {
    const stationToRemove = stations.find((s) => s.id === idToRemove);
    if (stationToRemove) {
      setWorkers((prev) =>
        prev.map((w) =>
          w.station_id === stationToRemove.station_id
            ? { ...w, station_id: null }
            : w,
        ),
      );
    }
    setStations(stations.filter((s) => s.id !== idToRemove));
  };

  const handleStationChange = (
    id: string,
    field: keyof Station,
    value: string,
  ) => {
    setStations(
      stations.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    );
  };

  // --- Drag & Drop ---
  const handleDragStart = (
    e: DragEvent<HTMLDivElement>,
    operatorId: string,
  ) => {
    setDraggedWorkerId(operatorId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDropToStation = (
    e: DragEvent<HTMLDivElement>,
    targetStationId: string,
  ) => {
    e.preventDefault();
    if (!draggedWorkerId) return;

    // CHANGED: Simply update the dragged worker to the new station without kicking anyone out
    setWorkers((prev) =>
      prev.map((w) =>
        w.operator_id === draggedWorkerId
          ? { ...w, station_id: targetStationId }
          : w,
      ),
    );
    setDraggedWorkerId(null);
  };

  const handleDropToPool = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!draggedWorkerId) return;
    setWorkers((prev) =>
      prev.map((w) =>
        w.operator_id === draggedWorkerId ? { ...w, station_id: null } : w,
      ),
    );
    setDraggedWorkerId(null);
  };

  const handleUnassign = (operatorId: string) => {
    setWorkers((prev) =>
      prev.map((w) =>
        w.operator_id === operatorId ? { ...w, station_id: null } : w,
      ),
    );
  };

  // --- Unified Save Pipeline ---
  const handleSaveFloorPlan = async () => {
    if (stations.length === 0) {
      setMessage({
        text: "You must configure at least one station.",
        type: "error",
      });
      return;
    }

    if (stations.some((s) => !s.station_id.trim())) {
      setMessage({
        text: "All stations must have a valid ID/Name.",
        type: "error",
      });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const headers: Record<string, string> = session?.access_token
        ? {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          }
        : { "Content-Type": "application/json" };

      const layoutPayload = {
        line_id: lineId,
        stations: stations.map((s, index) => ({
          station_id: s.station_id,
          sequence_order: index + 1,
          required_skill: s.required_skill,
        })),
      };

      const layoutRes = await fetch(`${API_BASE}/line-layout`, {
        method: "POST",
        headers,
        body: JSON.stringify(layoutPayload),
      });

      if (!layoutRes.ok)
        throw new Error("Failed to save physical line layout.");

      const assignmentPayload = {
        line_id: lineId,
        assignments: workers.map((w) => ({
          operator_id: w.operator_id,
          station_id: w.station_id,
        })),
      };

      const assignRes = await fetch(`${API_BASE}/assign-workers`, {
        method: "POST",
        headers,
        body: JSON.stringify(assignmentPayload),
      });

      if (!assignRes.ok)
        throw new Error("Failed to lock in worker assignments.");

      setMessage({
        text: `Floor plan saved. ${stations.length} stations configured and workers routed.`,
        type: "success",
      });
    } catch (e) {
      setMessage({
        text: e instanceof Error ? e.message : "An unknown error occurred.",
        type: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // --- Render Helpers ---
  const unassignedWorkers = workers.filter((w) => w.station_id === null);
  const poolBySkill = unassignedWorkers.reduce(
    (acc, worker) => {
      if (!acc[worker.primary_skill]) acc[worker.primary_skill] = [];
      acc[worker.primary_skill].push(worker);
      return acc;
    },
    {} as Record<string, Worker[]>,
  );

  const WorkerCard = ({ worker }: { worker: Worker }) => (
    <div
      draggable
      onDragStart={(e) => handleDragStart(e, worker.operator_id)}
      className="bg-white dark:bg-zinc-900 border border-[#EAEAEA] dark:border-zinc-800 p-3 cursor-grab active:cursor-grabbing hover:border-[#1A7C4B] transition-colors"
    >
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="text-sm font-bold text-[#242424] dark:text-zinc-100 truncate">
          {worker.operator_name}
        </span>
        <span className="text-[10px] font-mono text-[#9A9A9A] tracking-widest uppercase">
          {worker.worker_id}
        </span>
      </div>
      <div className="flex gap-2">
        <span className="px-1.5 py-0.5 bg-[#F8F8F8] dark:bg-zinc-800 border border-[#EAEAEA] dark:border-zinc-700 text-[#5F5F5F] dark:text-zinc-400 text-[9px] font-bold uppercase tracking-widest">
          {worker.primary_skill}
        </span>
        <span className="px-1.5 py-0.5 bg-[#F8F8F8] dark:bg-zinc-800 border border-[#EAEAEA] dark:border-zinc-700 text-[#5F5F5F] dark:text-zinc-400 text-[9px] font-bold uppercase tracking-widest">
          Grade {worker.proficiency_grade}
        </span>
      </div>
    </div>
  );

  return (
    <main className="flex flex-col h-full bg-[#F8F8F8] dark:bg-[#030C08] text-[#242424] dark:text-zinc-200 min-h-0">
      {/* ── Header ── */}
      <section className="bg-white dark:bg-[#111113] border-b border-[#EAEAEA] dark:border-zinc-800 px-6 lg:px-8 py-6 flex flex-col md:flex-row md:items-start justify-between shrink-0">
        <div>
          
          <h1 className="text-xl font-bold tracking-tight text-[#242424] dark:text-zinc-100">
            Line Layout &amp; Routing
          </h1>
          <p className="text-xs text-[#5F5F5F] dark:text-zinc-400 mt-1.5 leading-relaxed">
            Configure stations and route operators to build the production line
            layout.
          </p>
        </div>

        <div className="flex items-center gap-4 mt-4 md:mt-0">
          <select
            value={lineId}
            onChange={(e) => setLineId(e.target.value)}
            className="w-48 bg-[#F8F8F8] dark:bg-zinc-900/60 border border-[#EAEAEA] dark:border-zinc-700 px-3 py-2 text-sm font-bold text-[#242424] dark:text-zinc-100 focus:outline-none focus:border-[#1A7C4B] transition-colors"
          >
            {availableLines.length === 0 ? (
              <option value="">Loading Lines...</option>
            ) : (
              availableLines.map((line) => (
                <option key={line} value={line}>
                  {line}
                </option>
              ))
            )}
          </select>
          <button
            onClick={handleSaveFloorPlan}
            disabled={isSaving}
            className="px-5 py-2 text-[11px] font-bold uppercase tracking-widest bg-[#1A7C4B] hover:bg-[#15633C] border border-[#15633C] text-white disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {isSaving ? `Saving ${lineId}...` : `Save ${lineId} Layout ↗`}
          </button>
        </div>
      </section>

      {message && (
        <div
          className={`px-6 py-3 text-xs font-mono uppercase tracking-widest border-b shrink-0 ${message.type === "success" ? "bg-[#E6F1EC] text-[#1A7C4B] border-[#1A7C4B]/20 dark:bg-[#0A321E] dark:text-[#47966F]" : "bg-[#FDFBF8] text-[#CE8E33] border-[#CE8E33]/20 dark:bg-amber-950/20 dark:text-[#D7A45A]"}`}
        >
          {message.text}
        </div>
      )}

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-[10px] font-mono text-[#9A9A9A] dark:text-zinc-500 uppercase tracking-widest">
          Loading Floor Architecture...
        </div>
      ) : (
        <section className="flex-1 flex flex-col xl:flex-row min-h-0 bg-white dark:bg-[#111113]">
          {/* ── Left Column: Talent Pool ── */}
          <div
            className="xl:w-1/4 border-b xl:border-b-0 xl:border-r border-[#EAEAEA] dark:border-zinc-800 flex flex-col bg-white dark:bg-[#111113]"
            onDragOver={handleDragOver}
            onDrop={handleDropToPool}
          >
            <div className="px-6 py-4 border-b border-[#EAEAEA] dark:border-zinc-800 bg-[#F8F8F8] dark:bg-zinc-900/40 shrink-0">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#5F5F5F] dark:text-zinc-400">
                Talent Pool
              </h2>
              <p className="text-[9px] font-mono text-[#9A9A9A] dark:text-zinc-500 uppercase tracking-widest mt-1">
                Available for {lineId}
              </p>
            </div>

            <div className="p-6 overflow-y-auto flex-1 min-h-0 space-y-6 bg-[#F8F8F8] dark:bg-zinc-900/10">
              {Object.keys(poolBySkill).length === 0 ? (
                <div className="text-center py-10 text-[10px] font-mono text-[#9A9A9A] uppercase tracking-widest border border-dashed border-[#EAEAEA] dark:border-zinc-700">
                  Pool is empty
                </div>
              ) : (
                Object.entries(poolBySkill).map(([skill, skillWorkers]) => (
                  <div key={skill}>
                    <div className="flex items-center justify-between border-b border-[#EAEAEA] dark:border-zinc-700 pb-2 mb-3">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#242424] dark:text-zinc-200">
                        {skill}{" "}
                        <span className="font-normal text-[#9A9A9A]">
                          ({skillWorkers.length})
                        </span>
                      </h3>
                      {/* NEW: Quick Create Button */}
                      <button
                        onClick={() =>
                          handleCreateStationFromGroup(skill, skillWorkers)
                        }
                        className="text-[9px] font-bold uppercase tracking-widest text-[#1A7C4B] hover:text-[#15633C] transition-colors"
                        title={`Create station & add all ${skillWorkers.length} workers`}
                      >
                        + Auto Station
                      </button>
                    </div>
                    <div className="space-y-2">
                      {skillWorkers.map((worker) => (
                        <WorkerCard key={worker.operator_id} worker={worker} />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Right Column: Floor Map / Stations ── */}
          <div className="xl:w-3/4 flex flex-col bg-white dark:bg-[#111113]">
            <div className="px-6 py-4 border-b border-[#EAEAEA] dark:border-zinc-800 bg-[#F8F8F8] dark:bg-zinc-900/40 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#5F5F5F] dark:text-zinc-400">
                  Station Canvas
                </h2>
                <p className="text-[9px] font-mono text-[#9A9A9A] dark:text-zinc-500 mt-1 uppercase tracking-widest">
                  Define stations and route workers
                </p>
              </div>
              <button
                onClick={handleAddStation}
                className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest border border-[#EAEAEA] dark:border-zinc-700 text-[#242424] dark:text-zinc-200 hover:bg-[#F8F8F8] dark:hover:bg-zinc-800 transition-colors"
              >
                + Add Station
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 min-h-0 bg-[#F1F1F1] dark:bg-zinc-900/20">
              {stations.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-[#C6C6C6] dark:border-zinc-700">
                  <p className="text-sm font-bold text-[#5F5F5F] dark:text-zinc-400">
                    No layout configured
                  </p>
                  <p className="text-[10px] font-mono text-[#9A9A9A] mt-2 uppercase tracking-widest">
                    Click "Add Station" to build the line.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {stations.map((station, index) => {
                    // CHANGED: Filter ALL workers assigned to this station instead of just finding one
                    const assignedWorkers = workers.filter(
                      (w) => w.station_id === station.station_id,
                    );

                    return (
                      <div
                        key={station.id}
                        onDragOver={handleDragOver}
                        onDrop={(e) =>
                          handleDropToStation(e, station.station_id)
                        }
                        className={`flex flex-col bg-white dark:bg-[#111113] transition-all group ${
                          draggedWorkerId
                            ? "border border-dashed border-[#1A7C4B] dark:border-[#47966F] shadow-sm"
                            : "border border-[#EAEAEA] dark:border-zinc-700 hover:border-[#C6C6C6] dark:hover:border-zinc-600"
                        }`}
                      >
                        {/* Station Config Header */}
                        <div className="p-4 border-b border-[#EAEAEA] dark:border-zinc-800 bg-[#F8F8F8] dark:bg-zinc-900/40 relative shrink-0">
                          <div className="flex items-center gap-2 mb-3 pr-6">
                            <span className="text-[10px] font-mono text-[#9A9A9A] font-bold">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <input
                              type="text"
                              value={station.station_id}
                              onChange={(e) =>
                                handleStationChange(
                                  station.id,
                                  "station_id",
                                  e.target.value,
                                )
                              }
                              placeholder="Station ID"
                              className="flex-1 bg-transparent border-b border-[#C6C6C6] dark:border-zinc-600 px-1 py-0.5 text-xs font-bold text-[#242424] dark:text-zinc-100 focus:outline-none focus:border-[#1A7C4B] dark:focus:border-[#47966F] transition-colors"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold uppercase tracking-widest text-[#9A9A9A] dark:text-zinc-500 mb-1 block">
                              Required Skill
                            </label>
                            <select
                              value={station.required_skill}
                              onChange={(e) =>
                                handleStationChange(
                                  station.id,
                                  "required_skill",
                                  e.target.value,
                                )
                              }
                              className="w-full bg-white dark:bg-[#111113] border border-[#EAEAEA] dark:border-zinc-700 px-2 py-1.5 text-[11px] font-mono uppercase text-[#242424] dark:text-zinc-200 focus:outline-none focus:border-[#1A7C4B] transition-colors"
                            >
                              {availableSkills.map((skill) => (
                                <option key={skill} value={skill}>
                                  {skill}
                                </option>
                              ))}
                            </select>
                          </div>

                          <button
                            onClick={() => handleRemoveStation(station.id)}
                            className="absolute top-3 right-3 text-[#9A9A9A] hover:text-[#CE8E33] transition-colors"
                            title="Delete Station"
                          >
                            ✕
                          </button>
                        </div>

                        {/* Drop Zone (Now supports multiple workers) */}
                        <div className="flex-1 p-3 flex flex-col gap-2 min-h-30 overflow-y-auto">
                          {assignedWorkers.length > 0 ? (
                            <>
                              {assignedWorkers.map((assignedWorker) => (
                                <div
                                  key={assignedWorker.operator_id}
                                  className="relative group/worker bg-[#E6F1EC] dark:bg-[#0A321E]/60 border border-[#1A7C4B]/20 p-3 shrink-0"
                                >
                                  <div className="flex justify-between items-start gap-2">
                                    <div className="overflow-hidden">
                                      <p className="text-sm font-bold text-[#15633C] dark:text-[#47966F] truncate">
                                        {assignedWorker.operator_name}
                                      </p>
                                      <p className="text-[10px] font-mono text-[#1A7C4B]/80 dark:text-[#47966F]/80 mt-1 uppercase tracking-widest">
                                        {assignedWorker.worker_id} · Grade{" "}
                                        {assignedWorker.proficiency_grade}
                                      </p>
                                    </div>
                                    {assignedWorker.primary_skill !==
                                      station.required_skill && (
                                      <span
                                        className="text-[9px] bg-[#FDFBF8] text-[#CE8E33] border border-[#CE8E33]/30 dark:bg-amber-950/40 dark:text-[#D7A45A] px-1.5 py-0.5 font-bold uppercase tracking-widest whitespace-nowrap"
                                        title="Skill Mismatch"
                                      >
                                        Mismatch
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    onClick={() =>
                                      handleUnassign(assignedWorker.operator_id)
                                    }
                                    className="absolute top-2 right-2 text-[#1A7C4B]/50 hover:text-[#CE8E33] opacity-0 group-hover/worker:opacity-100 transition-opacity"
                                    title="Unassign"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}

                              {/* Visual cue that you can still drop more */}
                              <div className="text-center py-2 text-[9px] font-mono text-[#9A9A9A] uppercase tracking-widest border border-dashed border-transparent hover:border-[#C6C6C6] dark:hover:border-zinc-700 transition-colors">
                                Drop more here
                              </div>
                            </>
                          ) : (
                            <div className="h-full flex items-center justify-center border border-dashed border-[#C6C6C6] dark:border-zinc-700 bg-[#F8F8F8] dark:bg-zinc-800/20 text-[10px] font-mono text-[#9A9A9A] uppercase tracking-widest py-8">
                              Drop Worker Here
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
