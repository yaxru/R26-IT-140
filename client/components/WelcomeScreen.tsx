"use client";

import { useEffect, useState } from "react";
import { BlobCharacter } from "./BlobCharacter";

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
            Well-being check
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
          <p className="text-sm font-semibold text-white/50 mb-1 uppercase tracking-widest shrink-0">
            Hi {workerName || "there"} —
          </p>

          <h1 className="text-4xl font-black text-white leading-[1.05] uppercase mb-4 shrink-0">
            How are
            <br />
            you doing
            <br />
            today?
          </h1>

          <div className="flex flex-wrap justify-center gap-2 mb-6 shrink-0">
            {["10 questions", "2 mini-games", "~7 min"].map((t) => (
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
            Let's Begin
          </button>
        </div>
      </div>
    </div>
  );
}
