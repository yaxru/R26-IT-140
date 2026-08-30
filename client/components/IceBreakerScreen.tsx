"use client";

import { useState, useEffect } from "react";
import { usePressureCapture } from "@/lib/stress/usePressureCapture";
import { BlobCharacter } from "./BlobCharacter";

const QUESTIONS: { key: string; label: string; options: string[]; bg: string; blob: string }[] = [
  { key: "hobby",  label: "What's a hobby you enjoy?",      options: ["Sports", "Music", "Reading", "Gaming", "Cooking", "Other"], bg: "#F97316", blob: "#EA580C" },
  { key: "genre",  label: "Favourite music genre?",         options: ["Pop", "Rock", "Hip-Hop", "Baila", "Classical", "Other"],    bg: "#8B5CF6", blob: "#7C3AED" },
  { key: "artist", label: "Favourite singer or band?",      options: ["Local artist", "International", "Both", "Not sure"],         bg: "#EC4899", blob: "#DB2777" },
  { key: "food",   label: "Favourite food?",                options: ["Rice & Curry", "Kottu", "String Hoppers", "Fast Food", "Other"], bg: "#10B981", blob: "#059669" },
  { key: "show",   label: "Favourite movie or show?",       options: ["Action", "Comedy", "Drama", "Teledrama", "Other"],           bg: "#3B82F6", blob: "#2563EB" },
  { key: "extra",  label: "One more thing you enjoy?",      options: ["Traveling", "Sleeping", "Chatting", "Sports", "Other"],     bg: "#F59E0B", blob: "#D97706" },
];

export default function IceBreakerScreen({
  onComplete,
}: {
  onComplete: (pressures: number[]) => void;
}) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<"in" | "out">("in");
  const [justPicked, setJustPicked] = useState<string | null>(null);
  const { record, getSamples } = usePressureCapture();

  const q = QUESTIONS[index];

  useEffect(() => {
    setPhase("in");
    setJustPicked(null);
  }, [index]);

  function choose(option: string) {
    setSelected((s) => ({ ...s, [q.key]: option }));
    setJustPicked(option);
    setPhase("out");

    setTimeout(() => {
      if (index === QUESTIONS.length - 1) {
        onComplete(getSamples());
      } else {
        setIndex((i) => i + 1);
      }
    }, 280);
  }

  return (
    <div
      className="flex flex-col min-h-dvh overflow-hidden transition-colors duration-300"
      style={{ backgroundColor: q.bg }}
    >
      {/* Character zone */}
      <div className="flex-1 flex flex-col items-center justify-end pb-6 pt-12 relative">
        <p className="absolute top-6 left-6 text-xs font-bold uppercase tracking-widest text-white/60">
          Warm up · {index + 1} / {QUESTIONS.length}
        </p>

        <div
          style={{
            opacity: phase === "in" ? 1 : 0,
            transition: "opacity 0.25s ease",
          }}
        >
          <BlobCharacter mood="curious" color={q.blob} />
        </div>
      </div>

      {/* Content zone */}
      <div
        className="shrink-0 bg-[#1a1a1a] px-7 pt-8 pb-10"
        style={{
          opacity: phase === "in" ? 1 : 0,
          transform: phase === "in" ? "translateY(0)" : "translateY(12px)",
          transition: "opacity 0.25s ease, transform 0.25s ease",
        }}
      >
        <h2 className="text-3xl font-black text-white uppercase leading-tight mb-6">
          {q.label}
        </h2>

        {/* Option chips */}
        <div className="flex flex-wrap gap-2.5">
          {q.options.map((opt) => {
            const isPicked = justPicked === opt;
            return (
              <button
                key={opt}
                onPointerDown={record}
                onPointerMove={record}
                onClick={() => choose(opt)}
                className="select-none px-5 py-3 rounded-2xl text-sm font-bold uppercase tracking-wide transition-all duration-150 active:scale-95"
                style={
                  isPicked
                    ? { backgroundColor: q.bg, color: "#1a1a1a" }
                    : { backgroundColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.15)" }
                }
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
