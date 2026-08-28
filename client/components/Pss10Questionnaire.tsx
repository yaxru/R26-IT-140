"use client";

import { useState, useEffect } from "react";
import { Pss10Answers } from "@/lib/stress/types";

const OPTIONS = [
  { label: "Never", value: 0 },
  { label: "Almost Never", value: 1 },
  { label: "Sometimes", value: 2 },
  { label: "Fairly Often", value: 3 },
  { label: "Very Often", value: 4 },
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
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    setIsVisible(true);
  }, [index]);

  function choose(value: number) {
    const key = String(index + 1);
    const next = { ...answers, [key]: value };
    setAnswers(next);
    setIsVisible(false);

    setTimeout(() => {
      if (index === QUESTIONS.length - 1) {
        onComplete(next);
      } else {
        setIndex((i) => i + 1);
      }
    }, 250); // match transition duration
  }

  const progress = ((index + 1) / QUESTIONS.length) * 100;

  return (
    <div className="flex flex-col items-center justify-center gap-10 px-6 w-full h-full animate-in fade-in duration-500">
      <div className="w-full max-w-sm text-center">
        <span className="text-xs font-medium tracking-widest text-slate-400 uppercase">
          Question {index + 1} of {QUESTIONS.length}
        </span>
        <div className="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-300 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div
        className={`w-full max-w-sm min-h-[4rem] flex items-center justify-center transition-all duration-300 transform ${
          isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
        }`}
      >
        <h2 className="text-xl font-medium text-slate-700 text-center leading-snug">
          In the past month, how often have you {QUESTIONS[index]}
        </h2>
      </div>

      <div
        className={`flex flex-col gap-3 w-full max-w-sm transition-all duration-300 delay-75 transform ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        }`}
      >
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => choose(opt.value)}
            className="select-none bg-white text-slate-600 font-medium py-4 rounded-3xl shadow-sm border border-slate-100 text-sm transition-all duration-200 active:scale-95 hover:bg-slate-50 hover:shadow-md"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
