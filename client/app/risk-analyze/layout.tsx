import "./risk-analyze.css";

// This module (Employee + Floor Manager / Supervisor login and dashboards
// for Real-Time Risk Detection) has its own theme and its own auth system
// (JWT issued by services/risk_analyze — see lib/risk-analyze/session.ts),
// deliberately separate from the rest of the StitchFlow dashboard's
// Supabase-authenticated pages. See services/risk_analyze/README.md.
export default function RiskAnalyzeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="risk-analyze-scope">{children}</div>;
}
