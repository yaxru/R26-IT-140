"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { GlobalHeader } from "./GlobalHeader";

const NO_SIDEBAR_PATHS = ["/login"];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const showSidebar = !NO_SIDEBAR_PATHS.some((p) => pathname.startsWith(p));

  if (!showSidebar) return <>{children}</>;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar collapsed={collapsed} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader
          collapsed={collapsed}
          onToggle={() => setCollapsed((v) => !v)}
        />
        <main className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-[#0d0d0f]">
          {children}
        </main>
      </div>
    </div>
  );
}
