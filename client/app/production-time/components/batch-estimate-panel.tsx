"use client";

import type { CSSProperties, FormEvent } from "react";
import { useState } from "react";
import Link from "next/link";
import { predictBatch } from "../lib/api";
import type { PredictionRequest, PredictionResponse } from "../lib/api";

type FormState = {
  department: string;
  team: string;
  batch_qty: string;
  date: string;
  no_of_workers: string;
  over_time: string;
  smv: string;
  machine_breakdown_minutes: string;
};

const baseline: FormState = {
  department: "sewing",
  team: "8",
  batch_qty: "1000",
  date: new Date().toISOString().slice(0, 10),
  no_of_workers: "59",
  over_time: "7080",
  smv: "26.16",
  machine_breakdown_minutes: "0",
};

function formatHours(hours: number) { return `${hours.toFixed(2)} h`; }

function recommendation(delay: string) {
  if (delay.toLowerCase().includes("on-time")) return "The shift profile is currently on track. Maintain staffing and monitor the next checkpoint.";
  if (delay.toLowerCase().includes("high") || delay.toLowerCase().includes("delayed")) return "Review staffing and machine availability before releasing the batch. The model sees elevated delay risk.";
  return "Keep an eye on the line during the next checkpoint. The model sees a manageable delay risk.";
}

function toPayload(source: FormState): PredictionRequest {
  return { department: source.department, team: Number(source.team), batch_qty: Number(source.batch_qty), date: source.date, no_of_workers: Number(source.no_of_workers), over_time: Number(source.over_time), smv: Number(source.smv), machine_breakdown_minutes: Number(source.machine_breakdown_minutes) };
}

function validate(source: FormState) {
  const checks: Array<[string, string, number]> = [["team number", source.team, 0], ["batch quantity", source.batch_qty, 0], ["workers on line", source.no_of_workers, 0], ["overtime", source.over_time, -1], ["SMV", source.smv, 0], ["machine breakdown", source.machine_breakdown_minutes, -1]];
  for (const [label, raw, minimum] of checks) {
    const value = Number(raw);
    if (!raw.trim() || !Number.isFinite(value) || value <= minimum) return `Enter a valid ${label} before running the estimate.`;
  }
  if (!source.date) return "Select a production date before running the estimate.";
  return "";
}

const inputClass = "w-full px-3 py-2 text-sm bg-[#F8F8F8] dark:bg-zinc-800/60 border border-[#EAEAEA] dark:border-zinc-700 text-[#242424] dark:text-zinc-100 placeholder-[#9A9A9A] focus:outline-none focus:border-[#1A7C4B] dark:focus:border-[#47966F] transition-colors font-mono";
const labelClass = "text-[10px] font-bold uppercase tracking-widest text-[#5F5F5F] dark:text-zinc-400 mb-1.5 block";

export default function BatchEstimatePanel() {
  const [form, setForm] = useState<FormState>(baseline);
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  function updateField(field: keyof FormState, value: string) { setForm((current) => ({ ...current, [field]: value })); }

  async function run(source: FormState) {
    const message = validate(source);
    if (message) { setError(message); return; }
    setError(""); setIsLoading(true);
    try {
      const response = await predictBatch(toPayload(source));
      setResult(response);
      setLastRunAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to reach the prediction service.");
    } finally { setIsLoading(false); }
  }

  function reset() { setForm(baseline); setResult(null); setLastRunAt(null); setError(""); }

  return (
    <main className="min-h-screen bg-[#F8F8F8] dark:bg-[#030C08] flex flex-col text-[#242424] dark:text-zinc-200">

      {/* ── Header ── */}
      <section className="bg-white dark:bg-[#111113] border-b border-[#EAEAEA] dark:border-zinc-800 px-6 lg:px-8 py-6 flex items-start justify-between gap-4 shrink-0">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-widest text-[#9A9A9A] dark:text-zinc-500 mb-1">
            Research / Batch Estimate
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#242424] dark:text-zinc-100">Run a Production Estimate</h1>
          <p className="text-xs text-[#5F5F5F] dark:text-zinc-400 mt-1.5 leading-relaxed">
            Capture the current line conditions, then send one clear request to the trained model.
          </p>
        </div>
        <Link href="/production-time" className="text-[10px] font-mono text-[#9A9A9A] hover:text-[#242424] dark:hover:text-zinc-200 uppercase tracking-widest shrink-0 mt-1">
          ← Overview
        </Link>
      </section>

      {/* ── Two-panel layout ── */}
      <div className="flex-1 flex flex-col lg:flex-row">

        {/* Left — Inputs */}
        <form
          className="lg:w-1/2 bg-white dark:bg-[#111113] border-b lg:border-b-0 lg:border-r border-[#EAEAEA] dark:border-zinc-800 flex flex-col"
          onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void run(form); }}
        >
          <div className="px-6 py-4 border-b border-[#EAEAEA] dark:border-zinc-800 bg-[#F8F8F8] dark:bg-zinc-900/40 flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#5F5F5F] dark:text-zinc-400">01 / Inputs · Describe the current batch</div>
            <span className="text-[9px] font-mono text-[#9A9A9A] uppercase tracking-widest">All fields required</span>
          </div>

          <div className="p-6 lg:p-8 space-y-6 flex-1">
            {/* Batch context */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#9A9A9A] dark:text-zinc-500 mb-3 pb-2 border-b border-[#EAEAEA] dark:border-zinc-800">
                Batch context
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Department</label>
                  <select value={form.department} onChange={(e) => updateField("department", e.target.value)} className={inputClass}>
                    <option value="sewing">Sewing</option>
                    <option value="finishing">Finishing</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Team number</label>
                  <input type="number" min="1" step="1" value={form.team} onChange={(e) => updateField("team", e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Batch quantity</label>
                  <input type="number" min="1" step="1" value={form.batch_qty} onChange={(e) => updateField("batch_qty", e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Production date</label>
                  <input type="date" value={form.date} onChange={(e) => updateField("date", e.target.value)} className={inputClass} />
                </div>
              </div>
            </div>

            {/* Line conditions */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#9A9A9A] dark:text-zinc-500 mb-3 pb-2 border-b border-[#EAEAEA] dark:border-zinc-800">
                Line conditions
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Workers on line</label>
                  <input type="number" min="1" step="0.5" value={form.no_of_workers} onChange={(e) => updateField("no_of_workers", e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Overtime (minutes)</label>
                  <input type="number" min="0" step="1" value={form.over_time} onChange={(e) => updateField("over_time", e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>SMV / standard minutes</label>
                  <input type="number" min="0.01" step="0.01" value={form.smv} onChange={(e) => updateField("smv", e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Machine breakdown (min)</label>
                  <input type="number" min="0" step="1" value={form.machine_breakdown_minutes} onChange={(e) => updateField("machine_breakdown_minutes", e.target.value)} className={inputClass} />
                </div>
              </div>
            </div>

            {error && (
              <div className="px-4 py-3 bg-[#FDFBF8] dark:bg-amber-950/20 border border-[#CE8E33]/50 text-[#A77329] dark:text-[#D7A45A] text-xs font-mono">
                {error}
              </div>
            )}
          </div>

          <div className="px-6 lg:px-8 py-5 border-t border-[#EAEAEA] dark:border-zinc-800 flex items-center justify-between gap-4 bg-[#F8F8F8] dark:bg-zinc-900/20 shrink-0">
            <p className="text-[10px] font-mono text-[#9A9A9A] dark:text-zinc-500">Values are sent to the local research API on port 8002.</p>
            <div className="flex items-center gap-3">
              <button type="button" onClick={reset} disabled={isLoading} className="px-4 py-2 text-[11px] font-bold font-mono uppercase tracking-widest border border-[#EAEAEA] dark:border-zinc-700 text-[#5F5F5F] dark:text-zinc-400 hover:bg-[#EAEAEA] dark:hover:bg-zinc-800 transition-colors disabled:opacity-40">
                Reset
              </button>
              <button type="submit" disabled={isLoading} className="px-5 py-2 text-[11px] font-bold font-mono uppercase tracking-widest bg-[#1A7C4B] hover:bg-[#15633C] border border-[#15633C] text-white disabled:opacity-50 transition-colors">
                {isLoading ? "Running model…" : "Run estimate ↗"}
              </button>
            </div>
          </div>
        </form>

        {/* Right — Results */}
        <section className="lg:w-1/2 bg-white dark:bg-[#111113] flex flex-col" aria-live="polite">
          <div className="px-6 py-4 border-b border-[#EAEAEA] dark:border-zinc-800 bg-[#F8F8F8] dark:bg-zinc-900/40 flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#5F5F5F] dark:text-zinc-400">02 / Output · Decision-ready result</div>
            {result && (
              <div className="flex items-center gap-3">
                <span className="text-[9px] font-mono text-[#9A9A9A] uppercase tracking-widest">Updated {lastRunAt}</span>
                <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 ${result.history_saved ? "bg-[#E6F1EC] text-[#1A7C4B] dark:bg-[#0A321E] dark:text-[#47966F]" : "bg-[#F1F1F1] text-[#9A9A9A] dark:bg-zinc-800"}`}>
                  {result.history_saved ? "Saved to Supabase" : "Not saved"}
                </span>
              </div>
            )}
          </div>

          {result ? (
            <div className="p-6 lg:p-8 flex flex-col gap-6 flex-1">
              {/* Productivity score */}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#9A9A9A] dark:text-zinc-500 mb-2">Predicted productivity</p>
                <p className="font-mono text-5xl font-bold text-[#242424] dark:text-zinc-100 leading-none">
                  {(result.predicted_productivity * 100).toFixed(1)}<span className="text-xl font-normal text-[#9A9A9A] ml-1">%</span>
                </p>
                <div className="mt-4 h-2 bg-[#EAEAEA] dark:bg-zinc-800">
                  <div className="h-2 bg-[#1A7C4B] transition-all duration-700" style={{ width: `${Math.min(result.predicted_productivity * 100, 100)}%` }} />
                </div>
              </div>

              {/* Badges */}
              <div className="grid grid-cols-2 gap-4">
                <div className={`p-4 border ${result.efficiency_level === "High" ? "bg-[#E6F1EC] border-[#1A7C4B]/20 dark:bg-[#0A321E] dark:border-[#1A7C4B]/20" : "bg-[#FDFBF8] border-[#CE8E33]/20 dark:bg-amber-950/20 dark:border-[#CE8E33]/20"}`}>
                  <p className="text-[9px] uppercase tracking-widest text-[#9A9A9A] dark:text-zinc-500 mb-1">Efficiency level</p>
                  <p className={`font-bold text-sm ${result.efficiency_level === "High" ? "text-[#1A7C4B] dark:text-[#47966F]" : "text-[#CE8E33] dark:text-[#D7A45A]"}`}>{result.efficiency_level}</p>
                </div>
                <div className="p-4 border border-[#EAEAEA] dark:border-zinc-700 bg-[#F8F8F8] dark:bg-zinc-800/40">
                  <p className="text-[9px] uppercase tracking-widest text-[#9A9A9A] dark:text-zinc-500 mb-1">Delay outlook</p>
                  <p className="font-bold text-sm text-[#242424] dark:text-zinc-100">{result.delay_prediction}</p>
                </div>
              </div>

              {/* Time details */}
              <div className="grid grid-cols-3 gap-4 border-t border-[#EAEAEA] dark:border-zinc-800 pt-4">
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-[#9A9A9A] dark:text-zinc-500 mb-1">Estimated completion</p>
                  <p className="font-mono font-bold text-base text-[#242424] dark:text-zinc-100">{formatHours(result.estimated_time_hours)}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-[#9A9A9A] dark:text-zinc-500 mb-1">Base run time</p>
                  <p className="font-mono font-bold text-base text-[#242424] dark:text-zinc-100">{formatHours(result.base_time_hours)}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-[#9A9A9A] dark:text-zinc-500 mb-1">Breakdown added</p>
                  <p className="font-mono font-bold text-base text-[#242424] dark:text-zinc-100">{result.machine_breakdown_minutes.toFixed(0)} min</p>
                </div>
              </div>

              {/* Supervisor note */}
              <div className="border-l-2 border-[#1A7C4B] pl-4 py-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A7C4B] dark:text-[#47966F] mb-1">✦ Supervisor Note</p>
                <p className="text-xs text-[#5F5F5F] dark:text-zinc-400 leading-relaxed">{recommendation(result.delay_prediction)}</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
              <div className="w-12 h-12 border-2 border-[#EAEAEA] dark:border-zinc-700 flex items-center justify-center">
                <span className="text-[#9A9A9A] font-mono text-lg">—</span>
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#242424] dark:text-zinc-100 mb-1">No estimate yet</h3>
                <p className="text-xs text-[#9A9A9A] dark:text-zinc-500">Submit the batch inputs to populate the productivity and completion outlook.</p>
              </div>
              <button type="button" onClick={() => void run(baseline)} disabled={isLoading}
                className="text-[11px] font-bold text-[#1A7C4B] dark:text-[#47966F] hover:underline">
                Run the baseline profile ↗
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
