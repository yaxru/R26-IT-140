"use client";

import { useEffect, useState } from "react";
import { fetchPredictionHistory } from "../lib/api";
import type { PredictionHistoryItem } from "../lib/api";

function formatRunDate(value: string) { return new Date(value).toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }); }
function formatHours(value: number) { return `${value.toFixed(2)} h`; }
function statusClass(value: string) { return value.toLowerCase().replace(/\s+/g, "-"); }

export default function PredictionHistoryPanel() {
  const [history, setHistory] = useState<PredictionHistoryItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try { setHistory(await fetchPredictionHistory(50)); setError(""); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Prediction history is unavailable."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, []);

  return (
    <>
      <header className="content-header"><div><p className="section-kicker">Research / Stored evidence</p><h1>Prediction history</h1><p className="content-lede">Review the input profile and model outcome for every saved production estimate.</p></div><button className="refresh-button" type="button" onClick={() => void refresh()} disabled={loading}>{loading ? "Refreshing…" : "Refresh history"}</button></header>
      <section className="history-section history-page-card">
        <div className="history-heading"><div><span className="step-pill">POSTGRESQL / PREDICTION_RUNS</span><h2>Recent prediction runs</h2><p>Stored batch estimates ordered from newest to oldest.</p></div><span className="history-count">{history.length} runs loaded</span></div>
        {error ? <div className="history-message history-error"><strong>History is not available yet.</strong><span>{error}</span></div> : loading && history.length === 0 ? <div className="history-message">Loading stored predictions…</div> : history.length === 0 ? <div className="history-message">No saved predictions yet. Run an estimate first.</div> : <div className="history-table-wrap"><table className="history-table"><thead><tr><th>Run time</th><th>Batch</th><th>Team</th><th>Productivity</th><th>Efficiency</th><th>Delay outlook</th><th>Completion</th></tr></thead><tbody>{history.map((item) => <tr key={item.id}><td><strong>{formatRunDate(item.created_at)}</strong><span>{item.department}</span></td><td>{item.batch_qty.toLocaleString()} units</td><td>Team {item.team}</td><td><span className="history-score">{(item.predicted_productivity * 100).toFixed(1)}%</span></td><td><span className={`history-status ${statusClass(item.efficiency_level)}`}>{item.efficiency_level}</span></td><td>{item.delay_prediction}</td><td>{formatHours(item.estimated_time_hours)}</td></tr>)}</tbody></table></div>}
      </section>
    </>
  );
}
