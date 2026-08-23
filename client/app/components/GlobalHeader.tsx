"use client";

import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "./ThemeProvider";
import { useEffect, useRef, useState } from "react";
import { 
  PanelLeftClose, 
  PanelLeftOpen, 
  ChevronRight, 
  User, 
  Beaker, 
  History 
} from "lucide-react";

const PAGE_LABELS: Record<string, string> = {
  "/": "Overview",
  "/floor-map": "Floor Map",
  "/live-monitoring": "Live Monitoring",
  "/production-lines": "Production Lines",
  "/worker-reallocation": "Worker Reallocation",
  "/workforce": "Workforce",
  "/style-management": "Style Management",
  "/risk-analyze": "Reports & Analytics",
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

interface GlobalHeaderProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function GlobalHeader({ collapsed, onToggle }: GlobalHeaderProps) {
  const pathname = usePathname();
  const themeData = useTheme() as any; 
  const router = useRouter();
  const pageLabel = getPageLabel(pathname);

  const [user, setUser] = useState<any>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Apply industrial sharp styling to Lucide icons
  const iconStyle = { strokeLinecap: "square" as const, strokeLinejoin: "miter" as const };

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data?.user) setUser(data.user);
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const handleThemeChange = (newTheme: string) => {
    if (typeof themeData.setTheme === 'function') {
      themeData.setTheme(newTheme);
    } else if (typeof themeData.toggle === 'function') {
      themeData.toggle();
    }
  };

  const currentTheme = themeData.theme || 'system';

  return (
    <header className="sticky top-0 z-20 shrink-0 border-b border-zinc-200 dark:border-zinc-800/80 bg-white/80 dark:bg-[#0d0d0f]/90 backdrop-blur-md px-4 py-3 flex items-center justify-between">
      
      <div className="flex items-center gap-3">
        <button
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="w-8 h-8 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors rounded-none"
        >
          {collapsed ? <PanelLeftOpen size={16} {...iconStyle} /> : <PanelLeftClose size={16} {...iconStyle} />}
        </button>

        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-widest uppercase">
            OPSIS
          </span>
          <span className="text-zinc-300 dark:text-zinc-600">
            <ChevronRight size={14} {...iconStyle} />
          </span>
          <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {pageLabel}
          </span>
        </div>
      </div>

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsProfileOpen(!isProfileOpen)}
          className="w-8 h-8 rounded-none border border-zinc-200 dark:border-zinc-700 overflow-hidden focus:outline-none hover:ring-1 hover:ring-zinc-900 dark:hover:ring-zinc-100 transition-all"
        >
          <img 
            src={`https://ui-avatars.com/api/?name=${user?.email || "U"}&background=111113&color=fff&rounded=false&bold=true`} 
            alt="Profile Avatar" 
            className="w-full h-full object-cover" 
          />
        </button>

        {isProfileOpen && (
          <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800 shadow-2xl py-1 z-50 text-sm text-zinc-900 dark:text-zinc-300 rounded-none">
            
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
              <p className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                {user?.user_metadata?.firstName || user?.email?.split('@')[0] || "Opsis User"}
              </p>
              <p className="text-xs text-zinc-500 font-mono truncate mt-0.5">{user?.email || "Loading..."}</p>
            </div>

            <div className="py-1 border-b border-zinc-200 dark:border-zinc-800">
              <button className="w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100 flex items-center gap-3 transition-colors">
                <User size={14} {...iconStyle} />
                Account Settings
              </button>
              <button className="w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100 flex items-center gap-3 transition-colors">
                <Beaker size={14} {...iconStyle} />
                Feature previews
              </button>
              <button className="w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100 flex items-center gap-3 transition-colors">
                <History size={14} {...iconStyle} />
                Changelog
              </button>
            </div>

            <div className="py-2 border-b border-zinc-200 dark:border-zinc-800">
              <p className="px-4 py-1 text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest">Theme</p>
              {['system', 'dark', 'light'].map((t) => (
                <button
                  key={t}
                  onClick={() => handleThemeChange(t)}
                  className="w-full text-left px-4 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100 flex items-center gap-3 capitalize transition-colors"
                >
                  <div className="w-3 flex justify-center">
                    {currentTheme === t && <div className="w-1.5 h-1.5 rounded-none bg-zinc-900 dark:bg-zinc-100" />}
                  </div>
                  {t}
                </button>
              ))}
            </div>

            <div className="py-1">
              <button onClick={handleLogout} className="w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100 transition-colors">
                Log out
              </button>
            </div>

          </div>
        )}
      </div>

    </header>
  );
}