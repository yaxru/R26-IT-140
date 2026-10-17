"use client";

import { useState } from "react";
import { usePressureCapture } from "@/lib/stress/usePressureCapture";
import { BlobCharacter } from "./BlobCharacter";
import { Language } from "@/lib/stress/types";
import { getStressCopy } from "@/lib/stress/translations";

const QUESTION_THEMES = [
  {
    bg: "#F97316",
    blob: "#EA580C",
    pattern: "pattern-grid",
    mood: "curious" as const,
  },
  {
    bg: "#8B5CF6",
    blob: "#7C3AED",
    pattern: "pattern-waves",
    mood: "happy" as const,
  },
  {
    bg: "#EC4899",
    blob: "#DB2777",
    pattern: "pattern-stripes",
    mood: "surprised" as const,
  },
  {
    bg: "#10B981",
    blob: "#059669",
    pattern: "pattern-dots",
    mood: "cheeky" as const,
  },
  {
    bg: "#3B82F6",
    blob: "#2563EB",
    pattern: "pattern-zigzag",
    mood: "sleepy" as const,
  },
  {
    bg: "#F59E0B",
    blob: "#D97706",
    pattern: "pattern-waves",
    mood: "happy" as const,
  },
];

export default function IceBreakerScreen({
  language,
  onComplete,
}: {
  language: Language;
  onComplete: (pressures: number[]) => void;
}) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"in" | "out">("in");
  const [justPicked, setJustPicked] = useState<string | null>(null);
  const { record, getSamples } = usePressureCapture();

  const q = QUESTION_THEMES[index];
  const translatedQuestion = getStressCopy(language).icebreaker[index];

  function choose(option: string) {
    setJustPicked(option);
    setPhase("out");

    setTimeout(() => {
      if (index === QUESTION_THEMES.length - 1) {
        onComplete(getSamples());
      } else {
        setPhase("in");
        setJustPicked(null);
        setIndex((i) => i + 1);
      }
    }, 280);
  }

  return (
    <div
      className="flex flex-col h-dvh w-full overflow-hidden relative"
      style={{ backgroundColor: q.bg }}
    >
      <div
        className={`absolute inset-0 ${q.pattern} opacity-20 mix-blend-overlay transition-opacity duration-300 pointer-events-none`}
      />

      {/* Character zone */}
      <div className="flex-1 w-full flex flex-col relative z-10">
        <div className="w-full max-w-md mx-auto flex-1 flex flex-col items-center justify-end pb-4 relative">
          <p className="absolute top-6 left-6 text-xs font-bold uppercase tracking-widest text-white/80 bg-black/20 px-3 py-1.5 rounded-full">
            {getStressCopy(language).warmUp} · {index + 1} / {QUESTION_THEMES.length}
          </p>

          <div
            style={{
              opacity: phase === "in" ? 1 : 0,
              transition: "opacity 0.25s ease",
            }}
          >
            <BlobCharacter mood={q.mood} color={q.blob} />
          </div>
        </div>
      </div>

      {/* Content zone */}
      <div className="h-[55%] shrink-0 w-full bg-[#1a1a1a] relative z-20">
        <div
          className="w-full max-w-md mx-auto h-full px-6 py-6 flex flex-col items-center justify-center text-center"
          style={{
            opacity: phase === "in" ? 1 : 0,
            transform: phase === "in" ? "translateY(0)" : "translateY(12px)",
            transition: "opacity 0.25s ease, transform 0.25s ease",
          }}
        >
          <h2 className="text-2xl font-black text-white uppercase leading-tight mb-5 shrink-0">
            {translatedQuestion.question}
          </h2>

          <div className="flex flex-col w-full gap-2 shrink-0">
            {translatedQuestion.options.map((opt) => {
              const isPicked = justPicked === opt;
              return (
                <button
                  key={opt}
                  onPointerDown={record}
                  onPointerMove={record}
                  onClick={() => choose(opt)}
                  className="select-none w-full py-3.5 rounded-2xl text-sm font-bold uppercase tracking-wide transition-all duration-150 active:scale-95 text-center"
                  style={
                    isPicked
                      ? { backgroundColor: q.bg, color: "#1a1a1a" }
                      : {
                          backgroundColor: "rgba(255,255,255,0.1)",
                          color: "rgba(255,255,255,0.75)",
                        }
                  }
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
