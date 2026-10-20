"use client";

import { useState } from "react";
import { ArrowRight, Play, Sparkles } from "lucide-react";
import { usePressureCapture } from "@/lib/stress/usePressureCapture";
import { Language } from "@/lib/stress/types";
import { getStressCopy } from "@/lib/stress/translations";

const QUESTION_THEMES = [
  { background: "#FFE8CF", accent: "#D56A1C" },
  { background: "#E8E2FF", accent: "#6950C8" },
  { background: "#FFE2EB", accent: "#C54375" },
  { background: "#DDF5E8", accent: "#258354" },
  { background: "#DFEDFF", accent: "#3976C7" },
  { background: "#FFF1C4", accent: "#B57A09" },
];

export default function IceBreakerScreen({
  language,
  onComplete,
}: {
  language: Language;
  onComplete: (pressures: number[]) => void;
}) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const copy = getStressCopy(language);
  const { record, recordTouch, getSamples } = usePressureCapture();/* take pressure values call the hook */
  const theme = QUESTION_THEMES[index];
  const question = copy.icebreaker[index];

  function choose(option: string) {
    if (selected) return;
    setSelected(option);
    setTimeout(() => {
      if (index === QUESTION_THEMES.length - 1) {
        onComplete(getSamples());
      } else {
        setIndex((current) => current + 1);
        setSelected(null);
      }
    }, 220);
  }

  return (
    <main className="min-h-dvh bg-[#F7F7FB] px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-[calc(env(safe-area-inset-top)+1rem)] text-[#20243A] sm:px-6">
      <div className="mx-auto flex min-h-[calc(100dvh-2.25rem)] w-full max-w-xl flex-col">
        <header className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.13em] text-[#797E91]">
              {copy.warmUp}
            </p>
            <h1 className="mt-1 text-lg font-black">
              {copy.question} {index + 1}
              <span className="font-semibold text-[#8A8EA0]"> / {QUESTION_THEMES.length}</span>
            </h1>
          </div>
          <Sparkles size={22} style={{ color: theme.accent }} aria-hidden="true" />
        </header>

        <div className="mb-5 h-2 overflow-hidden rounded-full bg-[#E5E7EF]" aria-label={`${index + 1} of ${QUESTION_THEMES.length}`}>
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{
              width: `${((index + 1) / QUESTION_THEMES.length) * 100}%`,
              backgroundColor: theme.accent,
            }}
          />
        </div>

        <div
          className="relative mb-5 aspect-video w-full overflow-hidden rounded-[1.75rem] shadow-md"
          style={{ backgroundColor: theme.background }}
        >
          <video
            key={index}
            className="h-full w-full object-cover"
            src={`/video/${index + 1}.mp4`}
            autoPlay
            muted
            loop
            playsInline
            aria-label={`${copy.warmUp} ${index + 1}`}
          />
          <span className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-[#20243A]/75 px-3 py-1.5 text-xs font-bold text-white">
            <Play size={12} fill="currentColor" aria-hidden="true" />
            {copy.warmUp}
          </span>
        </div>

        <h2 className="mb-5 text-2xl font-black leading-tight tracking-tight sm:text-3xl">
          {question.question}
        </h2>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {question.options.map((option, optionIndex) => {
            const isSelected = selected === option;
            return (
              <button
                key={option}
                onPointerDown={record}
                onPointerMove={record}
                onTouchStart={recordTouch}
                onTouchMove={recordTouch}
                onTouchEnd={recordTouch}
                onClick={() => choose(option)}
                disabled={selected !== null}
                aria-pressed={isSelected}
                className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-bold transition active:scale-[0.99] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-1 disabled:cursor-default ${isSelected ? "border-transparent text-white shadow-md" : "border-[#E5E7EF] bg-white text-[#383D51] hover:border-[#C8CCDA]"}`}
                style={
                  isSelected
                    ? { backgroundColor: theme.accent, outlineColor: theme.accent }
                    : { outlineColor: theme.accent }
                }
              >
                <span className="flex items-center gap-3">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black ${isSelected ? "bg-white/20 text-white" : "text-white"}`}
                    style={!isSelected ? { backgroundColor: theme.accent } : undefined}
                  >
                    {String.fromCharCode(65 + optionIndex)}
                  </span>
                  <span>{option}</span>
                </span>
                <ArrowRight size={17} className="shrink-0 opacity-60" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}
