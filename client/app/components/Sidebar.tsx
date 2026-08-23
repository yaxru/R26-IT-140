"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

// ── Icons ─────────────────────────────────────────────────────────────────
function OverviewIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"><path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" /></svg>; }
function FloorMapIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18" /></svg>; }
function LiveMonitoringIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>; }
function ProductionLinesIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>; }
function WorkforceIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>; }
function StyleManagementIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"><circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /><path d="M4.93 4.93a10 10 0 0 0 0 14.14" /></svg>; }
function ReportsIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>; }
function InventoryIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>; }
function MaintenanceIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>; }
function SettingsIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>; }
function WorkerReallocationIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"><path d="M17 3l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 21l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>; }

// ── Nav data ──────────────────────────────────────────────────────────────
const NAV_SECTIONS = [
  {
    label: "Main Menu",
    items: [
      { label: "Overview", href: "/", icon: <OverviewIcon /> },
      { label: "Floor Map", href: "/floor-map", icon: <FloorMapIcon /> },
      { label: "Live Monitoring", href: "/live-monitoring", icon: <LiveMonitoringIcon /> },
      { label: "Production Lines", href: "/production-lines", icon: <ProductionLinesIcon /> },
    ],
  },
  {
    label: "Management",
    items: [
      { label: "Worker Reallocation", href: "/worker-reallocation", icon: <WorkerReallocationIcon /> },
      { label: "Workforce", href: "/workforce", icon: <WorkforceIcon /> },
      { label: "Style Management", href: "/style-management", icon: <StyleManagementIcon /> },
      { label: "Reports & Analytics", href: "/risk-analyze", icon: <ReportsIcon /> },
    ],
  },
  {
    label: "Support & System",
    items: [
      { label: "Inventory", href: "/inventory", icon: <InventoryIcon /> },
      { label: "Maintenance", href: "/maintenance", icon: <MaintenanceIcon /> },
      { label: "Settings", href: "/settings", icon: <SettingsIcon /> },
    ],
  },
];

// ── Component ─────────────────────────────────────────────────────────────
interface SidebarProps {
  collapsed: boolean;
}

export function Sidebar({ collapsed }: SidebarProps) {
  const pathname = usePathname();
  const [isHovered, setIsHovered] = useState(false);
  
  // Expanded if manually toggled open OR if hovered while collapsed
  const isExpanded = !collapsed || isHovered;

  return (
    <>
      {/* 
        SPACER: Transparent block taking up the strict layout width. 
        Animates smoothly between 56px (w-14) and 240px (w-60).
      */}
      <div 
        className={`shrink-0 transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          collapsed ? "w-14" : "w-60"
        }`} 
      />

      {/* ACTUAL SIDEBAR */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`fixed top-0 left-0 z-40 flex flex-col h-screen bg-[#111113] border-r border-zinc-800/60 overflow-hidden transition-[width,box-shadow] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          isExpanded ? "w-60" : "w-14"
        } ${collapsed && isHovered ? "shadow-[20px_0_40px_rgba(0,0,0,0.5)] border-r-zinc-700/60" : ""}`}
      >
        {/* Fixed Width Inner Container: Prevents text squishing during animation */}
        <div className="w-60 flex flex-col h-full">
          
          {/* Logo Area */}
          <div className="flex items-center h-14 border-b border-zinc-800/60 shrink-0 px-3">
            <div className="shrink-0 flex items-center justify-center w-8 h-8 bg-zinc-100 dark:bg-zinc-100 rounded-none">
              <span className="text-zinc-900 text-[12px] font-black tracking-tighter uppercase">OP</span>
            </div>
            
            <div className={`flex flex-col ml-3 transition-opacity duration-200 ${isExpanded ? "opacity-100 delay-100" : "opacity-0"}`}>
              <span className="text-sm font-bold text-zinc-100 tracking-widest uppercase">Opsis</span>
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mt-0.5">v1.0</span>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2 space-y-5">
            {NAV_SECTIONS.map((section) => (
              <div key={section.label}>
                <div className={`h-4 mb-2 transition-opacity duration-200 ${isExpanded ? "opacity-100 delay-100" : "opacity-0"}`}>
                  <p className="px-2 text-[10px] font-mono tracking-widest uppercase text-zinc-500">
                    {section.label}
                  </p>
                </div>
                <ul className="space-y-0.5">
                  {section.items.map((item) => {
                    const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          title={!isExpanded ? item.label : undefined}
                          className={`flex items-center px-2.5 py-2 text-sm transition-colors rounded-none ${
                            isActive
                              ? "bg-zinc-800 text-zinc-100"
                              : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                          }`}
                        >
                          <span className="shrink-0 flex items-center justify-center w-5">{item.icon}</span>
                          <span className={`transition-opacity duration-200 ml-3 ${isExpanded ? "opacity-100 delay-100" : "opacity-0"}`}>
                            {item.label}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

        </div>
      </aside>
    </>
  );
}