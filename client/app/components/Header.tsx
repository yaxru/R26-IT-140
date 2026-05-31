"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "./ThemeProvider";

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

interface HeaderProps {
  lastUpdated: Date | null;
  pollingActive: boolean;
  onTogglePolling: () => void;
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

export function Header({
  lastUpdated,
  pollingActive,
  onTogglePolling,
}: HeaderProps) {
  const { theme, toggle } = useTheme();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 dark:border-zinc-800/80 bg-white/80 dark:bg-[#0d0d0f]/90 backdrop-blur-md px-6 py-3 flex items-center justify-between">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 bg-linear-to-br from-emerald-400 to-teal-500 shrink-0">
          <span className="text-white text-[11px] font-black tracking-tight">
            SF
          </span>
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
            StitchFlow
          </span>
          <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-600 uppercase tracking-widest mt-0.5">
            Production Engine v1.0
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        {lastUpdated && (
          <span className="hidden sm:block text-[10px] font-mono text-zinc-400 dark:text-zinc-600 tabular-nums">
            {lastUpdated.toLocaleTimeString()}
          </span>
        )}

        <button
          onClick={onTogglePolling}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono tracking-wider transition-all cursor-pointer ${
            pollingActive
              ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800"
              : "bg-zinc-100 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-500 ring-1 ring-zinc-200 dark:ring-zinc-700"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 ${
              pollingActive
                ? "bg-emerald-500 animate-pulse"
                : "bg-zinc-400 dark:bg-zinc-600"
            }`}
          />
          {pollingActive ? "LIVE" : "PAUSED"}
        </button>

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
