"use client";

import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "./ThemeProvider";

// ── Page label map ────────────────────────────────────────────────────────

const PAGE_LABELS: Record<string, string> = {
  "/": "Overview",
  "/floor-map": "Floor Map",
  "/live-monitoring": "Live Monitoring",
  "/production-lines": "Production Lines",
  "/workforce": "Workforce",
  "/style-management": "Style Management",
  "/reports": "Reports & Analytics",
  "/inventory": "Inventory",
  "/maintenance": "Maintenance",
  "/settings": "Settings",
};

function getPageLabel(pathname: string): string {
  if (PAGE_LABELS[pathname]) return PAGE_LABELS[pathname];
  const match = Object.keys(PAGE_LABELS).find(
    (k) => k !== "/" && pathname.startsWith(k),
  );
  return match ? PAGE_LABELS[match] : "Dashboard";
}

// ── Icons ─────────────────────────────────────────────────────────────────

function ChevronRightIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function PanelLeftIcon({ collapsed }: { collapsed: boolean }) {
  return collapsed ? (
    // Two vertical bars with right-arrow — "expand panel"
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="0" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <polyline points="12 8 16 12 12 16" />
    </svg>
  ) : (
    // Panel with left-arrow — "collapse panel"
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="0" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <polyline points="15 8 11 12 15 16" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────

interface GlobalHeaderProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function GlobalHeader({ collapsed, onToggle }: GlobalHeaderProps) {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const pageLabel = getPageLabel(pathname);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-20 shrink-0 border-b border-zinc-200 dark:border-zinc-800/80 bg-white/80 dark:bg-[#0d0d0f]/90 backdrop-blur-md px-4 py-3 flex items-center justify-between">
      {/* Sidebar toggle + brand + breadcrumb */}
      <div className="flex items-center gap-3">
        {/* Sidebar collapse/expand button */}
        <button
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="w-8 h-8 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
        >
          <PanelLeftIcon collapsed={collapsed} />
        </button>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
            StitchFlow
          </span>
          <span className="text-zinc-300 dark:text-zinc-600">
            <ChevronRightIcon />
          </span>
          <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {pageLabel}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggle}
          aria-label="Toggle theme"
          className="w-8 h-8 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>

        <button
          onClick={handleLogout}
          aria-label="Sign out"
          title="Sign out"
          className="w-8 h-8 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-red-100 dark:hover:bg-red-950/50 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
        >
          <LogoutIcon />
        </button>
      </div>
    </header>
  );
}
