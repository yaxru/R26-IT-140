"use client";

import { useState, useEffect, useRef } from "react";
import { usePressureCapture } from "@/lib/stress/usePressureCapture";

const QUESTIONS: { key: string; label: string; options: string[]; color: string }[] = [
  {
    key: "hobby",
    label: "What's a hobby you enjoy?",
    options: ["Sports", "Music", "Reading", "Gaming", "Cooking", "Other"],
    color: "from-teal-400 to-cyan-500",
  },
  {
    key: "genre",
    label: "Favourite music genre?",
    options: ["Pop", "Rock", "Hip-Hop", "Baila", "Classical", "Other"],
    color: "from-violet-400 to-purple-500",
  },
  {
    key: "artist",
    label: "Favourite singer or band?",
    options: ["Local artist", "International", "Both", "Not sure"],
    color: "from-pink-400 to-rose-500",
  },
  {
    key: "food",
    label: "Favourite food?",
    options: ["Rice & Curry", "Kottu", "String Hoppers", "Fast Food", "Other"],
    color: "from-amber-400 to-orange-500",
  },
  {
    key: "show",
    label: "Favourite movie or show?",
    options: ["Action", "Comedy", "Drama", "Teledrama", "Other"],
    color: "from-emerald-400 to-green-500",
  },
  {
    key: "extra",
    label: "One more thing you enjoy?",
    options: ["Traveling", "Sleeping", "Chatting", "Sports", "Other"],
    color: "from-sky-400 to-blue-500",
  },
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

  const question = QUESTIONS[index];
  const progress = ((index + 1) / QUESTIONS.length) * 100;

  // Reset "in" on index change
  useEffect(() => {
    setPhase("in");
    setJustPicked(null);
  }, [index]);

  function choose(option: string) {
    setSelected((s) => ({ ...s, [question.key]: option }));
    setJustPicked(option);
    setPhase("out");

    setTimeout(() => {
      if (index === QUESTIONS.length - 1) {
        onComplete(getSamples());
      } else {
        setIndex((i) => i + 1);
      }
    }, 350);
  }

  return (
    <div className="flex flex-col min-h-dvh px-6 pt-10 pb-8 gap-6">
      {/* Progress bar */}
      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${question.color} transition-all duration-500 ease-out rounded-full`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step counter */}
      <div className="text-center">
        <span className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
          Warm up · {index + 1} of {QUESTIONS.length}
        </span>
      </div>

      {/* Question card — transitions in/out */}
      <div
        className="flex-1 flex flex-col items-center justify-center gap-8"
        style={{
          opacity: phase === "in" ? 1 : 0,
          transform: phase === "in" ? "translateY(0)" : "translateY(-16px)",
          transition: "opacity 0.3s ease, transform 0.3s ease",
        }}
      >
        {/* Emoji badge */}
        <div
          className={`w-20 h-20 rounded-full bg-gradient-to-br ${question.color} flex items-center justify-center text-3xl shadow-lg anim-scaleIn`}
        >
          {["🎯", "🎵", "🌟", "🍜", "🎬", "✨"][index]}
        </div>

        <h2 className="text-xl font-bold text-slate-800 text-center leading-snug max-w-xs">
          {question.label}
        </h2>

        {/* Options grid */}
        <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
          {question.options.map((opt) => {
            const isSelected = justPicked === opt;
            return (
              <button
                key={opt}
                onPointerDown={record}
                onPointerMove={record}
                onClick={() => choose(opt)}
                className={`
                  relative select-none overflow-hidden py-4 px-3 rounded-2xl text-sm font-semibold 
                  transition-all duration-200 active:scale-95 border
                  ${isSelected
                    ? `bg-gradient-to-br ${question.color} text-white border-transparent shadow-lg`
                    : "bg-white text-slate-700 border-slate-100 hover:border-slate-200 hover:shadow-md active:bg-slate-50"
                  }
                `}
              >
                {/* Tap ripple for selected */}
                {isSelected && (
                  <span className="absolute inset-0 bg-white/20 ripple-enter rounded-2xl" />
                )}
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
