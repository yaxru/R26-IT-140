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
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {children}
        </div>
      </div>
    </div>
  );
}
