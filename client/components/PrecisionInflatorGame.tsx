"use client";

import { useEffect, useRef, useState } from "react";
import { InflatorTrial } from "@/lib/stress/types";

const TRIAL_DURATION_MS = 10000;
const TOTAL_TRIALS = 3;
const RING_MIN = 0.45;
const RING_MAX = 0.70;
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
  const [isHolding, setIsHolding] = useState(false);
  const [introReady, setIntroReady] = useState(false);

  const samples = useRef<number[]>([]);
  const onTargetMs = useRef(0);
  const overshootCount = useRef(0);
  const lastTick = useRef<number>(0);
  const rafId = useRef<number>(0);
  const trialStart = useRef<number>(0);

  const inTarget = pressure >= RING_MIN && pressure <= RING_MAX && !burst;

  useEffect(() => {
    const t = setTimeout(() => setIntroReady(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    trialStart.current = performance.now();
    lastTick.current = trialStart.current;
    samples.current = [];
    onTargetMs.current = 0;
    overshootCount.current = 0;
    setBurst(false);
    setPressure(0);
    setIsHolding(false);
    setTimeLeftMs(TRIAL_DURATION_MS);

    function tick() {
      const now = performance.now();
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
    setIsHolding(true);

    if (raw >= RING_MIN && raw <= RING_MAX) {
      onTargetMs.current += 16;
    }
    if (raw > BURST_PRESSURE) {
      overshootCount.current += 1;
      setBurst(true);
      setTimeout(() => {
        setPressure(0);
        setBurst(false);
      }, 600);
    }
  }

  function release() {
    if (!burst) setPressure((p) => Math.max(0, p * 0.3));
    setIsHolding(false);
  }

  const balloonScale = 0.45 + pressure * 1.15;
  const secondsLeft = Math.ceil(timeLeftMs / 1000);
  const timePct = (timeLeftMs / TRIAL_DURATION_MS) * 100;

  // Ring sizes in px (based on 280px container)
  const CONTAINER = 280;
  const outerRingPx = RING_MAX * CONTAINER;
  const innerRingPx = RING_MIN * CONTAINER;

  return (
    <div className="flex flex-col min-h-dvh px-6 pt-10 pb-8 gap-6">
      {/* Header */}
      <div
        className={`text-center transition-all duration-600 ${introReady ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
      >
        {/* Trial pips */}
        <div className="flex justify-center gap-2 mb-4">
          {Array.from({ length: TOTAL_TRIALS }).map((_, i) => (
            <div
              key={i}
              className={`h-2 w-8 rounded-full transition-all duration-500 ${
                i < trialIndex
                  ? "bg-emerald-400"
                  : i === trialIndex
                  ? "bg-teal-400 anim-gentlePulse"
                  : "bg-slate-200"
              }`}
            />
          ))}
        </div>

        <span className="text-xs font-semibold tracking-widest text-teal-500 uppercase bg-teal-50 px-4 py-1.5 rounded-full">
          Game 2 · Precision Hold · Trial {trialIndex + 1} of {TOTAL_TRIALS}
        </span>
        <h2 className="text-xl font-bold text-slate-800 mt-4">
          Press & hold inside the ring
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Too hard = pop! Too soft = won't reach.
        </p>
      </div>

      {/* Time bar */}
      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-100 ${
            timePct > 50
              ? "bg-gradient-to-r from-teal-400 to-cyan-500"
              : timePct > 20
              ? "bg-gradient-to-r from-amber-400 to-orange-400"
              : "bg-gradient-to-r from-rose-400 to-red-500"
          }`}
          style={{ width: `${timePct}%` }}
        />
      </div>

      {/* Main interaction area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        {/* Ring arena */}
        <div
          className="relative flex items-center justify-center"
          style={{ width: CONTAINER, height: CONTAINER }}
        >
          {/* Outer ring */}
          <div
            className={`absolute rounded-full border-[3px] transition-colors duration-300 ${
              burst
                ? "border-rose-400"
                : inTarget
                ? "border-teal-400"
                : "border-slate-200"
            } ${inTarget && !burst ? "anim-pulseRing" : ""}`}
            style={{ width: outerRingPx, height: outerRingPx }}
          />

          {/* Outer ring label */}
          <div
            className="absolute text-[10px] font-semibold text-slate-400"
            style={{ top: "50%", left: `calc(50% + ${outerRingPx / 2 + 6}px)`, transform: "translateY(-50%)" }}
          >
            MAX
          </div>

          {/* Inner ring */}
          <div
            className={`absolute rounded-full border-2 border-dashed transition-colors duration-300 ${
              burst
                ? "border-rose-300/50"
                : inTarget
                ? "border-teal-300/80"
                : "border-slate-200/70"
            }`}
            style={{ width: innerRingPx, height: innerRingPx }}
          />

          {/* Inner ring label */}
          <div
            className="absolute text-[10px] font-semibold text-slate-400"
            style={{ top: "50%", left: `calc(50% + ${innerRingPx / 2 + 6}px)`, transform: "translateY(-50%)" }}
          >
            MIN
          </div>

          {/* "In target" flash zone */}
          {inTarget && (
            <div
              className="absolute rounded-full bg-teal-300/20 transition-all duration-100 pointer-events-none"
              style={{
                width: outerRingPx - 6,
                height: outerRingPx - 6,
              }}
            />
          )}

          {/* Balloon / ball */}
          {!burst ? (
            <div
              onPointerDown={handlePointer}
              onPointerMove={handlePointer}
              onPointerUp={release}
              onPointerLeave={release}
              className={`
                select-none rounded-full cursor-pointer touch-none z-10
                transition-all duration-[50ms] ease-out flex items-center justify-center
                ${inTarget
                  ? "bg-gradient-to-br from-teal-300 to-cyan-500 shadow-2xl shadow-teal-300/50"
                  : isHolding
                  ? "bg-gradient-to-br from-violet-300 to-purple-400 shadow-xl shadow-purple-200/50"
                  : "bg-gradient-to-br from-slate-200 to-slate-300 shadow-md"
                }
              `}
              style={{
                width: 80,
                height: 80,
                transform: `scale(${balloonScale})`,
              }}
            >
              {/* Shine */}
              <div className="w-5 h-5 rounded-full bg-white/30 absolute top-3 left-4" />
            </div>
          ) : (
            /* Burst explosion */
            <div className="relative flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-rose-200 halo-grow absolute" />
              <div className="w-12 h-12 rounded-full bg-rose-300 halo-grow absolute" style={{ animationDelay: "0.1s" }} />
              <span className="text-5xl anim-popIn z-10">💥</span>
            </div>
          )}
        </div>

        {/* Status */}
        <div className="text-center">
          {inTarget ? (
            <p className="text-teal-500 font-bold text-sm anim-popIn">✓ On target! Hold it!</p>
          ) : burst ? (
            <p className="text-rose-500 font-bold text-sm anim-popIn">💥 Too hard! Next trial…</p>
          ) : isHolding ? (
            <p className="text-violet-500 font-medium text-sm">
              {pressure < RING_MIN ? "Press harder ↑" : "Ease off ↓"}
            </p>
          ) : (
            <p className="text-slate-400 text-sm anim-gentlePulse">Press & hold the circle</p>
          )}
        </div>

        {/* Timer */}
        <div className="text-center">
          <p className="text-4xl font-bold tabular-nums text-slate-700 font-mono">{secondsLeft}s</p>
          <p className="text-xs text-slate-400 uppercase tracking-wider mt-1">remaining</p>
        </div>
      </div>
    </div>
  );
}
