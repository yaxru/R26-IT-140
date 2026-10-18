"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { GlobalHeader } from "./GlobalHeader";

const NO_SIDEBAR_PATHS = ["/login"];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // `pinned` = user explicitly clicked to keep sidebar expanded (pushes content)
  // When not pinned, sidebar is icon-only and hover-expands as an overlay
  const [pinned, setPinned] = useState(false);
  const showSidebar = !NO_SIDEBAR_PATHS.some((p) => pathname.startsWith(p));

  if (!showSidebar) return <>{children}</>;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#F8F8F8] dark:bg-[#0d0d0f]">
      {/* Full-width header — always on top */}
      <GlobalHeader />

      {/* Body: sidebar spacer + content */}
      <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
        <Sidebar pinned={pinned} onToggle={() => setPinned((v) => !v)} />
        {/* Spacer only changes when pinned — not on hover */}
        <div
          style={{
            width: pinned ? 228 : 56,
            transition: "width 280ms cubic-bezier(0.4, 0, 0.2, 1)",
            flexShrink: 0,
          }}
          aria-hidden="true"
        />
        <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-y-auto overflow-x-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
