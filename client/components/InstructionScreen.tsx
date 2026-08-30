"use client";

import { BlobCharacter } from "./BlobCharacter";

const SCREEN_COLORS: Record<string, { bg: string; blob: string }> = {
  "instructions-pss10":  { bg: "#F87171", blob: "#EF4444" },
  "instructions-game1":  { bg: "#FB923C", blob: "#F97316" },
  "instructions-game2":  { bg: "#60A5FA", blob: "#3B82F6" },
};

interface Props {
  step: string;
  stepKey: string; // used to pick color
  title: string;
  bullets: string[];
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
  const theme = SCREEN_COLORS[stepKey] ?? { bg: "#F87171", blob: "#EF4444" };

  return (
    <div className="flex flex-col min-h-dvh overflow-hidden" style={{ backgroundColor: theme.bg }}>
      {/* ── Character zone ──────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-end pb-6 pt-14 relative">
        <p
          className="absolute top-6 left-6 text-xs font-bold uppercase tracking-widest text-white/60"
        >
          {step}
        </p>
        <BlobCharacter mood="curious" color={theme.blob} />
      </div>

      {/* ── Content zone ────────────────────────────────── */}
      <div className="shrink-0 bg-[#1a1a1a] px-7 pt-8 pb-10">
        <h1 className="text-4xl font-black text-white leading-[1.05] uppercase mb-6">
          {title}
        </h1>

        <ul className="space-y-3 mb-8">
          {bullets.map((b, i) => (
            <li key={i} className="flex gap-3 items-start">
              <span
                className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-black text-[#1a1a1a] mt-0.5"
                style={{ backgroundColor: theme.bg }}
              >
                {i + 1}
              </span>
              <span className="text-sm text-white/70 leading-relaxed">{b}</span>
            </li>
          ))}
        </ul>

        <button
          onClick={onNext}
          className="select-none w-full font-black text-lg py-5 rounded-2xl uppercase tracking-wide transition-all duration-150 active:scale-95 text-[#1a1a1a]"
          style={{ backgroundColor: theme.bg }}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
