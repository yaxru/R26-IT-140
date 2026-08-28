"use client";

import { useEffect, useRef, useState } from "react";
import { InflatorTrial } from "@/lib/stress/types";

const TRIAL_DURATION_MS = 10000;
const TOTAL_TRIALS = 3;
const RING_MIN = 0.45;
const RING_MAX = 0.7;
const BURST_PRESSURE = 0.95;

export default function PrecisionInflatorGame({
  onComplete,
}: {
  onComplete: (trials: InflatorTrial[]) => void;
}) {
  const [trialIndex, setTrialIndex] = useState(0);
  const [pressure, setPressure] = useState(0);
  const [burst, setBurst] = useState(false);
  const [timeLeftMs, setTimeLeftMs] = useState(TRIAL_DURATION_MS);
  const [trials, setTrials] = useState<InflatorTrial[]>([]);

  const samples = useRef<number[]>([]);
  const onTargetMs = useRef(0);
  const overshootCount = useRef(0);
  const lastTick = useRef<number>(0);
  const rafId = useRef<number>(0);
  const trialStart = useRef<number>(0);

  const inTarget = pressure >= RING_MIN && pressure <= RING_MAX && !burst;

  useEffect(() => {
    trialStart.current = performance.now();
    lastTick.current = trialStart.current;
    samples.current = [];
    onTargetMs.current = 0;
    overshootCount.current = 0;
    setBurst(false);
    setPressure(0);
    setTimeLeftMs(TRIAL_DURATION_MS);

    function tick() {
      const now = performance.now();
      const delta = now - lastTick.current;
      lastTick.current = now;

      const elapsed = now - trialStart.current;
      setTimeLeftMs(Math.max(0, TRIAL_DURATION_MS - elapsed));

      if (elapsed >= TRIAL_DURATION_MS) {
        finishTrial();
        return;
      }
      rafId.current = requestAnimationFrame(tick);
    }
    rafId.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trialIndex]);

  function finishTrial() {
    const arr = samples.current;
    const avg = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const peak = arr.length ? Math.max(...arr) : 0;
    const mean = avg;
    const jitter =
      arr.length > 1
        ? arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length
        : 0;

    const trial: InflatorTrial = {
      avg_touch_pressure: avg,
      peak_pressure: peak,
      time_on_target_ms: Math.round(onTargetMs.current),
      jitter_index: jitter,
      overshoot_count: overshootCount.current,
    };

    const next = [...trials, trial];
    setTrials(next);

    if (trialIndex + 1 >= TOTAL_TRIALS) {
      onComplete(next);
    } else {
      setTrialIndex((i) => i + 1);
    }
  }

  function handlePointer(e: React.PointerEvent) {
    if (burst) return;
    const raw = e.pressure && e.pressure > 0 ? e.pressure : 0.5;
    samples.current.push(raw);
    setPressure(raw);

    if (raw >= RING_MIN && raw <= RING_MAX) {
      onTargetMs.current += 16;
    }
    if (raw > BURST_PRESSURE) {
      overshootCount.current += 1;
      setBurst(true);
      setTimeout(() => setPressure(0), 400);
    }
  }

  function release() {
    if (!burst) setPressure((p) => Math.max(0, p * 0.3));
  }

  const balloonScale = 0.5 + pressure * 1.1;
  const secondsLeft = Math.ceil(timeLeftMs / 1000);

  return (
    <div className="flex flex-col items-center justify-center gap-8 px-6 w-full h-full animate-in fade-in duration-500">
      <div className="text-center">
        <span className="text-xs font-medium tracking-widest text-slate-400 uppercase">
          Game 2 · Precision Inflator · Trial {trialIndex + 1} of {TOTAL_TRIALS}
        </span>
        <h2 className="text-xl font-medium text-slate-700 mt-2">
          Hold steady inside the ring
        </h2>
      </div>

      <div className="relative w-64 h-64 flex items-center justify-center">
        {/* Outer boundary */}
        <div
          className={`absolute rounded-full border-[3px] transition-colors duration-300 ${
            burst
              ? "border-rose-400/80"
              : inTarget
                ? "border-indigo-300"
                : "border-slate-300/80"
          }`}
          style={{
            width: `${RING_MAX * 220}px`,
            height: `${RING_MAX * 220}px`,
          }}
        />
        {/* Inner boundary */}
        <div
          className={`absolute rounded-full border-2 border-dashed transition-colors duration-300 ${
            burst
              ? "border-rose-300/50"
              : inTarget
                ? "border-indigo-300/70"
                : "border-slate-300/60"
          }`}
          style={{
            width: `${RING_MIN * 220}px`,
            height: `${RING_MIN * 220}px`,
          }}
        />

        <div
          onPointerDown={handlePointer}
          onPointerMove={handlePointer}
          onPointerUp={release}
          onPointerLeave={release}
          className={`select-none w-24 h-24 rounded-full cursor-pointer shadow-md transition-all duration-[50ms] ease-out flex items-center justify-center text-4xl touch-none ${
            inTarget
              ? "bg-gradient-to-br from-indigo-300 to-indigo-500 shadow-indigo-200"
              : "bg-gradient-to-br from-slate-200 to-slate-400"
          }`}
          style={{
            transform: `scale(${burst ? 0 : balloonScale})`,
            opacity: burst ? 0 : 1,
          }}
        >
          {burst && (
            <span className="absolute animate-[ping_0.4s_ease-out_forwards] text-5xl">
              💥
            </span>
          )}
        </div>
      </div>

      <div className="text-center mt-4">
        <p className="text-3xl font-light text-slate-700 tabular-nums font-mono">
          {secondsLeft}s
        </p>
        <p className="text-xs text-slate-400 mt-1 font-medium tracking-wide uppercase">
          remaining
        </p>
      </div>
    </div>
  );
}
