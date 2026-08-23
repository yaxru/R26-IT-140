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
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

const iconProps = { size: 16, strokeWidth: 1.8 };

const COLLAPSED_W = 56;   // px — icon-only
const EXPANDED_W  = 228;  // px — full labels

const NAV_SECTIONS = [
  {
    label: "Main",
    items: [
      { label: "Overview",           href: "/",                   icon: <LayoutDashboard  {...iconProps} /> },
      { label: "Floor Map",          href: "/floor-map",          icon: <Map              {...iconProps} /> },
      { label: "Live Monitoring",    href: "/live-monitoring",    icon: <Activity         {...iconProps} /> },
      { label: "Production Lines",   href: "/production-lines",   icon: <Layers           {...iconProps} /> },
    ],
  },
  {
    label: "Management",
    items: [
      { label: "Worker Reallocation", href: "/worker-reallocation", icon: <ArrowRightLeft {...iconProps} /> },
      { label: "Workforce",           href: "/workforce",           icon: <Users          {...iconProps} /> },
      { label: "Style Management",    href: "/style-management",    icon: <Shirt          {...iconProps} /> },
      { label: "Reports & Analytics", href: "/risk-analyze",        icon: <LineChart      {...iconProps} /> },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Inventory",   href: "/inventory",   icon: <Package  {...iconProps} /> },
      { label: "Maintenance", href: "/maintenance",  icon: <Wrench   {...iconProps} /> },
      { label: "Settings",    href: "/settings",     icon: <Settings {...iconProps} /> },
    ],
  },
];

interface SidebarProps {
  /** true = sidebar is pinned open and pushes content */
  pinned: boolean;
  /** called when user clicks the pin/collapse toggle at the bottom */
  onToggle: () => void;
}

export function Sidebar({ pinned, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [hovered, setHovered] = useState(false);

  // Expand visually when pinned OR when hovered
  const isExpanded = pinned || hovered;

  // When not pinned and hovering, sidebar floats as overlay → higher z-index
  const isOverlay = !pinned && hovered;

  return (
    <aside
      onMouseEnter={() => { if (!pinned) setHovered(true); }}
      onMouseLeave={() => { if (!pinned) setHovered(false); }}
      aria-label="Main navigation"
      style={{
        width: isExpanded ? EXPANDED_W : COLLAPSED_W,
        transition: "width 280ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
      className={`
        fixed top-13 left-0 bottom-0 flex flex-col
        border-r border-[#EAEAEA] dark:border-zinc-800
        bg-[#fafafa] dark:bg-[#111113]
        overflow-hidden
        ${isOverlay ? "z-30" : "z-20"}
      `}
    >
      {/* Inner container is always full expanded width so content never reflows */}
      <div style={{ width: EXPANDED_W }} className="flex flex-col h-full">

        {/* ── Nav ────────────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 space-y-5">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              {/* Section label */}
              <div
                className="h-5 mb-1 px-2 flex items-center overflow-hidden"
                aria-hidden={!isExpanded}
              >
                <p
                  className={`
                    text-[10px] font-semibold text-[#9A9A9A] dark:text-zinc-500
                    uppercase tracking-widest whitespace-nowrap
                    transition-opacity duration-200
                    ${isExpanded ? "opacity-100" : "opacity-0"}
                  `}
                >
                  {section.label}
                </p>
              </div>

              <ul className="space-y-0.5" role="list">
                {section.items.map((item) => {
                  const isActive =
                    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={!isExpanded ? item.label : undefined}
                        aria-current={isActive ? "page" : undefined}
                        className={`
                          group flex items-center gap-3 px-2.5 py-2 text-[13px] font-medium
                          border-l-2 transition-colors duration-100
                          focus-visible:outline-2 focus-visible:outline-offset-[-2px]
                          focus-visible:outline-[#1A7C4B]
                          ${isActive
                            ? "border-l-[#1A7C4B] bg-[#E6F1EC] dark:bg-[#0A321E]/40 text-[#1A7C4B] dark:text-[#47966F]"
                            : "border-l-transparent text-[#5F5F5F] dark:text-zinc-400 hover:bg-[#F8F8F8] dark:hover:bg-zinc-800/60 hover:text-[#242424] dark:hover:text-zinc-200"
                          }
                        `}
                      >
                        {/* Icon — always visible */}
                        <span
                          className={`
                            shrink-0 flex items-center justify-center w-4 h-4
                            ${isActive
                              ? "text-[#1A7C4B] dark:text-[#47966F]"
                              : "text-[#9A9A9A] dark:text-zinc-500 group-hover:text-[#424242] dark:group-hover:text-zinc-300"
                            }
                          `}
                        >
                          {item.icon}
                        </span>

                        {/* Label — smooth opacity fade */}
                        <span
                          style={{
                            transition: "opacity 200ms cubic-bezier(0.4,0,0.2,1), transform 200ms cubic-bezier(0.4,0,0.2,1)",
                          }}
                          className={`
                            whitespace-nowrap overflow-hidden
                            ${isExpanded
                              ? "opacity-100 translate-x-0 pointer-events-auto"
                              : "opacity-0 -translate-x-1 pointer-events-none w-0"
                            }
                          `}
                        >
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

        {/* ── Bottom: pin / collapse toggle ───────────────── */}
        <div className="shrink-0 border-t border-[#EAEAEA] dark:border-zinc-800">
          <button
            onClick={onToggle}
            aria-label={pinned ? "Collapse sidebar" : "Pin sidebar open"}
            title={pinned ? "Collapse sidebar" : "Pin sidebar open"}
            className={`
              w-full flex items-center gap-3 px-2.5 py-3
              text-[#9A9A9A] dark:text-zinc-500
              hover:text-[#424242] dark:hover:text-zinc-300
              hover:bg-[#F8F8F8] dark:hover:bg-zinc-800/60
              transition-colors duration-100 text-[13px] font-medium
            `}
          >
            <span className="shrink-0 flex items-center justify-center w-4 h-4">
              {pinned
                ? <PanelLeftClose size={16} strokeWidth={1.8} />
                : <PanelLeftOpen  size={16} strokeWidth={1.8} />
              }
            </span>
            <span
              style={{
                transition: "opacity 200ms cubic-bezier(0.4,0,0.2,1), transform 200ms cubic-bezier(0.4,0,0.2,1)",
              }}
              className={`
                whitespace-nowrap overflow-hidden
                ${isExpanded
                  ? "opacity-100 translate-x-0 pointer-events-auto"
                  : "opacity-0 -translate-x-1 pointer-events-none w-0"
                }
              `}
            >
              {pinned ? "Collapse sidebar" : "Pin sidebar open"}
            </span>
          </button>
        </div>

      </div>
    </aside>
  );
}