"use client";

import { useState, type ReactNode } from "react";

interface HoverTooltipProps {
  content: ReactNode;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Rich hover tooltip — a small floating dark card that follows hover/focus,
 * used in place of native `title` attributes so charts can show multi-line,
 * styled context (matching the reference dashboard's hover cards).
 */
export function HoverTooltip({
  content,
  children,
  className,
  style,
}: HoverTooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      className={`relative inline-flex ${className ?? ""}`}
      style={style}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-60 bg-zinc-900 dark:bg-black border border-zinc-700 dark:border-zinc-800 text-zinc-100 text-[10px] font-mono p-2.5 shadow-xl pointer-events-none whitespace-normal leading-relaxed"
        >
          {content}
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-zinc-900 dark:border-t-black" />
        </span>
      )}
    </span>
  );
}
