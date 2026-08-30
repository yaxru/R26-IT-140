"use client";

import { useEffect, useState } from "react";
import { BlobCharacter } from "./BlobCharacter";

const BG = "#10B981"; // solid emerald/green
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
    <div
      className="flex flex-col h-dvh w-full overflow-hidden relative"
      style={{ backgroundColor: BG }}
    >
      <div className="absolute inset-0 pattern-waves opacity-20 mix-blend-overlay pointer-events-none" />

      {/* Character zone */}
      <div className="flex-1 w-full flex flex-col relative z-10">
        <div className="w-full max-w-md mx-auto flex-1 flex flex-col items-center justify-end pb-4 relative">
          <p className="absolute top-6 left-6 text-xs font-bold uppercase tracking-widest text-black/40">
            All done!
          </p>
          <div
            className={`transition-all duration-600 ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
          >
            <BlobCharacter mood="done" color={BLOB} />
          </div>
        </div>
      </div>

      {/* Content zone */}
      <div
        className={`h-[50%] shrink-0 w-full bg-[#1a1a1a] relative z-20 transition-all duration-500 delay-150 ${show ? "opacity-100" : "opacity-0"}`}
      >
        <div className="w-full max-w-md mx-auto h-full px-6 py-6 flex flex-col items-center justify-center text-center">
          <h1 className="text-4xl font-black text-white uppercase leading-tight mb-2 shrink-0">
            You crushed it.
          </h1>
          <p className="text-sm text-white/50 mb-6 leading-relaxed shrink-0">
            Your responses have been recorded securely. No further action
            needed.
          </p>

          {/* Stats row */}
          <div className="flex gap-3 mb-6 w-full shrink-0">
            {[
              { label: "Questions", value: "10/10" },
              { label: "Games", value: "2/2" },
              { label: "Submitted", value: "✓" },
            ].map((s) => (
              <div
                key={s.label}
                className="flex-1 rounded-2xl py-4 text-center"
                style={{ backgroundColor: BG + "33" }}
              >
                <p className="text-xl font-black text-white">{s.value}</p>
                <p className="text-xs font-bold text-white/50 uppercase tracking-wider mt-0.5">
                  {s.label}
                </p>
              </div>
            ))}
          </div>

          {onRestart && (
            <button
              onClick={onRestart}
              className="select-none shrink-0 w-full py-4 rounded-2xl text-sm font-black uppercase tracking-widest text-[#1a1a1a] transition-all duration-150 active:scale-95"
              style={{ backgroundColor: BG }}
            >
              Return to Dashboard
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
