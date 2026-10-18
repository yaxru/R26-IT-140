"use client";

import { useEffect, useState } from "react";
import { Check, Heart, Sparkles } from "lucide-react";
import { Language } from "@/lib/stress/types";
import { getStressCopy } from "@/lib/stress/translations";

export default function CompletionScreen({
  language,
  onRestart,
}: {
  language: Language;
  onRestart?: () => void;
}) {
  const copy = getStressCopy(language);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 60);
    return () => clearTimeout(timer);
  }, []);

  const stats = [
    { label: copy.questionsStat, value: "10/10" },
    { label: copy.gamesStat, value: "2/2" },
    { label: copy.submittedStat, value: "✓" },
  ];

  return (
    <main className="min-h-dvh bg-[#E1F7E9] px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+2rem)] text-[#18392A] sm:px-8">
      <div className={`mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-xl flex-col transition-all duration-500 ${show ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`}>
        <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
          <div className="relative mb-6 flex h-28 w-28 items-center justify-center rounded-[2rem] bg-[#38B876] text-white shadow-xl shadow-emerald-900/15">
            <Check size={58} strokeWidth={3} aria-hidden="true" />
            <Sparkles className="absolute -right-3 -top-3 text-[#F2B632]" size={28} fill="currentColor" aria-hidden="true" />
          </div>
          <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.15em] text-[#38855C]">
            {copy.completeLabel}
          </p>
          <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl">
            {copy.completeTitle}
          </h1>
          <p className="mt-4 max-w-md text-base font-medium leading-relaxed text-[#4D6B5B]">
            {copy.completeText}
          </p>
        </div>

        <section className="mb-6 grid grid-cols-3 gap-2.5">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-[#C8E9D4] bg-white px-2 py-4 text-center shadow-sm"
            >
              <p className="text-2xl font-black text-[#258455]">{stat.value}</p>
              <p className="mt-1 text-[10px] font-extrabold uppercase tracking-wide text-[#6C8979] sm:text-xs">
                {stat.label}
              </p>
            </div>
          ))}
        </section>

        <div className="mb-5 flex items-center justify-center gap-2 text-xs font-semibold text-[#538067]">
          <Heart size={15} fill="currentColor" aria-hidden="true" />
          {language === "si" ? "ඔබගේ කාලයට ස්තුතියි" : "Thanks for taking the time"}
        </div>
        {onRestart && (
          <button
            onClick={onRestart}
            className="min-h-14 w-full rounded-2xl bg-[#18392A] px-6 py-4 text-base font-extrabold text-white shadow-lg transition hover:bg-[#24563E] active:scale-[0.99] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#38B876]"
          >
            {language === "si" ? "ආපසු" : "Return to Dashboard"}
          </button>
        )}
      </div>
    </main>
  );
}
