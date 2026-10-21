"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Language, Pss10Answers } from "@/lib/stress/types";
import { getStressCopy } from "@/lib/stress/translations";  /**import questions  */

const QUESTION_EMOJIS = ["😌", "🙂", "😐", "😟", "😰"];

export default function Pss10Questionnaire({
  language,
  onComplete,
}: {
  language: Language;
  onComplete: (answers: Pss10Answers) => void;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Pss10Answers>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [leaving, setLeaving] = useState(false);
  const copy = getStressCopy(language);                           /**retriving */

  function choose(value: number) {
    if (leaving) return;
    const next = { ...answers, [String(index + 1)]: value };
    setAnswers(next);
    setSelected(value);
    setLeaving(true);
    setTimeout(() => {
      if (index === copy.pssQuestions.length - 1) {
        onComplete(next);
      } else {
        setIndex((current) => current + 1);
        setSelected(null);
        setLeaving(false);
      }
    }, 180);
  }

  function goBack() {
    if (index === 0 || leaving) return;
    setIndex((current) => current - 1);
    setSelected(answers[String(index)] ?? null);
  }

  const progress = ((index + 1) / copy.pssQuestions.length) * 100;

  return (
    <main className="min-h-dvh bg-[#F5F1FF] px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-[calc(env(safe-area-inset-top)+1rem)] text-[#24213A] sm:px-6">
      <div className="mx-auto flex min-h-[calc(100dvh-2.25rem)] w-full max-w-xl flex-col">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.13em] text-[#77718B]">
              {copy.pastMonth}
            </p>
            <p className="mt-1 text-sm font-bold text-[#5B44B8]">
              {copy.question} {index + 1} / {copy.pssQuestions.length}
            </p>
          </div>
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E5DAFF] text-2xl" aria-hidden="true">
            {QUESTION_EMOJIS[selected ?? Math.min(index % 5, 4)]}
          </span>
        </header>

        <div
          className="mb-7 h-2 overflow-hidden rounded-xl bg-[#E1DCEA]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          aria-label={`${index + 1} of ${copy.pssQuestions.length}`}
        >
          <div
            className="h-full rounded-full bg-[#8055D9] transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <section className={`rounded-[1.75rem] border border-white/80 bg-white p-5 shadow-[0_12px_35px_rgba(63,43,115,0.08)] transition-all duration-150 sm:p-7 ${leaving ? "translate-y-1 opacity-70" : "translate-y-0 opacity-100"}`}>
          <span className="mb-4 inline-flex rounded-full bg-[#F0E9FF] px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide text-[#6849B8]">
            {copy.questionLead}
          </span>
          <h1 className="mb-6 text-[1.6rem] font-black leading-tight tracking-tight sm:text-3xl">
            {copy.pssQuestions[index]}
          </h1>
          <div className="flex flex-col gap-2.5">
            {copy.pssOptions.map((label, value) => {
              const isSelected = selected === value;
              return (
                <button
                  key={value}
                  onClick={() => choose(value)}
                  disabled={leaving}
                  aria-pressed={isSelected}
                  className={`flex min-h-14 w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-bold transition active:scale-[0.99] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-1 disabled:cursor-default ${isSelected ? "border-[#8055D9] bg-[#8055D9] text-white shadow-md" : "border-[#E9E4F0] bg-[#FCFBFE] text-[#373348] hover:border-[#B9A4E7]"}`}
                >
                  <span>{label}</span>
                  <span className="text-xl" aria-hidden="true">{QUESTION_EMOJIS[value]}</span>
                </button>
              );
            })}
          </div>
        </section>

        <button
          onClick={goBack}
          disabled={index === 0 || leaving}
          className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 self-start rounded-xl px-4 text-sm font-bold text-[#65568C] transition hover:bg-white/70 disabled:invisible"
        >
          <ArrowLeft size={17} aria-hidden="true" />
          {language === "si" ? "ආපසු" : "Previous question"}
        </button>
      </div>
    </main>
  );
}
