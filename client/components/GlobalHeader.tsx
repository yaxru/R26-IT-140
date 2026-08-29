"use client";

import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "./ThemeProvider";
import { useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  Bell,
  Search,
  Sun,
  Moon,
  Monitor,
  LogOut,
  Settings,
  User,
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

export function GlobalHeader(_props: Record<string, never> = {}) {
  const pathname = usePathname();
  const themeData = useTheme() as any;
  const router = useRouter();
  const pageLabel = getPageLabel(pathname);

  const [user, setUser] = useState<any>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const currentTheme = themeData.theme || "system";

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUser(data.user);
    });
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
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

  const handleThemeChange = (t: string) => {
    if (typeof themeData.setTheme === "function") themeData.setTheme(t);
    else if (typeof themeData.toggle === "function") themeData.toggle();
  };

  const displayName =
    user?.user_metadata?.firstName || user?.email?.split("@")[0] || "User";

  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <header className="shrink-0 h-13 border-b border-[#EAEAEA] dark:border-zinc-800 bg-white dark:bg-[#111113] flex items-center px-4 gap-4 z-30">
      {/* ── Logo + Branding ── */}
      <div className="flex items-center gap-2.5 shrink-0 w-57">
        {/* Logo mark */}
        <div className="w-8 h-8 flex items-center justify-center shrink-0">
          <img src="/logo.webp" alt="Opsis Logo" className="w-full h-full object-contain" />
        </div>
        <div>
          <p className="text-sm font-bold text-[#242424] dark:text-zinc-100 uppercase tracking-wide leading-none">
            Opsis 
          </p>
          <p className="text-[9px]  text-[#9A9A9A] dark:text-zinc-500 tracking-widest  leading-none mt-0.5">
            version {process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.5"}
          </p>
        </div>
      </div>

      {/* ── Breadcrumb ── */}
      <div className="hidden md:flex items-center gap-1.5 text-sm shrink-0">
        <span className="text-[#C6C6C6] dark:text-zinc-600">
          <ChevronRight size={14} strokeWidth={1.5} />
        </span>
        <span className="text-[#5F5F5F] dark:text-zinc-400 font-medium">
          {pageLabel}
        </span>
      </div>

      {/* ── Search ── */}
      <div className="flex-1 max-w-sm mx-4">
        <div
          className={`flex items-center gap-2 px-3 h-8 border transition-colors duration-150 ${
            searchFocused
              ? "border-[#1A7C4B] bg-white dark:bg-zinc-900"
              : "border-[#EAEAEA] dark:border-zinc-700 bg-[#F8F8F8] dark:bg-zinc-800/60"
          }`}
        >
          <Search
            size={13}
            className="text-[#9A9A9A] dark:text-zinc-500 shrink-0"
            strokeWidth={2}
          />
          <input
            type="text"
            placeholder="Search…"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="flex-1 bg-transparent text-xs text-[#333333] dark:text-zinc-200 placeholder-[#C6C6C6] dark:placeholder-zinc-600 outline-none"
            aria-label="Search"
          />
          {searchValue && (
            <button
              onClick={() => setSearchValue("")}
              className="text-[#9A9A9A] hover:text-[#424242] dark:hover:text-zinc-300 transition-colors"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* ── Right actions ── */}
      <div className="ml-auto flex items-center gap-1 shrink-0">
        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setIsNotifOpen((v) => !v)}
            aria-label="Notifications"
            aria-expanded={isNotifOpen}
            className="relative w-8 h-8 flex items-center justify-center text-[#9A9A9A] dark:text-zinc-400 hover:text-[#333333] dark:hover:text-zinc-200 hover:bg-[#F1F1F1] dark:hover:bg-zinc-800 transition-colors"
          >
            <Bell size={16} strokeWidth={1.8} />
            {/* Unread dot */}
            <span
              className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#CE8E33] border border-white dark:border-[#111113]"
              aria-hidden="true"
            />
          </button>

          {isNotifOpen && (
            <div className="absolute right-0 top-full mt-1 w-80 bg-white dark:bg-[#111113] border border-[#EAEAEA] dark:border-zinc-800 z-50 flex flex-col shadow-lg">
              <div className="px-4 py-3 border-b border-[#EAEAEA] dark:border-zinc-800 flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#5F5F5F] dark:text-zinc-400">Notifications</span>
                <button className="text-[10px] text-[#1A7C4B] hover:underline uppercase tracking-widest font-mono">Mark all read</button>
              </div>
              <div className="flex-1 overflow-y-auto max-h-80 min-h-[150px]">
                {/* Dummy notifications */}
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="px-4 py-3 border-b border-[#EAEAEA] dark:border-zinc-800 hover:bg-[#F8F8F8] dark:hover:bg-zinc-900/40 transition-colors cursor-pointer">
                    <p className="text-xs font-bold text-[#242424] dark:text-zinc-100 mb-1">
                      {i % 2 === 0 ? "Production Target Alert" : "Machine Maintenance"}
                    </p>
                    <p className="text-[11px] text-[#5F5F5F] dark:text-zinc-400 leading-snug">
                      {i % 2 === 0 ? "Line 04 is currently 12% behind the hourly target. Review allocation." : "Scheduled maintenance for Sewing Machine SM-402 is due in 2 hours."}
                    </p>
                    <p className="text-[9px] font-mono text-[#9A9A9A] dark:text-zinc-500 mt-2 uppercase tracking-widest">{i * 10 + 2} mins ago</p>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2 border-t border-[#EAEAEA] dark:border-zinc-800 text-center">
                <button className="text-[10px] font-bold text-[#242424] dark:text-zinc-300 hover:text-[#1A7C4B] transition-colors uppercase tracking-widest w-full py-1">View all notifications</button>
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="relative ml-1" ref={dropdownRef}>
          <button
            onClick={() => setIsProfileOpen((v) => !v)}
            aria-label="Open profile menu"
            aria-expanded={isProfileOpen}
            className="flex items-center gap-2 px-2 h-8 hover:bg-[#F1F1F1] dark:hover:bg-zinc-800 transition-colors focus-visible:outline-2 focus-visible:outline-[#1A7C4B]"
          >
            {/* Avatar */}
            <div className="w-6 h-6 bg-[#1A7C4B] flex items-center justify-center shrink-0">
              <span className="text-white text-[9px] font-bold">
                {initials}
              </span>
            </div>
            {/* Fixed-width name slot — prevents layout shift while user loads */}
            <span className="hidden sm:block text-xs font-medium text-[#424242] dark:text-zinc-300 w-[96px] truncate">
              {user ? displayName : <span className="inline-block w-16 h-2.5 bg-[#EAEAEA] dark:bg-zinc-700 animate-pulse align-middle" />}
            </span>
            <ChevronRight
              size={12}
              strokeWidth={2}
              className={`text-[#9A9A9A] dark:text-zinc-600 transition-transform duration-200 ${isProfileOpen ? "rotate-90" : ""}`}
            />
          </button>

          {/* Dropdown */}
          {isProfileOpen && (
            <div className="absolute right-0 top-full mt-1 w-60 bg-white dark:bg-[#111113] border border-[#EAEAEA] dark:border-zinc-800 z-50 py-1 text-sm">
              {/* User info */}
              <div className="px-4 py-3 border-b border-[#EAEAEA] dark:border-zinc-800">
                <p className="font-semibold text-[#242424] dark:text-zinc-100 truncate text-[13px]">
                  {displayName}
                </p>
                <p className="text-[11px] text-[#9A9A9A] dark:text-zinc-500 font-mono truncate mt-0.5">
                  {user?.email || "Loading…"}
                </p>
              </div>

              {/* Actions */}
              <div className="py-1 border-b border-[#EAEAEA] dark:border-zinc-800">
                <button className="w-full text-left px-4 py-2 flex items-center gap-3 text-[#424242] dark:text-zinc-300 hover:bg-[#F8F8F8] dark:hover:bg-zinc-800 transition-colors text-xs">
                  <User size={13} strokeWidth={2} />
                  Account Settings
                </button>
                <button className="w-full text-left px-4 py-2 flex items-center gap-3 text-[#424242] dark:text-zinc-300 hover:bg-[#F8F8F8] dark:hover:bg-zinc-800 transition-colors text-xs">
                  <Settings size={13} strokeWidth={2} />
                  Preferences
                </button>
              </div>

              {/* Theme picker */}
              <div className="py-2 border-b border-[#EAEAEA] dark:border-zinc-800">
                <p className="px-4 pb-1.5 text-[10px] font-medium text-[#9A9A9A] dark:text-zinc-500 uppercase tracking-widest">
                  Appearance
                </p>
                <div className="flex gap-1 px-4">
                  {[
                    { key: "light", icon: <Sun size={12} /> },
                    { key: "dark", icon: <Moon size={12} /> },
                    { key: "system", icon: <Monitor size={12} /> },
                  ].map(({ key, icon }) => (
                    <button
                      key={key}
                      onClick={() => handleThemeChange(key)}
                      aria-pressed={currentTheme === key}
                      title={key.charAt(0).toUpperCase() + key.slice(1)}
                      className={`flex-1 py-1.5 flex items-center justify-center gap-1 text-[10px] font-medium capitalize border transition-colors ${
                        currentTheme === key
                          ? "border-[#1A7C4B] bg-[#E6F1EC] dark:bg-[#0A321E]/40 text-[#1A7C4B] dark:text-[#47966F]"
                          : "border-[#EAEAEA] dark:border-zinc-700 text-[#9A9A9A] dark:text-zinc-500 hover:bg-[#F8F8F8] dark:hover:bg-zinc-800"
                      }`}
                    >
                      {icon}
                      <span className="hidden sm:inline">{key}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Logout */}
              <div className="py-1">
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 flex items-center gap-3 text-[#9A9A9A] hover:text-[#242424] dark:hover:text-zinc-100 hover:bg-[#F8F8F8] dark:hover:bg-zinc-800 transition-colors text-xs"
                >
                  <LogOut size={13} strokeWidth={2} />
                  Log out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
