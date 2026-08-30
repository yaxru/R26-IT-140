"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePressureCapture } from "@/lib/stress/usePressureCapture";

const EGG_COUNT = 9;
const BURST_PRESSURE = 0.72;

type EggState = "idle" | "cracked" | "burst";

interface RippleEntry {
  id: number;
  x: number;
  y: number;
}

export default function EggCrackerGame({
  onComplete,
}: {
  onComplete: (pressures: number[], responseTimeMs: number) => void;
}) {
  const [eggs, setEggs] = useState<EggState[]>(
    Array.from({ length: EGG_COUNT }, () => "idle")
  );
  const [shakingIdx, setShakingIdx] = useState<number | null>(null);
  const [ripples, setRipples] = useState<{ idx: number; entries: RippleEntry[] }[]>(
    Array.from({ length: EGG_COUNT }, (_, i) => ({ idx: i, entries: [] }))
  );
  const [introReady, setIntroReady] = useState(false);

  const startTime = useRef<number>(performance.now());
  const firstTapTime = useRef<number | null>(null);
  const rippleCounter = useRef(0);
  const { record, getSamples } = usePressureCapture();

  const remaining = eggs.filter((e) => e === "idle").length;
  const done = remaining === 0;

  useEffect(() => {
    const t = setTimeout(() => setIntroReady(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (done) {
      const responseTimeMs = firstTapTime.current
        ? Math.round(firstTapTime.current - startTime.current)
        : 0;
      const t = setTimeout(() => onComplete(getSamples(), responseTimeMs), 700);
      return () => clearTimeout(t);
    }
  }, [done, getSamples, onComplete]);

  const addRipple = useCallback(
    (idx: number, x: number, y: number) => {
      const id = rippleCounter.current++;
      setRipples((prev) =>
        prev.map((r) =>
          r.idx === idx ? { ...r, entries: [...r.entries, { id, x, y }] } : r
        )
      );
      setTimeout(() => {
        setRipples((prev) =>
          prev.map((r) =>
            r.idx === idx
              ? { ...r, entries: r.entries.filter((e) => e.id !== id) }
              : r
          )
        );
      }, 580);
    },
    []
  );

  function tapEgg(idx: number, e: React.PointerEvent<HTMLButtonElement>) {
    if (eggs[idx] !== "idle") return;

    if (firstTapTime.current === null) {
      firstTapTime.current = performance.now();
    }
    record(e);

    // Get tap position relative to the button
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    addRipple(idx, x, y);

    const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;
    const isBurst = pressure > BURST_PRESSURE;

    // Shake first, then resolve
    setShakingIdx(idx);
    setTimeout(() => setShakingIdx(null), 380);

    setTimeout(() => {
      setEggs((prev) => {
        const next = [...prev];
        next[idx] = isBurst ? "burst" : "cracked";
        return next;
      });
    }, 200);
  }

  return (
    <div className="flex flex-col min-h-dvh px-6 pt-10 pb-8 gap-6">
      {/* Header */}
      <div
        className={`text-center transition-all duration-600 ${introReady ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
      >
        <span className="text-xs font-semibold tracking-widest text-rose-400 uppercase bg-rose-50 px-4 py-1.5 rounded-full">
          Game 1 · Egg Cracker
        </span>
        <h2 className="text-xl font-bold text-slate-800 mt-4">
          Tap gently to crack each egg
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Too hard = 💥 burst! {remaining > 0 ? `${remaining} eggs left` : "All done!"}
        </p>
      </div>

      {/* Progress pip row */}
      <div className="flex justify-center gap-1.5">
        {Array.from({ length: EGG_COUNT }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 max-w-6 rounded-full transition-all duration-300 ${
              eggs[i] === "cracked"
                ? "bg-emerald-400"
                : eggs[i] === "burst"
                ? "bg-rose-400"
                : "bg-slate-200"
            }`}
          />
        ))}
      </div>

      {/* Egg grid */}
      <div
        className={`flex-1 flex items-center justify-center transition-all duration-600 ${introReady ? "opacity-100" : "opacity-0"}`}
      >
        <div className="grid grid-cols-3 gap-5 w-full max-w-xs">
          {eggs.map((egg, idx) => {
            const isShaking = shakingIdx === idx;
            const myRipples = ripples.find((r) => r.idx === idx)?.entries ?? [];

            return (
              <button
                key={idx}
                disabled={egg !== "idle"}
                onPointerDown={(e) => tapEgg(idx, e)}
                className={`
                  relative select-none aspect-square rounded-3xl flex items-center justify-center 
                  text-4xl touch-none overflow-hidden border-2 transition-all duration-200
                  disabled:cursor-default
                  ${egg === "idle"
                    ? "bg-white border-slate-100 shadow-md active:scale-90 hover:shadow-lg"
                    : egg === "cracked"
                    ? "bg-emerald-50 border-emerald-200"
                    : "bg-rose-50 border-rose-200"
                  }
                  ${isShaking ? "egg-shake" : ""}
                `}
                style={{
                  animationDelay: `${idx * 50}ms`,
                }}
              >
                {/* Ripple effects */}
                {myRipples.map((rip) => (
                  <span
                    key={rip.id}
                    className="absolute w-full h-full rounded-full ripple-enter pointer-events-none"
                    style={{
                      left: `${rip.x}%`,
                      top: `${rip.y}%`,
                      transform: "translate(-50%, -50%)",
                      background:
                        egg === "burst"
                          ? "rgba(251,113,133,0.35)"
                          : "rgba(16,185,129,0.25)",
                    }}
                  />
                ))}

                {/* Egg states */}
                <span
                  className={`absolute transition-all duration-300 ${
                    egg === "idle"
                      ? "opacity-100 scale-100"
                      : "opacity-0 scale-50"
                  }`}
                >
                  🥚
                </span>

                <span
                  className={`absolute transition-all duration-300 ${
                    egg === "cracked"
                      ? "opacity-100 scale-100 anim-popIn"
                      : "opacity-0 scale-0"
                  }`}
                >
                  🐣
                </span>

                <span
                  className={`absolute transition-all duration-200 ${
                    egg === "burst"
                      ? "opacity-100 scale-100 anim-popIn"
                      : "opacity-0 scale-0"
                  }`}
                >
                  💥
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tip */}
      <p className="text-center text-xs text-slate-400 anim-gentlePulse">
        🤏 Light touch = gentle crack · Hard press = burst
      </p>
    </div>
  );
}
