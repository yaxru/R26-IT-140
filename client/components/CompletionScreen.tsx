"use client";

import { useEffect, useState } from "react";
import { BlobCharacter } from "./BlobCharacter";

const BG   = "#10B981"; // solid emerald/green
const BLOB = "#059669";

export default function CompletionScreen({
  onRestart,
}: {
  onRestart?: () => void;
}) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-col min-h-dvh overflow-hidden" style={{ backgroundColor: BG }}>
      {/* Character zone */}
      <div className="flex-1 flex flex-col items-center justify-end pb-6 pt-12 relative">
        <p className="absolute top-6 left-6 text-xs font-bold uppercase tracking-widest text-[#1a1a1a]/40">
          All done!
        </p>
        <div
          className={`transition-all duration-600 ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
        >
          <BlobCharacter mood="done" color={BLOB} />
        </div>
      </div>

      {/* Content zone */}
      <div
        className={`shrink-0 bg-[#1a1a1a] px-7 pt-8 pb-10 transition-all duration-500 delay-150 ${show ? "opacity-100" : "opacity-0"}`}
      >
        <h1 className="text-4xl font-black text-white uppercase leading-tight mb-2">
          You crushed it.
        </h1>
        <p className="text-sm text-white/50 mb-6 leading-relaxed">
          Your responses have been recorded securely. No further action needed.
        </p>

        {/* Stats row */}
        <div className="flex gap-3 mb-6">
          {[
            { label: "Questions", value: "10/10" },
            { label: "Games", value: "2/2" },
            { label: "Submitted", value: "✓" },
          ].map((s) => (
            <div
              key={s.label}
              className="flex-1 rounded-2xl py-4 text-center"
              style={{ backgroundColor: BG + "33" }} // bg with opacity
            >
              <p className="text-xl font-black text-white">{s.value}</p>
              <p className="text-xs font-bold text-white/50 uppercase tracking-wider mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Lock badge */}
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-5 py-3 mb-6">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: BG }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <p className="text-xs text-white/50 leading-relaxed">
            Your data is private and will never affect your work record.
          </p>
        </div>

        {onRestart && (
          <button
            onClick={onRestart}
            className="select-none w-full py-4 rounded-2xl text-sm font-black uppercase tracking-widest text-[#1a1a1a] transition-all duration-150 active:scale-95"
            style={{ backgroundColor: BG }}
          >
            Return to Dashboard
          </button>
        )}
      </div>
    </div>
  );
}
