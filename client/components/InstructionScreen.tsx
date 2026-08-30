"use client";

import { BlobCharacter } from "./BlobCharacter";

const SCREEN_COLORS: Record<
  string,
  {
    bg: string;
    blob: string;
    pattern: string;
    mood: "curious" | "cheeky" | "sleepy";
  }
> = {
  "instructions-pss10": {
    bg: "#F87171",
    blob: "#EF4444",
    pattern: "pattern-dots",
    mood: "curious",
  },
  "instructions-game1": {
    bg: "#FB923C",
    blob: "#F97316",
    pattern: "pattern-zigzag",
    mood: "cheeky",
  },
  "instructions-game2": {
    bg: "#60A5FA",
    blob: "#3B82F6",
    pattern: "pattern-stripes",
    mood: "sleepy",
  },
};

interface Props {
  step: string;
  stepKey: string;
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
  const theme = SCREEN_COLORS[stepKey] ?? {
    bg: "#F87171",
    blob: "#EF4444",
    pattern: "pattern-dots",
    mood: "curious",
  };

  return (
    <div
      className="flex flex-col h-dvh w-full overflow-hidden relative"
      style={{ backgroundColor: theme.bg }}
    >
      <div
        className={`absolute inset-0 ${theme.pattern} opacity-20 mix-blend-overlay pointer-events-none`}
      />

      <div className="flex-1 w-full flex flex-col relative z-10">
        <div className="w-full max-w-md mx-auto flex-1 flex flex-col items-center justify-end pb-4 relative">
          <p className="absolute top-6 left-6 text-xs font-bold uppercase tracking-widest text-white/60">
            {step}
          </p>
          <BlobCharacter mood={theme.mood} color={theme.blob} />
        </div>
      </div>

      <div className="h-[50%] shrink-0 w-full bg-[#1a1a1a] relative z-20">
        <div className="w-full max-w-md mx-auto h-full px-6 py-6 flex flex-col items-center justify-center text-center">
          <h1 className="text-4xl font-black text-white leading-[1.05] uppercase mb-5 whitespace-pre-line shrink-0">
            {title}
          </h1>

          <ul className="flex flex-col gap-2.5 w-full mb-6 text-left shrink-0">
            {bullets.map((b, i) => (
              <li
                key={i}
                className="flex gap-4 items-start w-full bg-white/5 p-3 rounded-2xl"
              >
                <span
                  className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-sm font-black text-[#1a1a1a]"
                  style={{ backgroundColor: theme.bg }}
                >
                  {i + 1}
                </span>
                <span className="text-sm font-semibold text-white/80 leading-snug pt-1">
                  {b}
                </span>
              </li>
            ))}
          </ul>

          <button
            onClick={onNext}
            className="select-none shrink-0 w-full font-black text-lg py-4 rounded-2xl uppercase tracking-wide transition-all duration-150 active:scale-95 text-[#1a1a1a]"
            style={{ backgroundColor: theme.bg }}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
