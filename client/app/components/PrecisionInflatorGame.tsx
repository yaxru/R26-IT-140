"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { InflatorTrial } from "@/lib/types";

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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center gap-4 px-6 w-full"
    >
      <div className="text-center">
        <span className="text-xs font-semibold tracking-wide text-lilac-500 uppercase">
          Game 2 · Precision Inflator · Trial {trialIndex + 1}/{TOTAL_TRIALS}
        </span>
        <h2 className="text-lg font-semibold text-lilac-900 mt-1">
          Hold steady inside the ring
        </h2>
      </div>

      <div className="relative w-64 h-64 flex items-center justify-center">
        <div
          className="absolute rounded-full border-4 border-coral-500/70"
          style={{ width: `${RING_MAX * 220}px`, height: `${RING_MAX * 220}px` }}
        />
        <div
          className="absolute rounded-full border-2 border-dashed border-coral-300"
          style={{ width: `${RING_MIN * 220}px`, height: `${RING_MIN * 220}px` }}
        />

        <motion.div
          onPointerDown={handlePointer}
          onPointerMove={handlePointer}
          onPointerUp={release}
          onPointerLeave={release}
          animate={{ scale: burst ? 0 : balloonScale }}
          transition={{ type: "spring", stiffness: 220, damping: 18 }}
          className={`tap-target no-select w-24 h-24 rounded-full cursor-pointer shadow-soft ${
            inTarget
              ? "bg-gradient-to-br from-mint-300 to-mint-500"
              : "bg-gradient-to-br from-lilac-300 to-lilac-500"
          }`}
        />

        {burst && (
          <motion.span
            initial={{ scale: 0.5, opacity: 1 }}
            animate={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute text-5xl"
          >
            💥
          </motion.span>
        )}
      </div>

      <div className="flex items-center gap-4 text-sm text-lilac-600 font-medium">
        <span>⏱ {secondsLeft}s</span>
        <span>{inTarget ? "🎯 On target!" : "Adjust pressure"}</span>
      </div>

      <p className="text-xs text-lilac-400 text-center max-w-xs">
        Press and hold anywhere below the ring. Too hard pops the balloon, too
        light won't reach it.
      </p>
    </motion.div>
  );
}
