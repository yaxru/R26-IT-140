"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { InflatorTrial, Language } from "@/lib/stress/types";
import { getStressCopy } from "@/lib/stress/translations";
import {
  bestContact,
  bestPressure,
  contactToPressureEstimate,
  measuredPressureValues,
  PressureSample,
  readPointerSamples,
  readTouchSamples,
} from "@/lib/stress/pressureMeasurement";

const TRIAL_DURATION_MS = 10000;
const TOTAL_TRIALS = 3;
const RING_MIN = 0.45;
const RING_MAX = 0.70;
const FALLBACK_PRESSURE = 0.58;

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
  const [positionControl, setPositionControl] = useState(false);

  const pointerSamples = useRef<PressureSample[]>([]);
  const touchSamples = useRef<PressureSample[]>([]);
  const interactionSamples = useRef<number[]>([]);
  const onTargetMs = useRef(0);
  const overshoot = useRef(0);
  const lastTick = useRef(0);
  const rafId = useRef(0);
  const trialStart = useRef(0);
  const pointerId = useRef<number | null>(null);
  const pressureRef = useRef(0);
  const burstRef = useRef(false);
  const arenaRef = useRef<HTMLDivElement>(null);
  const copy = getStressCopy(language);

  const inTarget = pressure >= RING_MIN && pressure <= RING_MAX && !burst;

  const finishTrial = useCallback(() => {
    const measured = measuredPressureValues(
      pointerSamples.current,
      touchSamples.current,
    );
    const arr = measured.length ? measured : interactionSamples.current;
    const avg = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
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
      setBurst(false);
      setPositionControl(false);
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
    pointerSamples.current = [];
    touchSamples.current = [];
    interactionSamples.current = [];
    onTargetMs.current = 0;
    overshoot.current  = 0;
    burstRef.current = false;
    pressureRef.current = 0;

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

  function resolvePressure(): { value: number; usePointerPosition: boolean } {
    const measurement = bestPressure(
      pointerSamples.current,
      touchSamples.current,
    );
    if (measurement.support === "variable") {
      const samples =
        measurement.source === "pointer"
          ? pointerSamples.current
          : touchSamples.current;
      const latest = [...samples]
        .reverse()
        .find(
          (sample) =>
            Number.isFinite(sample.pressure) &&
            sample.pressure > 0 &&
            sample.pressure <= 1,
        );
      if (latest) return { value: latest.pressure, usePointerPosition: false };
    }

    const contact = bestContact(pointerSamples.current, touchSamples.current);
    if (contact.support === "variable") {
      const samples =
        contact.source === "pointer"
          ? pointerSamples.current
          : touchSamples.current;
      const latest = [...samples]
        .reverse()
        .find(
          (sample) =>
            sample.pointerType === "touch" &&
            Number.isFinite(sample.width) &&
            Number.isFinite(sample.height),
        );
      if (latest) {
        return {
          value: contactToPressureEstimate((latest.width + latest.height) / 2),
          usePointerPosition: false,
        };
      }
    }

    return { value: FALLBACK_PRESSURE, usePointerPosition: true };
  }

  function samplePressure(raw: number, usesPosition: boolean) {
    if (burstRef.current) return;
    interactionSamples.current.push(raw);
    pressureRef.current = raw;
    setPositionControl(usesPosition);
    setPressure(raw);
    setIsHolding(true);

    if (raw > RING_MAX) {
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

  function updateFromPointer(e: React.PointerEvent<HTMLButtonElement>) {
    pointerSamples.current.push(...readPointerSamples(e));
    const reading = resolvePressure();
    const rect = arenaRef.current?.getBoundingClientRect();
    const fallbackValue =
      reading.usePointerPosition && rect
        ? Math.min(
            1,
            Math.max(0, (rect.bottom - e.clientY) / rect.height),
          )
        : reading.value;
    samplePressure(fallbackValue, reading.usePointerPosition);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (burstRef.current) return;
    pointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromPointer(e);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (pointerId.current !== e.pointerId) return;
    updateFromPointer(e);
  }

  function updateFromTouch(e: React.TouchEvent<HTMLButtonElement>) {
    if (pointerId.current === null) return;
    touchSamples.current.push(...readTouchSamples(e));
    const reading = resolvePressure();
    const rect = arenaRef.current?.getBoundingClientRect();
    const touch = e.nativeEvent.changedTouches[0];
    const fallbackValue =
      reading.usePointerPosition && rect && touch
        ? Math.min(1, Math.max(0, (rect.bottom - touch.clientY) / rect.height))
        : reading.value;
    samplePressure(fallbackValue, reading.usePointerPosition);
  }

  function release() {
    pointerId.current = null;
    pressureRef.current = 0;
    if (!burstRef.current) setPressure(0);
    setIsHolding(false);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    pointerSamples.current.push(...readPointerSamples(e));
    release();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if ((e.key === " " || e.key === "Enter") && !e.repeat) {
      e.preventDefault();
      pointerId.current = -1;
      samplePressure(FALLBACK_PRESSURE, true);
    } else if (
      (e.key === "ArrowUp" || e.key === "ArrowRight") &&
      pointerId.current === -1
    ) {
      e.preventDefault();
      samplePressure(Math.min(1, pressureRef.current + 0.04), true);
    } else if (
      (e.key === "ArrowDown" || e.key === "ArrowLeft") &&
      pointerId.current === -1
    ) {
      e.preventDefault();
      samplePressure(Math.max(0, pressureRef.current - 0.04), true);
    }
  }

  function handleKeyUp(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === " " || e.key === "Enter") release();
  }

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
        <div
          ref={arenaRef}
          className="relative flex items-center justify-center"
          style={{ width: "min(260px, 80vw, 45vh)", aspectRatio: "1" }}
        >
          <div
            className="absolute rounded-full border-4 transition-colors duration-200"
            style={{ width: `${RING_MAX * 100}%`, height: `${RING_MAX * 100}%`, borderColor: inTarget ? "#FFCA28" : "rgba(255,255,255,0.3)", boxShadow: inTarget ? "0 0 0 0 rgba(255,202,40,0.4)" : "none", animation: inTarget ? "pulseRing 1.4s ease-in-out infinite" : "none" }}
          />
          <div
            className="absolute rounded-full border-2 border-dashed transition-colors duration-200"
            style={{ width: `${RING_MIN * 100}%`, height: `${RING_MIN * 100}%`, borderColor: inTarget ? "rgba(255,202,40,0.6)" : "rgba(255,255,255,0.2)" }}
          />

          {!burst ? (
            <button
              type="button"
              aria-label={copy.game2Status.holdInRing}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={release}
              onTouchStart={updateFromTouch}
              onTouchMove={updateFromTouch}
              onTouchEnd={updateFromTouch}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
              onBlur={release}
              className="absolute inset-0 z-10 flex select-none touch-none items-center justify-center rounded-full cursor-pointer focus-visible:outline focus-visible:outline-4 focus-visible:outline-white"
              style={{ backgroundColor: "transparent" }}
            >
              <span
                className="rounded-full transition-[width,height,background-color] duration-[40ms] ease-out"
                style={{
                  width: `${pressure * 100}%`,
                  height: `${pressure * 100}%`,
                  backgroundColor: ballBg,
                  boxShadow: inTarget
                    ? "0 0 24px rgba(255,202,40,0.6)"
                    : "0 4px 16px rgba(0,0,0,0.2)",
                }}
              />
            </button>
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
           {burst
             ? copy.game2Status.tooHard
             : inTarget
               ? copy.game2Status.onTarget
               : isHolding
               ? positionControl
                 ? pressure < RING_MIN
                   ? copy.game2Status.moveUp
                   : copy.game2Status.moveDown
                 : pressure < RING_MIN
                   ? copy.game2Status.pressHarder
                   : copy.game2Status.easeOff
                 : copy.game2Status.holdInRing}
         </h1>
         <div className="flex items-baseline gap-2 mt-4 text-white/50">
           <span className="text-5xl font-black text-white tabular-nums">{secondsLeft}</span>
           <span className="text-sm font-bold uppercase tracking-widest">{copy.seconds}</span>
         </div>
      </div>
    </div>
  );
}
