"use client";

import { useEffect, useRef, useState } from "react";
import { InflatorTrial } from "@/lib/stress/types";

const TRIAL_DURATION_MS = 10000;
const TOTAL_TRIALS = 3;
const RING_MIN = 0.45;
const RING_MAX = 0.70;
const BURST_PRESSURE = 0.95;

const BG = "#3B82F6"; // solid blue

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
  const [ready, setReady] = useState(false);

  const samples      = useRef<number[]>([]);
  const onTargetMs   = useRef(0);
  const overshoot    = useRef(0);
  const lastTick     = useRef(0);
  const rafId        = useRef(0);
  const trialStart   = useRef(0);

  const inTarget = pressure >= RING_MIN && pressure <= RING_MAX && !burst;

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    trialStart.current = performance.now();
    lastTick.current   = trialStart.current;
    samples.current    = [];
    onTargetMs.current = 0;
    overshoot.current  = 0;
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
    const arr  = samples.current;
    const avg  = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const peak = arr.length ? Math.max(...arr) : 0;
    const mean = avg;
    const jitter = arr.length > 1 ? arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length : 0;

    const trial: InflatorTrial = {
      avg_touch_pressure: avg,
      peak_pressure: peak,
      time_on_target_ms: Math.round(onTargetMs.current),
      jitter_index: jitter,
      overshoot_count: overshoot.current,
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

    if (raw >= RING_MIN && raw <= RING_MAX) onTargetMs.current += 16;
    if (raw > BURST_PRESSURE) {
      overshoot.current += 1;
      setBurst(true);
      setTimeout(() => { setPressure(0); setBurst(false); }, 700);
    }
  }

  function release() {
    if (!burst) setPressure((p) => Math.max(0, p * 0.3));
    setIsHolding(false);
  }

  const ballScale   = 0.45 + pressure * 1.15;
  const secondsLeft = Math.ceil(timeLeftMs / 1000);
  const timePct     = (timeLeftMs / TRIAL_DURATION_MS) * 100;

  // Ball color: idle=white, pressing=white/off, target=yellow, burst=red bg
  const ballBg = burst ? "#EF4444" : inTarget ? "#FFCA28" : isHolding ? "#E5E7EB" : "#FFFFFF";

  return (
    <div className="flex flex-col min-h-dvh overflow-hidden" style={{ backgroundColor: BG }}>
      {/* Header */}
      <div className="flex flex-col pt-12 px-7 pb-4 relative">
        <p className="text-xs font-bold uppercase tracking-widest text-white/50 mb-1">
          Game 2 · Precision Hold
        </p>
        <h1 className="text-4xl font-black text-white uppercase leading-tight">
          Hold inside<br />the ring
        </h1>
        {/* Trial progress pips */}
        <div className="flex gap-2 mt-4">
          {Array.from({ length: TOTAL_TRIALS }).map((_, i) => (
            <div
              key={i}
              className="h-2 w-10 rounded-full transition-all duration-400"
              style={{
                backgroundColor:
                  i < trialIndex ? "rgba(255,255,255,0.9)"
                  : i === trialIndex ? "rgba(255,255,255,0.5)"
                  : "rgba(255,255,255,0.15)",
              }}
            />
          ))}
          <span className="ml-auto text-sm font-black text-white/60 uppercase">
            Trial {trialIndex + 1}/{TOTAL_TRIALS}
          </span>
        </div>
      </div>

      {/* Timer bar */}
      <div className="mx-7 h-2 bg-white/15 rounded-full overflow-hidden mb-6">
        <div
          className="h-full rounded-full transition-all duration-100"
          style={{
            width: `${timePct}%`,
            backgroundColor: timePct > 50 ? "#FFCA28" : timePct > 20 ? "#F97316" : "#EF4444",
          }}
        />
      </div>

      {/* Ring arena */}
      <div
        className={`flex-1 flex items-center justify-center transition-all duration-500 ${ready ? "opacity-100" : "opacity-0"}`}
      >
        <div className="relative flex items-center justify-center" style={{ width: 260, height: 260 }}>
          {/* Outer ring */}
          <div
            className="absolute rounded-full border-4 transition-colors duration-200"
            style={{
              width: RING_MAX * 260,
              height: RING_MAX * 260,
              borderColor: inTarget ? "#FFCA28" : "rgba(255,255,255,0.3)",
              boxShadow: inTarget ? "0 0 0 0 rgba(255,202,40,0.4)" : "none",
              animation: inTarget ? "pulseRing 1.4s ease-in-out infinite" : "none",
            }}
          />
          {/* Inner ring — dashed */}
          <div
            className="absolute rounded-full border-2 border-dashed transition-colors duration-200"
            style={{
              width: RING_MIN * 260,
              height: RING_MIN * 260,
              borderColor: inTarget ? "rgba(255,202,40,0.6)" : "rgba(255,255,255,0.2)",
            }}
          />

          {/* Labels */}
          <span className="absolute text-[10px] font-black text-white/40 uppercase"
            style={{ top: "50%", left: `calc(50% + ${(RING_MAX * 260) / 2 + 10}px)`, transform: "translateY(-50%)" }}>
            MAX
          </span>
          <span className="absolute text-[10px] font-black text-white/40 uppercase"
            style={{ top: "50%", left: `calc(50% + ${(RING_MIN * 260) / 2 + 10}px)`, transform: "translateY(-50%)" }}>
            MIN
          </span>

          {/* The ball */}
          {!burst ? (
            <div
              onPointerDown={handlePointer}
              onPointerMove={handlePointer}
              onPointerUp={release}
              onPointerLeave={release}
              className="select-none rounded-full touch-none z-10 cursor-pointer transition-all duration-[40ms] ease-out"
              style={{
                width: 80,
                height: 80,
                backgroundColor: ballBg,
                transform: `scale(${ballScale})`,
                boxShadow: inTarget ? "0 0 24px rgba(255,202,40,0.6)" : "0 4px 16px rgba(0,0,0,0.2)",
              }}
            />
          ) : (
            /* Burst state */
            <div className="relative flex items-center justify-center">
              <div className="absolute w-24 h-24 rounded-full bg-red-400/30 halo-grow" />
              <div className="absolute w-14 h-14 rounded-full bg-red-400/50 halo-grow" style={{ animationDelay: "0.1s" }} />
              <div className="w-10 h-10 rounded-full bg-red-400 anim-scaleIn" />
            </div>
          )}
        </div>
      </div>

      {/* Bottom status */}
      <div className="px-7 pb-10">
        <div className="bg-[#1a1a1a] rounded-2xl px-6 py-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-1">Status</p>
            <p className="text-lg font-black text-white uppercase">
              {burst ? "Too hard!" : inTarget ? "On target!" : isHolding ? pressure < RING_MIN ? "Press harder" : "Ease off" : "Press & hold"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black text-white tabular-nums">{secondsLeft}s</p>
            <p className="text-xs font-bold text-white/30 uppercase tracking-widest">left</p>
          </div>
        </div>
      </div>
    </div>
  );
}
