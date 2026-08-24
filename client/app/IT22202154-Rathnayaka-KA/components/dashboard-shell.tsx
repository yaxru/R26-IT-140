"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { checkHealth } from "../lib/api";

export type DashboardSection = "overview" | "estimate" | "history" | "notes";

const navigation: Array<{ key: DashboardSection; label: string; href: string; number: string }> = [
  { key: "overview", label: "Overview", href: "/IT22202154-Rathnayaka-KA", number: "01" },
  { key: "estimate", label: "Batch estimate", href: "/IT22202154-Rathnayaka-KA/batch-estimate", number: "02" },
  { key: "history", label: "Prediction history", href: "/IT22202154-Rathnayaka-KA/prediction-history", number: "03" },
  { key: "notes", label: "Model notes", href: "/IT22202154-Rathnayaka-KA/model-notes", number: "04" },
];

export default function DashboardShell({ active, children }: { active: DashboardSection; children: ReactNode }) {
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");

  useEffect(() => {
    checkHealth().then(() => setApiStatus("online")).catch(() => setApiStatus("offline"));
  }, []);

  const apiLabel = useMemo(() => {
    if (apiStatus === "checking") return "Checking API";
    if (apiStatus === "online") return "API connected";
    return "API offline";
  }, [apiStatus]);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark" aria-hidden="true">GP</div>
          <div><p className="brand-name">Garment Production</p><p className="brand-subtitle">Intelligence console</p></div>
        </div>

        <nav className="sidebar-nav" aria-label="Dashboard navigation">
          {navigation.map((item) => (
            <a key={item.key} className={`nav-item ${active === item.key ? "active" : ""}`} href={item.href}>
              <span className="nav-icon">{item.number}</span>{item.label}
            </a>
          ))}
        </nav>

        <div className="sidebar-divider" />
        <section className="sidebar-model" aria-label="Model status">
          <p className="sidebar-label">Model status</p>
          <div className="model-status-row"><span className={`status-dot ${apiStatus}`} /><strong>{apiLabel}</strong></div>
          <div className="model-version"><span>Random Forest</span><strong>500 trees</strong></div>
          <p className="sidebar-copy">Batch-level productivity and delay estimation for supervisor decisions.</p>
        </section>

        <section className="sidebar-actions" aria-label="Workspace actions">
          <p className="sidebar-label">Workspace</p>
          <a className="action-button action-primary" href="/IT22202154-Rathnayaka-KA/batch-estimate"><span>New estimate</span><span aria-hidden="true">↗</span></a>
          <a className="action-button" href="/IT22202154-Rathnayaka-KA/prediction-history"><span>View history</span><span aria-hidden="true">→</span></a>
        </section>

        <div className="sidebar-footer"><span>R26-IT-140</span><span>IT22202154</span></div>
      </aside>

      <div className="content-shell">
        {children}
        <footer className="footer-note"><span>R26-IT-140 / PREDICTIVE PRODUCTION CONTROL</span><span>IT22202154 / Research backend connected</span></footer>
      </div>
    </main>
  );
}
