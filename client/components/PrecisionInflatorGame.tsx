"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { InflatorTrial, Language } from "@/lib/stress/types";
import { getStressCopy } from "@/lib/stress/translations";

const TRIAL_DURATION_MS = 10000;
const TOTAL_TRIALS = 3;
const RING_MIN = 0.45;
const RING_MAX = 0.70;
const BURST_PRESSURE = 0.95;

const BG = "#3B82F6"; // solid blue

export default function PrecisionInflatorGame({
  language,
  onComplete,
}: {
  language: Language;
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
  const pointerId    = useRef<number | null>(null);
  const pressureRef  = useRef(0);
  const burstRef     = useRef(false);
  const copy = getStressCopy(language);

  const inTarget = pressure >= RING_MIN && pressure <= RING_MAX && !burst;

  const finishTrial = useCallback(() => {
    const arr  = samples.current;
    const avg  = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const peak = arr.length ? Math.max(...arr) : 0;
    const jitter = arr.length > 1
      ? arr.reduce((a, b) => a + (b - avg) ** 2, 0) / arr.length
      : 0;

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
      setPressure(0);
      setIsHolding(false);
      setTimeLeftMs(TRIAL_DURATION_MS);
      setTrialIndex((i) => i + 1);
    }
  }, [onComplete, trialIndex, trials]);

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
    burstRef.current = false;
    pressureRef.current = 0;
    pointerId.current = null;

    function tick() {
      const now = performance.now();
      const elapsedSinceTick = now - lastTick.current;
      lastTick.current = now;
      const elapsed = now - trialStart.current;
      if (
        pointerId.current !== null &&
        pressureRef.current >= RING_MIN &&
        pressureRef.current <= RING_MAX &&
        !burstRef.current
      ) {
        onTargetMs.current += elapsedSinceTick;
      }
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

  function samplePressure(raw: number) {
    if (burstRef.current) return;
    samples.current.push(raw);
    pressureRef.current = raw;
    setPressure(raw);
    setIsHolding(true);

    if (raw > BURST_PRESSURE) {
      overshoot.current += 1;
      burstRef.current = true;
      pointerId.current = null;
      setBurst(true);
      setIsHolding(false);
      pressureRef.current = 0;
      setTimeout(() => {
        setPressure(0);
        burstRef.current = false;
        setBurst(false);
      }, 700);
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (burstRef.current) return;
    pointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    samplePressure(
      e.pointerType === "mouse" || e.pressure <= 0 ? 0.58 : e.pressure,
    );
  }

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (pointerId.current !== e.pointerId) return;
    samplePressure(
      e.pointerType === "mouse" || e.pressure <= 0 ? 0.58 : e.pressure,
    );
  }

  function release() {
    pointerId.current = null;
    pressureRef.current = 0;
    if (!burstRef.current) setPressure(0);
    setIsHolding(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if ((e.key === " " || e.key === "Enter") && !e.repeat) {
      e.preventDefault();
      pointerId.current = -1;
      samplePressure(0.58);
    }
  }

  function handleKeyUp(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === " " || e.key === "Enter") release();
  }

  const ballScale   = 0.45 + pressure * 1.15;
  const secondsLeft = Math.ceil(timeLeftMs / 1000);
  const timePct     = (timeLeftMs / TRIAL_DURATION_MS) * 100;

  const ballBg = burst ? "#EF4444" : inTarget ? "#FFCA28" : isHolding ? "#E5E7EB" : "#FFFFFF";

  return (
    <div className="flex flex-col h-full overflow-hidden relative" style={{ backgroundColor: BG }}>
      <div className="absolute inset-0 pattern-stripes opacity-20 mix-blend-overlay pointer-events-none" />

      <div className="absolute top-6 left-6 right-6 z-20 flex gap-2">
        {Array.from({ length: TOTAL_TRIALS }).map((_, i) => (
          <div
            key={i}
            className="h-2 flex-1 rounded-full transition-all duration-400"
            style={{
              backgroundColor:
                i < trialIndex ? "rgba(255,255,255,0.9)"
                : i === trialIndex ? "rgba(255,255,255,0.5)"
                : "rgba(255,255,255,0.15)",
            }}
          />
        ))}
      </div>

      <div className="absolute top-12 left-6 right-6 z-20 h-1.5 bg-black/20 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-100"
          style={{ width: `${timePct}%`, backgroundColor: timePct > 50 ? "#FFCA28" : timePct > 20 ? "#F97316" : "#EF4444" }}
        />
      </div>

      {/* Ring arena */}
      <div className={`flex-1 flex items-center justify-center relative z-10 transition-all duration-500 ${ready ? "opacity-100" : "opacity-0"}`}>
        <div className="relative flex items-center justify-center" style={{ width: 260, height: 260 }}>
          <div
            className="absolute rounded-full border-4 transition-colors duration-200"
            style={{ width: RING_MAX * 260, height: RING_MAX * 260, borderColor: inTarget ? "#FFCA28" : "rgba(255,255,255,0.3)", boxShadow: inTarget ? "0 0 0 0 rgba(255,202,40,0.4)" : "none", animation: inTarget ? "pulseRing 1.4s ease-in-out infinite" : "none" }}
          />
          <div
            className="absolute rounded-full border-2 border-dashed transition-colors duration-200"
            style={{ width: RING_MIN * 260, height: RING_MIN * 260, borderColor: inTarget ? "rgba(255,202,40,0.6)" : "rgba(255,255,255,0.2)" }}
          />

          {!burst ? (
            <button
              type="button"
              aria-label={copy.game2Status.holdInRing}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={release}
              onPointerCancel={release}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
              onBlur={release}
              className="select-none rounded-full touch-none z-10 cursor-pointer transition-all duration-[40ms] ease-out focus-visible:outline focus-visible:outline-4 focus-visible:outline-white"
              style={{ width: 80, height: 80, backgroundColor: ballBg, transform: `scale(${ballScale})`, boxShadow: inTarget ? "0 0 24px rgba(255,202,40,0.6)" : "0 4px 16px rgba(0,0,0,0.2)" }}
            />
          ) : (
            <div className="relative flex items-center justify-center">
              <div className="absolute w-24 h-24 rounded-full bg-red-400/30 halo-grow" />
              <div className="absolute w-14 h-14 rounded-full bg-red-400/50 halo-grow" style={{ animationDelay: "0.1s" }} />
              <div className="w-10 h-10 rounded-full bg-red-400 anim-scaleIn" />
            </div>
          )}
        </div>
      </div>

      {/* Bottom Status */}
      <div className="h-[35%] shrink-0 bg-[#1a1a1a] px-6 pt-8 pb-8 flex flex-col items-center justify-center relative z-20">
         <h1 className="text-3xl font-black text-white uppercase leading-tight mb-2 text-center">
           {burst ? copy.game2Status.tooHard : inTarget ? copy.game2Status.onTarget : isHolding ? pressure < RING_MIN ? copy.game2Status.pressHarder : copy.game2Status.easeOff : copy.game2Status.holdInRing}
         </h1>
         <div className="flex items-baseline gap-2 mt-4 text-white/50">
           <span className="text-5xl font-black text-white tabular-nums">{secondsLeft}</span>
           <span className="text-sm font-bold uppercase tracking-widest">{copy.seconds}</span>
         </div>
      </div>
    </div>
  );
}
