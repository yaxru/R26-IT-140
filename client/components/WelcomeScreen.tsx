"use client";

import { useEffect, useState } from "react";
import { ArrowRight, HeartHandshake, Languages, Sparkles } from "lucide-react";
import { Language } from "@/lib/stress/types";
import { getStressCopy } from "@/lib/stress/translations";

export default function WelcomeScreen({
  workerName,
  language,
  onLanguageChange,
  onBegin,
}: {
  workerName: string;
  language: Language;
  onLanguageChange: (language: Language) => void;
  onBegin: () => void;
}) {
  const copy = getStressCopy(language);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 60);
    return () => clearTimeout(timer);
  }, []);

  return (
    <main className="min-h-dvh bg-[#FFF8E7] text-[#20243A]">
      <section className="relative flex min-h-[38dvh] flex-col overflow-hidden bg-[#FFD84D] px-5 pb-10 pt-[calc(env(safe-area-inset-top)+2.5rem)] sm:px-8">
        <div aria-hidden="true" className="absolute -right-12 -top-16 h-56 w-56 rounded-full bg-[#FF9D2E]/45" />
        <div aria-hidden="true" className="absolute -bottom-20 left-8 h-44 w-44 rounded-full bg-[#FFEF9A]/80" />
        <div className="relative z-10 mx-auto flex w-full max-w-xl items-center justify-between gap-3">
          <span className="rounded-full bg-white/60 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.12em]">
            {copy.wellBeingCheck}
          </span>
          <label className="flex items-center gap-2 rounded-full bg-[#20243A] px-3 py-2 text-xs font-bold text-white shadow-sm">
            <Languages size={16} aria-hidden="true" />
            <span className="sr-only">{copy.language}</span>
            <select
              aria-label={copy.language}
              value={language}
              onChange={(event) =>
                onLanguageChange(event.target.value === "si" ? "si" : "en")
              }
              className="max-w-28 bg-transparent text-white outline-none"
            >
              <option className="text-[#20243A]" value="en">{copy.english}</option>
              <option className="text-[#20243A]" value="si">{copy.sinhala}</option>
            </select>
          </label>
        </div>

        <div className={`relative z-10 mx-auto mt-auto w-full max-w-xl pt-8 transition-all duration-500 ${ready ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`}>
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-[#FF9D2E] text-white shadow-lg shadow-orange-900/10">
            <HeartHandshake size={34} strokeWidth={2.5} aria-hidden="true" />
          </div>
          <p className="text-sm font-bold text-[#57451C]">
            {copy.greeting} {workerName || copy.greetingFallback}
          </p>
          <h1 className="mt-2 max-w-lg text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl">
            {copy.welcomeTitle}
          </h1>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-xl flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-6 sm:px-8">
        <div className="mb-6 flex flex-wrap gap-2">
          {copy.welcomeStats.map((stat) => (
            <span
              key={stat}
              className="rounded-full border border-[#E8DDBF] bg-white px-3 py-2 text-xs font-bold text-[#514B3D]"
            >
              {stat}
            </span>
          ))}
        </div>
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[#F1DE9C] bg-[#FFF1BD] p-4 text-sm font-medium leading-relaxed text-[#514B3D]">
          <Sparkles className="mt-0.5 shrink-0 text-[#E89118]" size={18} aria-hidden="true" />
          <p>{copy.welcomePrompt}</p>
        </div>
        <button
          onClick={onBegin}
          className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#20243A] px-6 py-4 text-base font-extrabold text-white shadow-lg shadow-indigo-950/15 transition hover:bg-[#303657] active:scale-[0.99] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF9D2E]"
        >
          {copy.begin}
          <ArrowRight size={20} aria-hidden="true" />
        </button>
      </section>
    </main>
  );
}
