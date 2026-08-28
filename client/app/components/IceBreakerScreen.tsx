"use client";

import { useState, useEffect } from "react";
import { usePressureCapture } from "@/lib/stress/usePressureCapture";

const QUESTIONS: { key: string; label: string; options: string[] }[] = [
  {
    key: "hobby",
    label: "What's a hobby you enjoy?",
    options: ["Sports", "Music", "Reading", "Gaming", "Cooking", "Other"],
  },
  {
    key: "genre",
    label: "Favourite music genre?",
    options: ["Pop", "Rock", "Hip-Hop", "Baila", "Classical", "Other"],
  },
  {
    key: "artist",
    label: "Favourite singer or band?",
    options: ["Local artist", "International", "Both", "Not sure"],
  },
  {
    key: "food",
    label: "Favourite food?",
    options: ["Rice & Curry", "Kottu", "String Hoppers", "Fast Food", "Other"],
  },
  {
    key: "show",
    label: "Favourite movie or show?",
    options: ["Action", "Comedy", "Drama", "Teledrama", "Other"],
  },
  {
    key: "extra",
    label: "One more thing you like?",
    options: ["Traveling", "Sleeping", "Chatting", "Sports", "Other"],
  },
];

export default function IceBreakerScreen({
  onComplete,
}: {
  onComplete: (pressures: number[]) => void;
}) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [isVisible, setIsVisible] = useState(true);
  const { record, getSamples } = usePressureCapture();

  const question = QUESTIONS[index];
  const isLast = index === QUESTIONS.length - 1;

  useEffect(() => {
    setIsVisible(true);
  }, [index]);

  function choose(option: string) {
    setSelected((s) => ({ ...s, [question.key]: option }));
    setIsVisible(false);

    setTimeout(() => {
      if (isLast) {
        onComplete(getSamples());
      } else {
        setIndex((i) => i + 1);
      }
    }, 250); // wait for fade out
  }

  return (
    <div className="flex flex-col items-center justify-center gap-8 px-6 w-full h-full animate-in fade-in duration-500">
      <div className="text-center">
        <span className="text-xs font-medium tracking-widest text-slate-400 uppercase">
          Let's warm up · {index + 1} of {QUESTIONS.length}
        </span>
        <h2 className="text-xl font-medium text-slate-700 mt-3 transition-opacity duration-300">
          {question.label}
        </h2>
      </div>

      <div
        className={`grid grid-cols-2 gap-4 w-full max-w-sm transition-all duration-300 transform ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
        }`}
      >
        {question.options.map((opt) => {
          const isSelected = selected[question.key] === opt;
          return (
            <button
              key={opt}
              onPointerDown={record}
              onPointerMove={record}
              onClick={() => choose(opt)}
              className={`select-none rounded-3xl py-4 px-3 text-sm font-medium shadow-sm transition-all duration-200 active:scale-95 ${
                isSelected
                  ? "bg-indigo-400 text-white shadow-indigo-200"
                  : "bg-white text-slate-600 hover:bg-slate-50 hover:shadow-md border border-slate-100"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
