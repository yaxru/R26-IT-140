"use client";

import { useEffect, useState } from "react";
import { BlobCharacter } from "./BlobCharacter";

// Screen bg: warm yellow. Character: deeper amber.
const BG = "#FFCA28";
const BLOB = "#FFB300";
const BOTTOM = "#1a1a1a";

export default function WelcomeScreen({
  workerName,
  onBegin,
}: {
  workerName: string;
  onBegin: () => void;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-col min-h-dvh overflow-hidden" style={{ backgroundColor: BG }}>
      {/* ── Top: character zone ───────────────────────────── */}
      <div
        className="flex-1 flex flex-col items-center justify-end pb-8 pt-14 relative"
        style={{ backgroundColor: BG }}
      >
        {/* Small label top-left */}
        <p
          className="absolute top-6 left-6 text-xs font-bold uppercase tracking-widest opacity-60"
          style={{ color: BOTTOM }}
        >
          Well-being check
        </p>

        <div
          className={`transition-all duration-500 ${ready ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
        >
          <BlobCharacter mood="happy" color={BLOB} />
        </div>
      </div>

      {/* ── Bottom: content zone ──────────────────────────── */}
      <div
        className={`shrink-0 px-7 pt-8 pb-10 transition-all duration-500 delay-100 ${ready ? "opacity-100" : "opacity-0"}`}
        style={{ backgroundColor: BOTTOM }}
      >
        {/* Greeting */}
        <p className="text-sm font-semibold text-white/50 mb-1 uppercase tracking-widest">
          Hi {workerName || "there"} —
        </p>

        {/* Main headline — BIG bold like the reference */}
        <h1 className="text-4xl font-black text-white leading-[1.05] uppercase mb-6">
          How are<br />you doing<br />today?
        </h1>

        {/* Meta row */}
        <div className="flex flex-wrap gap-2 mb-8">
          {["10 questions", "2 mini-games", "~7 min"].map((t) => (
            <span
              key={t}
              className="text-xs font-semibold text-white/60 border border-white/20 rounded-full px-3 py-1"
            >
              {t}
            </span>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={onBegin}
          className="select-none w-full font-black text-lg py-5 rounded-2xl uppercase tracking-wide transition-all duration-150 active:scale-95"
          style={{ backgroundColor: BG, color: BOTTOM }}
        >
          Let's Begin
        </button>

        <p className="text-center text-xs text-white/30 mt-4 leading-relaxed">
          🔒 Private · never affects your work record
        </p>
      </div>
    </div>
  );
}
