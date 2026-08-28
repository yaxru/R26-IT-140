"use client";

import { useEffect, useRef, useState } from "react";
import { usePressureCapture } from "@/lib/stress/usePressureCapture";

const EGG_COUNT = 9;
const BURST_PRESSURE = 0.75;

export default function EggCrackerGame({
  onComplete,
}: {
  onComplete: (pressures: number[], responseTimeMs: number) => void;
}) {
  const [started, setStarted] = useState(false);
  const [eggs, setEggs] = useState(
    Array.from({ length: EGG_COUNT }, () => ({ cracked: false, burst: false })),
  );
  const startTime = useRef<number>(0);
  const firstTapTime = useRef<number | null>(null);
  const { record, getSamples } = usePressureCapture();

  useEffect(() => {
    startTime.current = performance.now();
    setStarted(true);
  }, []);

  const remaining = eggs.filter((e) => !e.cracked && !e.burst).length;

  function tapEgg(idx: number, e: React.PointerEvent) {
    if (eggs[idx].cracked || eggs[idx].burst) return;

    if (firstTapTime.current === null) {
      firstTapTime.current = performance.now();
    }
    record(e);

    const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;
    const burst = pressure > BURST_PRESSURE;

    setEggs((prev) => {
      const next = [...prev];
      next[idx] = { cracked: !burst, burst };
      return next;
    });
  }

  useEffect(() => {
    if (remaining === 0 && started) {
      const responseTimeMs = firstTapTime.current
        ? Math.round(firstTapTime.current - startTime.current)
        : 0;
      const timeout = setTimeout(() => {
        onComplete(getSamples(), responseTimeMs);
      }, 600);
      return () => clearTimeout(timeout);
    }
  }, [remaining, started, getSamples, onComplete]);

  return (
    <div className="flex flex-col items-center justify-center gap-10 px-6 w-full h-full animate-in fade-in duration-500">
      <div className="text-center">
        <span className="text-xs font-medium tracking-widest text-slate-400 uppercase">
          Game 1 · Egg Cracker
        </span>
        <h2 className="text-xl font-medium text-slate-700 mt-2">
          Tap gently to crack each egg 🥚
        </h2>
        <p className="text-sm text-slate-500 mt-2">{remaining} eggs left</p>
      </div>

      <div className="grid grid-cols-3 gap-5 w-full max-w-xs">
        {eggs.map((egg, idx) => (
          <button
            key={idx}
            disabled={egg.cracked || egg.burst}
            onPointerDown={(e) => tapEgg(idx, e)}
            className="select-none aspect-square rounded-[2rem] bg-white shadow-sm border border-slate-100 flex items-center justify-center text-4xl transition-all duration-200 active:scale-90 disabled:cursor-default"
          >
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-[2rem]">
              <span
                className={`absolute transition-all duration-300 ${
                  egg.burst ? "scale-[1.5] opacity-100" : "scale-0 opacity-0"
                }`}
              >
                💥
              </span>
              <span
                className={`absolute transition-all duration-300 ${
                  egg.cracked
                    ? "scale-100 opacity-100 rotate-0"
                    : "scale-[0.5] opacity-0 -rotate-12"
                }`}
              >
                🐣
              </span>
              <span
                className={`absolute transition-all duration-200 ${
                  egg.cracked || egg.burst
                    ? "scale-50 opacity-0"
                    : "scale-100 opacity-100"
                }`}
              >
                🥚
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
