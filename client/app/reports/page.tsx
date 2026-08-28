"use client";

import { useMemo, useState } from "react";

type RiskLevel = "HIGH" | "MEDIUM" | "LOW";
type ReportRow = {
  employee: string;
  code: string;
  line: string;
  output: number;
  efficiency: number;
  risk: RiskLevel;
  trend: "up" | "down" | "steady";
  submissions: number;
};

const reportRows: ReportRow[] = [
  { employee: "Maya Perera", code: "EMP-104", line: "Line 04", output: 1468, efficiency: 94, risk: "LOW", trend: "up", submissions: 8 },
  { employee: "Nimal Silva", code: "EMP-118", line: "Line 02", output: 1252, efficiency: 81, risk: "MEDIUM", trend: "steady", submissions: 7 },
  { employee: "Asha Fernando", code: "EMP-091", line: "Line 01", output: 982, efficiency: 62, risk: "HIGH", trend: "down", submissions: 6 },
  { employee: "Ravi Kumar", code: "EMP-127", line: "Line 03", output: 1320, efficiency: 86, risk: "LOW", trend: "up", submissions: 8 },
  { employee: "Tharushi Jay", code: "EMP-113", line: "Line 02", output: 1088, efficiency: 71, risk: "MEDIUM", trend: "down", submissions: 5 },
  { employee: "Sahan Dias", code: "EMP-132", line: "Line 05", output: 1510, efficiency: 97, risk: "LOW", trend: "up", submissions: 8 },
  { employee: "Ishara Bandara", code: "EMP-087", line: "Line 01", output: 914, efficiency: 56, risk: "HIGH", trend: "down", submissions: 4 },
];

const outputByLine = [
  { label: "Line 01", value: 68, color: "bg-orange-500" },
  { label: "Line 02", value: 79, color: "bg-amber-400" },
  { label: "Line 03", value: 86, color: "bg-emerald-500" },
  { label: "Line 04", value: 94, color: "bg-teal-400" },
  { label: "Line 05", value: 89, color: "bg-sky-400" },
];

function SearchIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
}

function DownloadIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" /></svg>;
}

function RiskBadge({ level }: { level: RiskLevel }) {
  const styles = {
    HIGH: "bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:ring-orange-900/60",
    MEDIUM: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/60",
    LOW: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/60",
  };
  return <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-[9px] font-mono tracking-widest ring-1 ${styles[level]}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{level}</span>;
}

function Trend({ direction }: { direction: ReportRow["trend"] }) {
  const meta = { up: ["+8.4%", "text-emerald-500", "▲"], down: ["-6.1%", "text-orange-500", "▼"], steady: ["+0.3%", "text-zinc-400", "▬"] }[direction];
  return <span className={`font-mono text-[10px] ${meta[1]}`}><span className="mr-1">{meta[2]}</span>{meta[0]}</span>;
}

export default function ReportsPage() {
  const [query, setQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<"ALL" | RiskLevel>("ALL");
  const [period, setPeriod] = useState("Last 7 days");

  const filteredRows = useMemo(() => reportRows.filter((row) => {
    const matchesQuery = `${row.employee} ${row.code} ${row.line}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (riskFilter === "ALL" || row.risk === riskFilter);
  }), [query, riskFilter]);
  const averageEfficiency = filteredRows.length ? Math.round(filteredRows.reduce((sum, row) => sum + row.efficiency, 0) / filteredRows.length) : 0;
  const highRiskCount = filteredRows.filter((row) => row.risk === "HIGH").length;
  const totalOutput = filteredRows.reduce((sum, row) => sum + row.output, 0);

  return (
    <div className="min-h-full px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <div className="mx-auto max-w-[1440px] space-y-5">
        <header className="flex flex-col justify-between gap-4 border-b border-zinc-200 pb-5 dark:border-zinc-800/70 sm:flex-row sm:items-end">
          <div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">Reports & Analytics / Control room</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Production intelligence</h1><p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">A live view of output, efficiency, and operator risk across the floor.</p></div>
          <div className="flex items-center gap-2"><span className="flex items-center gap-2 px-2.5 py-2 font-mono text-[10px] text-zinc-500 dark:text-zinc-400"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />Updated 2 min ago</span><button type="button" title="Export report" className="flex items-center gap-2 border border-zinc-200 bg-white px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-zinc-600 transition-colors hover:border-emerald-400 hover:text-emerald-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"><DownloadIcon />Export</button></div>
  </header>
  <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[["Total output", `${totalOutput.toLocaleString()} pcs`, "+12.6% vs prior period", "text-zinc-900 dark:text-zinc-100"], ["Avg. efficiency", `${averageEfficiency}%`, "+4.8% vs prior period", "text-emerald-600 dark:text-emerald-400"], ["High risk operators", highRiskCount.toString().padStart(2, "0"), "Needs review today", "text-orange-600 dark:text-orange-400"], ["On-time completion", "94.2%", "+2.1% vs prior period", "text-sky-600 dark:text-sky-400"]].map(([label, value, detail, valueClass]) => <div key={label} className="border border-zinc-200 bg-white p-4 dark:border-zinc-800/70 dark:bg-[#111113]"><p className="font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-400">{label}</p><p className={`mt-2 font-mono text-2xl font-semibold ${valueClass}`}>{value}</p><p className="mt-1 text-[10px] text-zinc-500">{detail}</p></div>)}
        </section>
  <section className="grid gap-5 lg:grid-cols-[1.65fr_1fr]">
          <div className="border border-zinc-200 bg-white p-5 dark:border-zinc-800/70 dark:bg-[#111113]"><div className="mb-5 flex items-start justify-between gap-3"><div><p className="font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-400">Efficiency trend</p><h2 className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Floor average, last 12 shifts</h2></div><select aria-label="Chart period" value={period} onChange={(event) => setPeriod(event.target.value)} className="border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-[10px] text-zinc-600 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"><option>Last 7 days</option><option>Last 30 days</option><option>This quarter</option></select></div><div className="relative h-48"><div className="absolute inset-0 flex flex-col justify-between text-[9px] font-mono text-zinc-400"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div><svg viewBox="0 0 600 190" preserveAspectRatio="none" className="ml-8 h-full w-[calc(100%-2rem)] overflow-visible"><defs><linearGradient id="efficiency-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#10b981" stopOpacity=".24" /><stop offset="1" stopColor="#10b981" stopOpacity="0" /></linearGradient></defs><path d="M0 70 L55 61 L109 65 L164 48 L218 55 L273 35 L327 31 L382 40 L436 22 L491 28 L545 12 L600 20 V190 H0 Z" fill="url(#efficiency-fill)" /><path d="M0 70 L55 61 L109 65 L164 48 L218 55 L273 35 L327 31 L382 40 L436 22 L491 28 L545 12 L600 20" fill="none" stroke="#10b981" strokeWidth="3" vectorEffect="non-scaling-stroke" /><circle cx="545" cy="12" r="4" fill="#10b981" stroke="white" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg><div className="absolute bottom-[-20px] left-8 right-0 flex justify-between text-[9px] font-mono text-zinc-400"><span>06:00</span><span>09:00</span><span>12:00</span><span>15:00</span><span>18:00</span></div></div></div>
          <div className="border border-zinc-200 bg-white p-5 dark:border-zinc-800/70 dark:bg-[#111113]"><div className="mb-5"><p className="font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-400">Line performance</p><h2 className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Efficiency by production line</h2></div><div className="space-y-4">{outputByLine.map((line) => <div key={line.label}><div className="mb-1.5 flex justify-between text-[10px] font-mono"><span className="text-zinc-500 dark:text-zinc-400">{line.label}</span><span className="text-zinc-800 dark:text-zinc-200">{line.value}%</span></div><div className="h-2 bg-zinc-100 dark:bg-zinc-800"><div className={`h-full ${line.color}`} style={{ width: `${line.value}%` }} /></div></div>)}</div><div className="mt-6 flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800"><span className="text-[10px] text-zinc-500">Best performer</span><span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400">Line 04 · 94%</span></div></div>
        </section>
  <section className="border border-zinc-200 bg-white dark:border-zinc-800/70 dark:bg-[#111113]"><div className="flex flex-col gap-3 border-b border-zinc-200 p-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-400">Operator risk register</p><h2 className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Performance by operator <span className="ml-1 font-mono text-[10px] font-normal text-zinc-400">{filteredRows.length} shown</span></h2></div><div className="flex flex-col gap-2 sm:flex-row"><label className="flex h-8 items-center gap-2 border border-zinc-200 bg-zinc-50 px-2.5 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"><SearchIcon /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search operator, ID, line" className="w-full bg-transparent text-xs text-zinc-800 outline-none placeholder:text-zinc-400 dark:text-zinc-200 sm:w-48" /></label><select aria-label="Filter by risk level" value={riskFilter} onChange={(event) => setRiskFilter(event.target.value as "ALL" | RiskLevel)} className="h-8 border border-zinc-200 bg-zinc-50 px-2 text-[10px] font-mono uppercase text-zinc-600 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"><option value="ALL">All risk levels</option><option value="HIGH">High risk</option><option value="MEDIUM">Medium risk</option><option value="LOW">Low risk</option></select></div></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead><tr className="border-b border-zinc-100 dark:border-zinc-800/70">{["Operator", "Line", "Output", "Efficiency", "Trend", "Risk", "Logs"].map((heading) => <th key={heading} className="px-4 py-3 font-mono text-[9px] uppercase tracking-[0.15em] text-zinc-400">{heading}</th>)}</tr></thead><tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">{filteredRows.map((row) => <tr key={row.code} className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/60"><td className="px-4 py-3"><div className="text-xs font-medium text-zinc-800 dark:text-zinc-200">{row.employee}</div><div className="mt-0.5 font-mono text-[9px] text-zinc-400">{row.code}</div></td><td className="px-4 py-3 font-mono text-[10px] text-zinc-500">{row.line}</td><td className="px-4 py-3 font-mono text-xs text-zinc-700 dark:text-zinc-300">{row.output.toLocaleString()}</td><td className="px-4 py-3"><span className={`font-mono text-xs font-semibold ${row.efficiency < 70 ? "text-orange-600 dark:text-orange-400" : "text-zinc-800 dark:text-zinc-200"}`}>{row.efficiency}%</span></td><td className="px-4 py-3"><Trend direction={row.trend} /></td><td className="px-4 py-3"><RiskBadge level={row.risk} /></td><td className="px-4 py-3 font-mono text-[10px] text-zinc-500">{row.submissions} entries</td></tr>)}{filteredRows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-xs text-zinc-500">No operators match these filters.</td></tr>}</tbody></table></div></section>
        <div className="flex items-center justify-between pb-2 font-mono text-[9px] uppercase tracking-wider text-zinc-400"><span>Data window: {period}</span><span>Source: production reporting service</span></div>
      </div>
    </div>
  );
}
