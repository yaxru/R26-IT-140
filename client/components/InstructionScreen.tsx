"use client";

import { BookOpen, Egg, Target } from "lucide-react";

const THEMES: Record<string, { background: string; accent: string; icon: typeof BookOpen }> = {
  "instructions-pss10": {
    background: "#DDF6FF",
    accent: "#1599C6",
    icon: BookOpen,
  },
  "instructions-game1": {
    background: "#FFE4C7",
    accent: "#F18427",
    icon: Egg,
  },
  "instructions-game2": {
    background: "#DFE5FF",
    accent: "#5969DC",
    icon: Target,
  },
};

interface Props {
  step: string;
  stepKey: string;
  title: string;
  bullets: readonly string[];
  actionLabel: string;
  onNext: () => void;
}

export default function InstructionScreen({
  step,
  stepKey,
  title,
  bullets,
  actionLabel,
  onNext,
}: Props) {
  const theme = THEMES[stepKey] ?? THEMES["instructions-pss10"];
  const Icon = theme.icon;

  return (
    <main className="min-h-dvh bg-[#F6F7FB] px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+1.5rem)] text-[#20243A] sm:px-8">
      <div className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-xl flex-col">
        <p className="mb-5 text-xs font-extrabold uppercase tracking-[0.14em] text-[#73788C]">
          {step}
        </p>
        <div
          className="mb-6 flex aspect-[16/8] max-h-64 items-center justify-center overflow-hidden rounded-[2rem]"
          style={{ backgroundColor: theme.background }}
        >
          <div
            className="flex h-28 w-28 items-center justify-center rounded-[2rem] bg-white shadow-lg sm:h-36 sm:w-36"
            style={{ color: theme.accent }}
          >
            <Icon size={64} strokeWidth={1.8} aria-hidden="true" />
          </div>
        </div>
        <h1 className="mb-6 whitespace-pre-line text-3xl font-black leading-tight tracking-tight sm:text-4xl">
          {title}
        </h1>
        <ul className="mb-8 flex flex-col gap-3">
          {bullets.map((bullet, index) => (
            <li
              key={bullet}
              className="flex items-start gap-4 rounded-2xl border border-[#E7E9F0] bg-white p-4 shadow-sm"
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black text-white"
                style={{ backgroundColor: theme.accent }}
              >
                {index + 1}
              </span>
              <span className="pt-1 text-sm font-semibold leading-relaxed text-[#44495D]">
                {bullet}
              </span>
            </li>
          ))}
        </ul>
        <button
          onClick={onNext}   /**move to ice breaker  */
          className="mt-auto flex min-h-14 w-full items-center justify-center rounded-2xl px-6 py-4 text-base font-extrabold text-white shadow-lg transition active:scale-[0.99] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#20243A]"
          style={{ backgroundColor: theme.accent }}
        >
          {actionLabel}
        </button>
      </div>
    </main>
  );
}
