"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { 
  LayoutDashboard, 
  Map, 
  Activity, 
  Layers, 
  ArrowRightLeft, 
  Users, 
  Shirt, 
  LineChart, 
  Package, 
  Wrench, 
  Settings 
} from "lucide-react";

// Helper for industrial icon styling
const iconProps = {
  size: 16,
  strokeWidth: 2,
  strokeLinecap: "square" as const,
  strokeLinejoin: "miter" as const,
};

const NAV_SECTIONS = [
  {
    label: "Main Menu",
    items: [
      { label: "Overview", href: "/", icon: <LayoutDashboard {...iconProps} /> },
      { label: "Floor Map", href: "/floor-map", icon: <Map {...iconProps} /> },
      { label: "Live Monitoring", href: "/live-monitoring", icon: <Activity {...iconProps} /> },
      { label: "Production Lines", href: "/production-lines", icon: <Layers {...iconProps} /> },
    ],
  },
  {
    label: "Management",
    items: [
      { label: "Worker Reallocation", href: "/worker-reallocation", icon: <ArrowRightLeft {...iconProps} /> },
      { label: "Workforce", href: "/workforce", icon: <Users {...iconProps} /> },
      { label: "Style Management", href: "/style-management", icon: <Shirt {...iconProps} /> },
      { label: "Reports & Analytics", href: "/risk-analyze", icon: <LineChart {...iconProps} /> },
    ],
  },
  {
    label: "Support & System",
    items: [
      { label: "Inventory", href: "/inventory", icon: <Package {...iconProps} /> },
      { label: "Maintenance", href: "/maintenance", icon: <Wrench {...iconProps} /> },
      { label: "Settings", href: "/settings", icon: <Settings {...iconProps} /> },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
}

export function Sidebar({ collapsed }: SidebarProps) {
  const pathname = usePathname();
  const [isHovered, setIsHovered] = useState(false);
  
  const isExpanded = !collapsed || isHovered;

  return (
    <>
      <div 
        className={`shrink-0 transition-[width] duration-300 ease-in-out ${
          collapsed ? "w-14" : "w-60"
        }`} 
      />

      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`fixed top-0 left-0 z-40 flex flex-col h-screen bg-[#111113] border-r border-zinc-800/60 overflow-hidden transition-[width,box-shadow] duration-300 ease-in-out ${
          isExpanded ? "w-60" : "w-14"
        } ${collapsed && isHovered ? " border-r-zinc-700/60" : ""}`}
      >
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