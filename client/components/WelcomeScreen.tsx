"use client";

import { useEffect, useState } from "react";
import { BlobCharacter } from "./BlobCharacter";
import { Language } from "@/lib/stress/types";
import { getStressCopy } from "@/lib/stress/translations";

const BG = "#FFCA28";
const BLOB = "#FFB300";
const BOTTOM = "#1a1a1a";

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
    const t = setTimeout(() => setReady(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="flex flex-col h-dvh w-full overflow-hidden relative"
      style={{ backgroundColor: BG }}
    >
      <div className="absolute inset-0 pattern-waves opacity-20 mix-blend-overlay pointer-events-none" />

      {/* ── Top: character zone ───────────────────────────── */}
      <div className="flex-1 w-full flex flex-col relative z-10">
        <div className="w-full max-w-md mx-auto flex-1 flex flex-col items-center justify-end pb-4 relative">
          <p
            className="absolute top-6 left-6 text-xs font-bold uppercase tracking-widest opacity-60"
            style={{ color: BOTTOM }}
          >
            {copy.wellBeingCheck}
          </p>

          <div
            className={`transition-all duration-500 z-10 ${ready ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
          >
            <BlobCharacter mood="happy" color={BLOB} />
          </div>
        </div>
      </div>

      {/* ── Bottom: content zone ──────────────────────────── */}
      <div className="h-[50%] shrink-0 w-full bg-[#1a1a1a] relative z-20">
        <div
          className={`w-full max-w-md mx-auto h-full px-6 py-6 flex flex-col items-center justify-center text-center transition-all duration-500 delay-100 ${ready ? "opacity-100" : "opacity-0"}`}
        >
          <div className="mb-3 flex w-full items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white/50 uppercase tracking-widest">
              {copy.greeting} {workerName || copy.greetingFallback} —
            </p>
            <label className="flex items-center gap-2 text-xs font-bold text-white/60">
              <span>{copy.language}</span>
              <select
                aria-label={copy.language}
                value={language}
                onChange={(event) =>
                  onLanguageChange(event.target.value === "si" ? "si" : "en")
                }
                className="rounded-lg border border-white/20 bg-[#292929] px-2 py-1.5 text-white"
              >
                <option value="en">{copy.english}</option>
                <option value="si">{copy.sinhala}</option>
              </select>
            </label>
          </div>

          <h1 className="text-4xl font-black text-white leading-[1.05] mb-4 shrink-0">
            {copy.welcomeTitle}
          </h1>

          <div className="flex flex-wrap justify-center gap-2 mb-6 shrink-0">
            {copy.welcomeStats.map((t) => (
              <span
                key={t}
                className="text-xs font-semibold text-white/60 border border-white/20 rounded-full px-3 py-1"
              >
                {t}
              </span>
            ))}
          </div>

          <button
            onClick={onBegin}
            className="select-none shrink-0 w-full font-black text-lg py-4 rounded-2xl uppercase tracking-wide transition-all duration-150 active:scale-95"
            style={{ backgroundColor: BG, color: BOTTOM }}
          >
            {copy.begin}
          </button>
        </div>
      </div>
    </div>
  );
}
