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
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const [draggedWorkerId, setDraggedWorkerId] = useState<string | null>(null);

  // 1. Initial Load: Fetch available lines and machine skills
  useEffect(() => {
    const fetchGlobals = async () => {
      try {
        // Fetch unique lines from imported workers
        const { data: lineData } = await supabase.from("vw_line_assignments").select("line_id");
        if (lineData) {
          const uniqueLines = Array.from(new Set(lineData.map((r) => r.line_id))).sort();
          setAvailableLines(uniqueLines);
          if (uniqueLines.length > 0) setLineId(uniqueLines[0]);
        }

        // Fetch unique skills from the skill matrix
        const { data: skillData } = await supabase.from("skill_matrix").select("machine_type");
        if (skillData) {
          const uniqueSkills = Array.from(new Set(skillData.map((r) => r.machine_type))).sort();
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
        
        setStations((stationData || []).map(s => ({ ...s, id: crypto.randomUUID() })));

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
        station_id: `Station-${nextNum.toString().padStart(2, "0")}`,
        required_skill: defaultSkill,
        sequence_order: nextNum,
      },
    ]);
  };

  const handleRemoveStation = (idToRemove: string) => {
    const stationToRemove = stations.find(s => s.id === idToRemove);
    if (stationToRemove) {
      // Kick worker back to pool if their station is deleted
      setWorkers(prev => prev.map(w => w.station_id === stationToRemove.station_id ? { ...w, station_id: null } : w));
    }
    setStations(stations.filter((s) => s.id !== idToRemove));
  };

  const handleStationChange = (id: string, field: keyof Station, value: string) => {
    setStations(stations.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  // --- Drag & Drop ---
  const handleDragStart = (e: DragEvent<HTMLDivElement>, operatorId: string) => {
    setDraggedWorkerId(operatorId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDropToStation = (e: DragEvent<HTMLDivElement>, targetStationId: string) => {
    e.preventDefault();
    if (!draggedWorkerId) return;

    const existingWorker = workers.find((w) => w.station_id === targetStationId);

    setWorkers((prev) =>
      prev.map((w) => {
        if (w.operator_id === draggedWorkerId) return { ...w, station_id: targetStationId };
        if (existingWorker && w.operator_id === existingWorker.operator_id) return { ...w, station_id: null };
        return w;
      })
    );
    setDraggedWorkerId(null);
  };

  const handleDropToPool = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!draggedWorkerId) return;
    setWorkers((prev) => prev.map((w) => w.operator_id === draggedWorkerId ? { ...w, station_id: null } : w));
    setDraggedWorkerId(null);
  };

  const handleUnassign = (operatorId: string) => {
    setWorkers((prev) => prev.map((w) => (w.operator_id === operatorId ? { ...w, station_id: null } : w)));
  };

  // --- Unified Save Pipeline ---
  const handleSaveFloorPlan = async () => {
    if (stations.length === 0) {
      setMessage({ text: "You must configure at least one station.", type: "error" });
      return;
    }

    // Validate station IDs are filled
    if (stations.some(s => !s.station_id.trim())) {
      setMessage({ text: "All stations must have a valid ID/Name.", type: "error" });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }
        : { "Content-Type": "application/json" };

      // 1. Post Layout
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

      if (!layoutRes.ok) throw new Error("Failed to save physical line layout.");

      // 2. Post Worker Assignments
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

      if (!assignRes.ok) throw new Error("Failed to lock in worker assignments.");

      setMessage({ text: `Floor plan saved. ${stations.length} stations configured and workers routed.`, type: "success" });
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "An unknown error occurred.", type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  // --- Render Helpers ---
  const unassignedWorkers = workers.filter((w) => w.station_id === null);
  const poolBySkill = unassignedWorkers.reduce((acc, worker) => {
    if (!acc[worker.primary_skill]) acc[worker.primary_skill] = [];
    acc[worker.primary_skill].push(worker);
    return acc;
  }, {} as Record<string, Worker[]>);

  const WorkerCard = ({ worker }: { worker: Worker }) => (
    <div
      draggable
      onDragStart={(e) => handleDragStart(e, worker.operator_id)}
      className="bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800 p-3 cursor-grab active:cursor-grabbing hover:border-blue-500 transition-colors shadow-sm"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{worker.operator_name}</span>
        <span className="text-[10px] font-mono text-zinc-500">{worker.worker_id}</span>
      </div>
      <div className="flex gap-2">
        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-[10px] font-mono uppercase">
          {worker.primary_skill}
        </span>
        <span className="px-2 py-0.5 bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 text-[10px] font-mono font-bold">
          Grade {worker.proficiency_grade}
        </span>
      </div>
    </div>
  );

  return (
    <div className="px-6 py-6 h-full flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between shrink-0 border-b border-zinc-200 dark:border-zinc-800/60 pb-6">
        <div>
          <p className="text-[10px] font-mono tracking-widest text-zinc-400 dark:text-zinc-500 uppercase">
            Workforce Control
          </p>
          <h1 className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Line Layout &amp; Routing
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={lineId}
            onChange={(e) => setLineId(e.target.value)}
            className="bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800 text-sm font-bold px-4 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none rounded-none w-48"
          >
            {availableLines.length === 0 ? (
              <option value="">Loading Lines...</option>
            ) : (
              availableLines.map((line) => (
                <option key={line} value={line}>{line}</option>
              ))
            )}
          </select>
          <button
            onClick={handleSaveFloorPlan}
            disabled={isSaving}
            className="px-6 py-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-bold uppercase tracking-widest rounded-none transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? "Saving..." : "Save Floor Plan"}
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-4 text-xs font-mono uppercase tracking-wider border rounded-none shrink-0 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          {message.text}
        </div>
      )}

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-xs font-mono text-zinc-500 uppercase tracking-widest animate-pulse">
          Loading Floor Architecture...
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 xl:grid-cols-4 gap-6 min-h-0">
          
          {/* Left Column: Talent Pool */}
          <div 
            className="xl:col-span-1 bg-zinc-50 dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800/60 flex flex-col"
            onDragOver={handleDragOver}
            onDrop={handleDropToPool}
          >
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800/60 shrink-0 bg-white dark:bg-zinc-900/30">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                Talent Pool
              </h2>
              <p className="text-[10px] font-mono text-zinc-500 mt-1">Available for {lineId}</p>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1 space-y-6">
              {Object.keys(poolBySkill).length === 0 ? (
                <div className="text-center py-10 text-[10px] font-mono text-zinc-400 uppercase">Pool is empty</div>
              ) : (
                Object.entries(poolBySkill).map(([skill, skillWorkers]) => (
                  <div key={skill}>
                    <h3 className="text-[10px] font-mono font-bold text-zinc-400 uppercase border-b border-zinc-200 dark:border-zinc-800 pb-1 mb-3">
                      {skill} <span className="font-normal">({skillWorkers.length})</span>
                    </h3>
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

          {/* Right Column: Floor Map / Stations */}
          <div className="xl:col-span-3 bg-zinc-50 dark:bg-zinc-900/10 border border-zinc-200 dark:border-zinc-800/60 flex flex-col">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800/60 shrink-0 bg-white dark:bg-zinc-900/30 flex items-center justify-between">
               <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                    Station Canvas
                  </h2>
                  <p className="text-[10px] font-mono text-zinc-500 mt-1">Define stations and drop workers</p>
               </div>
               <button
                  onClick={handleAddStation}
                  className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <span className="text-lg leading-none">+</span> Add Station
                </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {stations.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-zinc-200 dark:border-zinc-800">
                  <p className="text-sm font-mono text-zinc-500">No layout configured.</p>
                  <p className="text-[10px] text-zinc-400 mt-2">Click "Add Station" to build the line.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {stations.map((station, index) => {
                    const assignedWorker = workers.find((w) => w.station_id === station.station_id);
                    
                    return (
                      <div 
                        key={station.id}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDropToStation(e, station.station_id)}
                        className={`border-2 flex flex-col bg-white dark:bg-[#111113] transition-all group ${
                          draggedWorkerId ? 'border-dashed border-zinc-300 dark:border-zinc-700' : 'border-solid border-zinc-200 dark:border-zinc-800'
                        }`}
                      >
                        {/* Station Config Header */}
                        <div className="p-3 border-b border-zinc-100 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-900/30 flex flex-col gap-2 relative">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-zinc-400 font-bold">{index + 1}.</span>
                            <input
                              type="text"
                              value={station.station_id}
                              onChange={(e) => handleStationChange(station.id, "station_id", e.target.value)}
                              placeholder="Station Name"
                              className="flex-1 bg-transparent border-b border-zinc-300 dark:border-zinc-700 px-1 py-0.5 text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100"
                            />
                          </div>
                          <select
                            value={station.required_skill}
                            onChange={(e) => handleStationChange(station.id, "required_skill", e.target.value)}
                            className="w-full bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-700 px-2 py-1 text-[10px] font-mono uppercase text-zinc-700 dark:text-zinc-300 focus:outline-none rounded-none"
                          >
                            {availableSkills.map((skill) => (
                              <option key={skill} value={skill}>{skill}</option>
                            ))}
                          </select>
                          
                          <button
                            onClick={() => handleRemoveStation(station.id)}
                            className="absolute top-2 right-2 p-1 text-zinc-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete Station"
                          >
                            ✕
                          </button>
                        </div>
                        
                        {/* Drop Zone */}
                        <div className="flex-1 p-4 flex flex-col justify-center min-h-[100px]">
                          {assignedWorker ? (
                            <div className="relative group/worker bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 p-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100">{assignedWorker.operator_name}</p>
                                  <p className="text-[10px] font-mono text-emerald-700 dark:text-emerald-500 mt-1">Grade {assignedWorker.proficiency_grade}</p>
                                </div>
                                {assignedWorker.primary_skill !== station.required_skill && (
                                  <span className="text-[10px] bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 font-bold uppercase tracking-wider" title="Skill Mismatch!">
                                    Mismatch
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => handleUnassign(assignedWorker.operator_id)}
                                className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-white dark:bg-zinc-900 text-zinc-400 hover:text-red-500 opacity-0 group-hover/worker:opacity-100 transition-opacity border border-zinc-200 dark:border-zinc-700"
                                title="Unassign"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="h-full flex items-center justify-center border-2 border-dashed border-zinc-100 dark:border-zinc-800 text-[10px] font-mono text-zinc-400 uppercase tracking-widest py-6">
                              Drop Here
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
        </div>
      )}
    </div>
  );
}