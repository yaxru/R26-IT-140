"use client";

import { useEffect, useState, DragEvent } from "react";
import { createClient } from "@/lib/supabase/client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Station {
  station_id: string;
  required_skill: string;
  sequence_order: number;
}

interface Worker {
  operator_id: string;
  operator_name: string;
  worker_id: string;
  station_id: string | null; // null means they are in the unassigned pool
  primary_skill: string;
  proficiency_grade: string;
}

export default function WorkerAssignmentPage() {
  const supabase = createClient();
  const [lineId, setLineId] = useState("Line-A");
  const [stations, setStations] = useState<Station[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // HTML5 Drag and Drop state
  const [draggedWorkerId, setDraggedWorkerId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineId]);

  const fetchData = async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      // 1. Fetch Stations for the selected line
      const { data: stationData, error: stationError } = await supabase
        .from("production_status")
        .select("station_id, required_skill, sequence_order")
        .eq("line_id", lineId)
        .order("sequence_order", { ascending: true });

      if (stationError) throw stationError;
      setStations(stationData || []);

      // 2. Fetch Workers using the new SQL View
      const { data: workerData, error: workerError } = await supabase
        .from("vw_line_assignments")
        .select("*")
        .eq("line_id", lineId);

      if (workerError) throw workerError;
      setWorkers(workerData || []);
    } catch (e) {
      console.error(e);
      setMessage({ text: "Failed to load floor data.", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  // --- Drag and Drop Handlers ---
  const handleDragStart = (e: DragEvent<HTMLDivElement>, operatorId: string) => {
    setDraggedWorkerId(operatorId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // Required to allow dropping
    e.dataTransfer.dropEffect = "move";
  };

  const handleDropToStation = (e: DragEvent<HTMLDivElement>, targetStationId: string) => {
    e.preventDefault();
    if (!draggedWorkerId) return;

    // Check if station already has a worker (optional: auto-swap or block)
    const existingWorker = workers.find((w) => w.station_id === targetStationId);

    setWorkers((prev) =>
      prev.map((w) => {
        // Move the dragged worker to the new station
        if (w.operator_id === draggedWorkerId) return { ...w, station_id: targetStationId };
        // If someone was already there, kick them back to the pool
        if (existingWorker && w.operator_id === existingWorker.operator_id) return { ...w, station_id: null };
        return w;
      })
    );
    setDraggedWorkerId(null);
  };

  const handleDropToPool = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!draggedWorkerId) return;

    setWorkers((prev) =>
      prev.map((w) =>
        w.operator_id === draggedWorkerId ? { ...w, station_id: null } : w
      )
    );
    setDraggedWorkerId(null);
  };

  const handleUnassign = (operatorId: string) => {
    setWorkers((prev) =>
      prev.map((w) => (w.operator_id === operatorId ? { ...w, station_id: null } : w))
    );
  };

  // --- Save Handler ---
  const handleSaveAssignments = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }
        : { "Content-Type": "application/json" };

      const payload = {
        line_id: lineId,
        assignments: workers.map((w) => ({
          operator_id: w.operator_id,
          station_id: w.station_id,
        })),
      };

      const res = await fetch(`${API_BASE}/assign-workers`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save assignments.");

      setMessage({ text: "Assignments locked in successfully.", type: "success" });
    } catch (e) {
      setMessage({ text: "Failed to save assignments.", type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  // --- Derived State ---
  const unassignedWorkers = workers.filter((w) => w.station_id === null);

  // Group unassigned workers by skill for the talent pool
  const poolBySkill = unassignedWorkers.reduce((acc, worker) => {
    if (!acc[worker.primary_skill]) acc[worker.primary_skill] = [];
    acc[worker.primary_skill].push(worker);
    return acc;
  }, {} as Record<string, Worker[]>);

  // Render a worker card
  const WorkerCard = ({ worker }: { worker: Worker }) => (
    <div
      draggable
      onDragStart={(e) => handleDragStart(e, worker.operator_id)}
      className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-3 cursor-grab active:cursor-grabbing hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{worker.operator_name}</span>
        <span className="text-[10px] font-mono text-zinc-500">{worker.worker_id}</span>
      </div>
      <div className="flex gap-2">
        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-[10px] font-mono uppercase">
          {worker.primary_skill}
        </span>
        <span className="px-2 py-0.5 bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300 text-[10px] font-mono font-bold">
          Grade {worker.proficiency_grade}
        </span>
      </div>
    </div>
  );

  return (
    <div className="px-6 py-6 h-full flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between shrink-0">
        <div>
          <p className="text-[10px] font-mono tracking-widest text-zinc-400 dark:text-zinc-500 uppercase">
            Workforce Routing
          </p>
          <h1 className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Station Assignments
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={lineId}
            onChange={(e) => setLineId(e.target.value)}
            className="bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800 text-sm font-bold px-4 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none rounded-none"
          >
            <option value="Line-A">Line-A</option>
            <option value="Line-B">Line-B</option>
            <option value="Line-C">Line-C</option>
          </select>
          <button
            onClick={handleSaveAssignments}
            disabled={isSaving}
            className="px-6 py-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-bold uppercase tracking-widest rounded-none transition-colors disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Lock Assignments"}
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-3 text-xs font-mono uppercase tracking-wider border rounded-none ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          {message.text}
        </div>
      )}

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-xs font-mono text-zinc-500 uppercase tracking-widest animate-pulse">
          Loading Floor Data...
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
          
          {/* Left Column: Talent Pool */}
          <div 
            className="lg:col-span-1 bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800/60 flex flex-col"
            onDragOver={handleDragOver}
            onDrop={handleDropToPool}
          >
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800/60 shrink-0 bg-zinc-50 dark:bg-zinc-900/30">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                Unassigned Pool
              </h2>
              <p className="text-[10px] font-mono text-zinc-500 mt-1">Drag workers to stations</p>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1 space-y-6">
              {Object.keys(poolBySkill).length === 0 ? (
                <div className="text-center py-10 text-[10px] font-mono text-zinc-400 uppercase">Pool is empty</div>
              ) : (
                Object.entries(poolBySkill).map(([skill, skillWorkers]) => (
                  <div key={skill}>
                    <h3 className="text-[10px] font-mono font-bold text-zinc-400 uppercase border-b border-zinc-200 dark:border-zinc-800 pb-1 mb-3">
                      {skill} ({skillWorkers.length})
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
          <div className="lg:col-span-2 bg-zinc-50 dark:bg-zinc-900/10 border border-zinc-200 dark:border-zinc-800/60 p-6 overflow-y-auto">
            {stations.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-sm font-mono text-zinc-500">No stations configured for {lineId}.</p>
                <p className="text-[10px] text-zinc-400 mt-2">Use the Line Setup tool to map the floor first.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {stations.map((station) => {
                  const assignedWorker = workers.find((w) => w.station_id === station.station_id);
                  
                  return (
                    <div 
                      key={station.station_id}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDropToStation(e, station.station_id)}
                      className={`border-2 p-4 flex flex-col min-h-[120px] transition-colors ${
                        draggedWorkerId ? 'border-dashed border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#111113]' : 'border-solid border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111113]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{station.station_id}</span>
                        <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-[9px] font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                          {station.required_skill}
                        </span>
                      </div>
                      
                      <div className="flex-1 flex flex-col justify-center">
                        {assignedWorker ? (
                          <div className="relative group bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 p-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100">{assignedWorker.operator_name}</p>
                                <p className="text-[10px] font-mono text-emerald-700 dark:text-emerald-500 mt-1">Grade {assignedWorker.proficiency_grade}</p>
                              </div>
                              {assignedWorker.primary_skill !== station.required_skill && (
                                <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 font-bold" title="Skill Mismatch!">⚠️</span>
                              )}
                            </div>
                            <button
                              onClick={() => handleUnassign(assignedWorker.operator_id)}
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 transition-opacity"
                              title="Unassign"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="h-full flex items-center justify-center border-2 border-dashed border-zinc-100 dark:border-zinc-800 text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
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
      )}
    </div>
  );
}