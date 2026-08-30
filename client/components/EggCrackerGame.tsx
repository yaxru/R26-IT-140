"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePressureCapture } from "@/lib/stress/usePressureCapture";

const EGG_COUNT = 9;
const BURST_PRESSURE = 0.72;
const BG = "#FB923C"; // solid orange
const EGG_IDLE   = "#fff";
const EGG_CRACK  = "#D1FAE5";
const EGG_BURST  = "#FEE2E2";

type EggState = "idle" | "cracked" | "burst";

interface Ripple { id: number; x: number; y: number }

export default function EggCrackerGame({
  onComplete,
}: {
  onComplete: (pressures: number[], responseTimeMs: number) => void;
}) {
  const [eggs, setEggs] = useState<EggState[]>(
    Array.from({ length: EGG_COUNT }, () => "idle")
  );
  const [shakingIdx, setShakingIdx] = useState<number | null>(null);
  const [ripples, setRipples] = useState<Ripple[][]>(
    Array.from({ length: EGG_COUNT }, () => [])
  );
  const [ready, setReady] = useState(false);

  const startTime   = useRef(performance.now());
  const firstTap    = useRef<number | null>(null);
  const rippleId    = useRef(0);
  const { record, getSamples } = usePressureCapture();

  const remaining = eggs.filter((e) => e === "idle").length;
  const done = remaining === 0;

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (done) {
      const rt = firstTap.current
        ? Math.round(firstTap.current - startTime.current)
        : 0;
      const t = setTimeout(() => onComplete(getSamples(), rt), 650);
      return () => clearTimeout(t);
    }
  }, [done, getSamples, onComplete]);

  const addRipple = useCallback((idx: number, x: number, y: number) => {
    const id = rippleId.current++;
    setRipples((prev) => {
      const next = [...prev];
      next[idx] = [...next[idx], { id, x, y }];
      return next;
    });
    setTimeout(() => {
      setRipples((prev) => {
        const next = [...prev];
        next[idx] = next[idx].filter((r) => r.id !== id);
        return next;
      });
    }, 560);
  }, []);

  function tapEgg(idx: number, e: React.PointerEvent<HTMLButtonElement>) {
    if (eggs[idx] !== "idle") return;
    if (firstTap.current === null) firstTap.current = performance.now();
    record(e);

    const rect = e.currentTarget.getBoundingClientRect();
    addRipple(idx, ((e.clientX - rect.left) / rect.width) * 100, ((e.clientY - rect.top) / rect.height) * 100);

    const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;
    const isBurst = pressure > BURST_PRESSURE;

    setShakingIdx(idx);
    setTimeout(() => setShakingIdx(null), 380);

    setTimeout(() => {
      setEggs((prev) => {
        const next = [...prev];
        next[idx] = isBurst ? "burst" : "cracked";
        return next;
      });
    }, 180);
  }

  return (
    <div className="flex flex-col min-h-dvh overflow-hidden" style={{ backgroundColor: BG }}>
      {/* Top header zone */}
      <div className="flex flex-col items-start pt-12 px-7 pb-6 relative">
        <p className="text-xs font-bold uppercase tracking-widest text-[#1a1a1a]/50 mb-1">
          Game 1 · Egg Cracker
        </p>
        <h1 className="text-4xl font-black text-[#1a1a1a] uppercase leading-tight">
          Tap gently<br />to crack
        </h1>
        {/* Pip row */}
        <div className="flex gap-1.5 mt-4">
          {Array.from({ length: EGG_COUNT }).map((_, i) => (
            <div
              key={i}
              className="h-2 w-2 rounded-full transition-all duration-300"
              style={{
                backgroundColor:
                  eggs[i] === "cracked"
                    ? "#15803D"
                    : eggs[i] === "burst"
                    ? "#DC2626"
                    : "rgba(0,0,0,0.2)",
              }}
            />
          ))}
        </div>
        <p className="text-sm font-bold text-[#1a1a1a]/60 mt-2 uppercase tracking-wide">
          {remaining} eggs left
        </p>
      </div>

      {/* Egg grid */}
      <div className="flex-1 flex items-center justify-center px-7">
        <div
          className={`grid grid-cols-3 gap-4 w-full max-w-xs transition-all duration-500 ${ready ? "opacity-100" : "opacity-0"}`}
        >
          {eggs.map((egg, idx) => (
            <button
              key={idx}
              disabled={egg !== "idle"}
              onPointerDown={(e) => tapEgg(idx, e)}
              className={`
                relative select-none aspect-square rounded-3xl flex items-center justify-center
                text-3xl touch-none overflow-hidden border-2 transition-all duration-200
                disabled:cursor-default
                ${egg === "idle" ? "active:scale-90 hover:scale-105" : ""}
                ${shakingIdx === idx ? "egg-shake" : ""}
              `}
              style={{
                backgroundColor:
                  egg === "idle" ? EGG_IDLE : egg === "cracked" ? EGG_CRACK : EGG_BURST,
                borderColor:
                  egg === "idle" ? "rgba(0,0,0,0.08)" : egg === "cracked" ? "#6EE7B7" : "#FCA5A5",
              }}
            >
              {/* Ripples */}
              {ripples[idx].map((r) => (
                <span
                  key={r.id}
                  className="absolute rounded-full ripple-enter pointer-events-none"
                  style={{
                    width: "100%",
                    height: "100%",
                    left: `${r.x}%`,
                    top: `${r.y}%`,
                    transform: "translate(-50%, -50%)",
                    background: egg === "burst" ? "rgba(220,38,38,0.25)" : "rgba(21,128,61,0.2)",
                  }}
                />
              ))}
              {/* State labels (no emoji — text only) */}
              <span
                className="absolute text-xs font-black uppercase tracking-wide transition-all duration-200"
                style={{
                  color:
                    egg === "idle"
                      ? "rgba(0,0,0,0.6)"
                      : egg === "cracked"
                      ? "#15803D"
                      : "#DC2626",
                  opacity: egg === "idle" ? 0 : 1,
                }}
              >
                {egg === "cracked" ? "✓" : egg === "burst" ? "✕" : ""}
              </span>
              {/* Egg shape — idle */}
              {egg === "idle" && (
                <div
                  className="w-8 h-10 transition-all duration-300"
                  style={{
                    backgroundColor: "#d4d4d4",
                    borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%",
                  }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom hint */}
      <div className="px-7 pb-10">
        <p className="text-xs font-bold text-[#1a1a1a]/50 uppercase tracking-widest text-center">
          Light = crack · Hard = burst
        </p>
      </div>
    </div>
  );
}
