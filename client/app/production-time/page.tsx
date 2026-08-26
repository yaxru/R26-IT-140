"use client";

import { useEffect, useState } from "react";
import DashboardShell from "./components/dashboard-shell";
import { fetchPredictionHistory } from "./lib/api";
import type { PredictionHistoryItem } from "./lib/api";

function formatRunDate(value: string) { return new Date(value).toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }); }

export default function OverviewPage() {
  const [history, setHistory] = useState<PredictionHistoryItem[]>([]);

  useEffect(() => { fetchPredictionHistory(5).then(setHistory).catch(() => setHistory([])); }, []);

  const latest = history[0];
  return <DashboardShell active="overview">
    <header className="content-header" id="overview"><div><p className="section-kicker">Research / Predictive production control</p><h1>Production overview</h1><p className="content-lede">A concise view of the latest model signal, stored evidence and next supervisor action.</p></div><a className="primary-button header-action" href="/IT22202154-Rathnayaka-KA/batch-estimate"><span>Run new estimate</span><span aria-hidden="true">↗</span></a></header>

    <section className="stat-strip" aria-label="Workspace summary">
      <div className="stat-card"><span className="stat-label">Model</span><strong>RF / 500</strong><small>trained trees</small></div>
      <div className="stat-card"><span className="stat-label">Input signals</span><strong>08</strong><small>batch fields</small></div>
      <div className="stat-card"><span className="stat-label">Stored runs</span><strong>{history.length}</strong><small>latest loaded</small></div>
      <div className="stat-card stat-card-highlight"><span className="stat-label">Latest productivity</span><strong>{latest ? `${(latest.predicted_productivity * 100).toFixed(1)}%` : "—"}</strong><small>{latest ? formatRunDate(latest.created_at) : "no run yet"}</small></div>
    </section>

    <section className="overview-grid">
      <article className="overview-card overview-hero"><span className="step-pill">SUPERVISOR SUMMARY</span><h2>{latest ? "The latest floor signal is ready for review." : "Start with the first floor signal."}</h2><p>{latest ? `Team ${latest.team} / ${latest.department} returned a ${latest.efficiency_level.toLowerCase()} efficiency signal with ${latest.delay_prediction.toLowerCase()}.` : "Run a batch estimate to see productivity, delay outlook and expected completion time."}</p><a className="text-button" href={latest ? "/prediction-history" : "/batch-estimate"}>{latest ? "Review stored history" : "Open batch estimate"} <span aria-hidden="true">↗</span></a></article>
      <article className="overview-card"><span className="step-pill">CURRENT SIGNAL</span>{latest ? <><strong className="overview-score">{(latest.predicted_productivity * 100).toFixed(1)}<small>%</small></strong><p className="overview-muted">Predicted productivity</p><div className="progress-track"><div className="progress-fill" style={{ width: `${Math.min(latest.predicted_productivity * 100, 100)}%` }} /></div><div className="overview-pairs"><span>Delay outlook<strong>{latest.delay_prediction}</strong></span><span>Completion<strong>{latest.estimated_time_hours.toFixed(2)} h</strong></span></div></> : <div className="overview-empty">No prediction is stored yet.</div>}</article>
    </section>

    <section className="recent-section"><div className="history-heading"><div><span className="step-pill">RECENT ACTIVITY</span><h2>Latest model runs</h2></div><a className="text-button" href="/IT22202154-Rathnayaka-KA/prediction-history">View all <span aria-hidden="true">→</span></a></div>{history.length ? <div className="recent-list">{history.map((item) => <a className="recent-row" href="/IT22202154-Rathnayaka-KA/prediction-history" key={item.id}><span className="recent-id">#{item.id}</span><span><strong>{item.department} / Team {item.team}</strong><small>{formatRunDate(item.created_at)} · {item.batch_qty.toLocaleString()} units</small></span><strong className="recent-productivity">{(item.predicted_productivity * 100).toFixed(1)}%</strong><span className="history-status">{item.efficiency_level}</span></a>)}</div> : <div className="history-message">No prediction history available yet.</div>}</section>
  </DashboardShell>;
}
