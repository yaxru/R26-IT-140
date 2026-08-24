"use client";

import type { CSSProperties, FormEvent } from "react";
import { useState } from "react";
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
function efficiencyClass(value: string) { return value.toLowerCase().replace(/\s+/g, "-"); }

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
    <>
      <header className="content-header">
        <div><p className="section-kicker">Research / Batch estimate</p><h1>Run a production estimate</h1><p className="content-lede">Capture the current line conditions, then send one clear request to the trained model.</p></div>
      </header>

      <section className="workspace-grid">
        <form className="input-card" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void run(form); }}>
          <div className="section-header"><div><span className="step-pill">01 / INPUTS</span><h2>Describe the current batch</h2><p>Use the latest shift conditions for a practical estimate.</p></div><span className="required-note">Required fields</span></div>
          <div className="form-section-title">Batch context</div>
          <div className="form-grid">
            <label><span>Department</span><select value={form.department} onChange={(event) => updateField("department", event.target.value)}><option value="sewing">Sewing</option><option value="finishing">Finishing</option></select></label>
            <label><span>Team number</span><input type="number" min="1" step="1" value={form.team} onChange={(event) => updateField("team", event.target.value)} /></label>
            <label><span>Batch quantity</span><input type="number" min="1" step="1" value={form.batch_qty} onChange={(event) => updateField("batch_qty", event.target.value)} /></label>
            <label><span>Production date</span><input type="date" value={form.date} onChange={(event) => updateField("date", event.target.value)} /></label>
          </div>
          <div className="form-section-title">Line conditions</div>
          <div className="form-grid">
            <label><span>Workers on line</span><input type="number" min="1" step="0.5" value={form.no_of_workers} onChange={(event) => updateField("no_of_workers", event.target.value)} /></label>
            <label><span>Overtime (minutes)</span><input type="number" min="0" step="1" value={form.over_time} onChange={(event) => updateField("over_time", event.target.value)} /></label>
            <label><span>SMV / standard minutes</span><input type="number" min="0.01" step="0.01" value={form.smv} onChange={(event) => updateField("smv", event.target.value)} /></label>
            <label><span>Machine breakdown (minutes)</span><input type="number" min="0" step="1" value={form.machine_breakdown_minutes} onChange={(event) => updateField("machine_breakdown_minutes", event.target.value)} /></label>
          </div>
          {error ? <p className="error-banner" role="alert">{error}</p> : null}
          <div className="form-footer"><p><span className="form-footer-dot" /> Values are sent to the local research API.</p><div className="form-actions"><button className="secondary-button" type="button" onClick={reset} disabled={isLoading}>Reset</button><button className="primary-button" type="submit" disabled={isLoading}><span>{isLoading ? "Running model…" : "Run production estimate"}</span><span aria-hidden="true">↗</span></button></div></div>
        </form>

        <section className="results-card" aria-live="polite">
          <div className="section-header result-header"><div><span className="step-pill">02 / OUTPUT</span><h2>Decision-ready output</h2><p>Model result for the current shift profile.</p></div>{result ? <div className="result-meta"><span className="result-tag">Updated {lastRunAt}</span><span className={`storage-tag ${result.history_saved ? "saved" : "unsaved"}`}>{result.history_saved ? "Saved to PostgreSQL" : "Not saved"}</span></div> : null}</div>
          {result ? <div className="result-content">
            <div className="score-row"><div><span className="result-label">Predicted productivity</span><strong className="score-value">{(result.predicted_productivity * 100).toFixed(1)}<small>%</small></strong></div><div className="score-ring" style={{ "--score": `${Math.min(result.predicted_productivity * 100, 100)}%` } as CSSProperties}><span>{Math.round(result.predicted_productivity * 100)}</span></div></div>
            <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.min(result.predicted_productivity * 100, 100)}%` }} /></div>
            <div className="result-badges"><div className={`result-badge ${efficiencyClass(result.efficiency_level)}`}><span>Efficiency level</span><strong>{result.efficiency_level}</strong></div><div className="result-badge delay"><span>Delay outlook</span><strong>{result.delay_prediction}</strong></div></div>
            <div className="time-result"><div><span>Estimated completion</span><strong>{formatHours(result.estimated_time_hours)}</strong></div><div><span>Base run time</span><strong>{formatHours(result.base_time_hours)}</strong></div><div><span>Breakdown added</span><strong>{result.machine_breakdown_minutes.toFixed(0)} min</strong></div></div>
            <div className="decision-note"><span className="decision-icon">✦</span><div><span className="result-label">Supervisor note</span><p>{recommendation(result.delay_prediction)}</p></div></div>
          </div> : <div className="empty-result"><div className="empty-orbit" aria-hidden="true"><span /><span /><span /></div><h3>No estimate yet</h3><p>Submit the batch inputs to populate the productivity and completion outlook.</p><button className="text-button" type="button" onClick={() => void run(baseline)} disabled={isLoading}>Run the baseline profile <span aria-hidden="true">↗</span></button></div>}
        </section>
      </section>
    </>
  );
}
