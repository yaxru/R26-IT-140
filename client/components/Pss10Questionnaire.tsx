"use client";

import { useState } from "react";
import { Pss10Answers } from "@/lib/stress/types";

const OPTIONS = [
  { label: "Never", value: 0, color: "from-emerald-400 to-teal-500", emoji: "😌" },
  { label: "Almost Never", value: 1, color: "from-cyan-400 to-sky-500", emoji: "🙂" },
  { label: "Sometimes", value: 2, color: "from-amber-400 to-yellow-500", emoji: "😐" },
  { label: "Fairly Often", value: 3, color: "from-orange-400 to-red-400", emoji: "😟" },
  { label: "Very Often", value: 4, color: "from-rose-500 to-pink-600", emoji: "😰" },
];

const QUESTIONS = [
  "Felt upset because of something unexpected?",
  "Felt unable to control important things?",
  "Felt nervous or stressed?",
  "Felt confident about handling problems?",
  "Felt things were going your way?",
  "Found you could not cope with everything?",
  "Been able to control irritations?",
  "Felt on top of things?",
  "Been angered by things outside your control?",
  "Felt difficulties were piling up too high?",
];

export default function Pss10Questionnaire({
  onComplete,
}: {
  onComplete: (answers: Pss10Answers) => void;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Pss10Answers>({});
  const [phase, setPhase] = useState<"in" | "out">("in");
  const [selected, setSelected] = useState<number | null>(null);

  const progress = ((index + 1) / QUESTIONS.length) * 100;

  function choose(value: number) {
    const key = String(index + 1);
    const next = { ...answers, [key]: value };
    setAnswers(next);
    setSelected(value);
    setPhase("out");

    setTimeout(() => {
      if (index === QUESTIONS.length - 1) {
        onComplete(next);
      } else {
        setIndex((i) => i + 1);
        setPhase("in");
        setSelected(null);
      }
    }, 320);
  }

  return (
    <div className="flex flex-col min-h-dvh px-6 pt-10 pb-8 gap-5">
      {/* Progress bar */}
      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-violet-400 to-purple-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Counter */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
          Question {index + 1} of {QUESTIONS.length}
        </span>
        <span className="text-xs font-semibold text-violet-400">
          {QUESTIONS.length - index - 1} left
        </span>
      </div>

      {/* Question display */}
      <div
        className="flex-1 flex flex-col justify-center gap-6"
        style={{
          opacity: phase === "in" ? 1 : 0,
          transform: phase === "in" ? "translateX(0)" : "translateX(-20px)",
          transition: "opacity 0.28s ease, transform 0.28s ease",
        }}
      >
        {/* Question card */}
        <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100 rounded-3xl px-6 py-8">
          <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-3">
            In the past month…
          </p>
          <h2 className="text-xl font-bold text-slate-800 leading-snug">
            How often have you {QUESTIONS[index]}
          </h2>
        </div>

        {/* Options — vertical list */}
        <div className="flex flex-col gap-2.5">
          {OPTIONS.map((opt) => {
            const isPicked = selected === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => choose(opt.value)}
                className={`
                  relative select-none flex items-center gap-4 px-5 py-4 rounded-2xl border
                  text-sm font-semibold transition-all duration-200 active:scale-95 overflow-hidden
                  ${isPicked
                    ? `bg-gradient-to-r ${opt.color} text-white border-transparent shadow-lg`
                    : "bg-white text-slate-700 border-slate-100 hover:border-slate-200 hover:shadow-sm"
                  }
                `}
              >
                {isPicked && (
                  <span className="absolute inset-0 bg-white/15 ripple-enter rounded-2xl" />
                )}
                <span className="text-xl">{opt.emoji}</span>
                <span>{opt.label}</span>
                {isPicked && (
                  <span className="ml-auto text-white/90 anim-popIn">✓</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
