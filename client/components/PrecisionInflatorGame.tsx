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
const TOTAL_TRIALS = 3;      /*trial count */
const RING_MIN = 0.45;
const RING_MAX = 0.70;
const FALLBACK_PRESSURE = 0.58;

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
  const touchSamples = useRef<PressureSample[]>([]);/*arrays to store input samples */
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
    const avg = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;/*avg pressure cal for each trial*/
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

    if (trialIndex + 1 >= TOTAL_TRIALS) {       /*check trial count */
      onComplete(next);                           /*oncomplete sent to parent stresasesmnt*/ 
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

  function resolvePressure(): { value: number; usePointerPosition: boolean } {/*choosing usable pressure deside values are usable */
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

    return { value: FALLBACK_PRESSURE, usePointerPosition: true };   /*use fall back if doesnt support */
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
    pointerSamples.current.push(...readPointerSamples(e));/* pass the browser pointer event help to read pressure messrmnts in presrmesmnt.ts*/
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

  const ballBg = burst ? "#F46D58" : inTarget ? "#FFC83D" : isHolding ? "#AFC9FF" : "#FFFFFF";

  return (
    <main className="min-h-dvh bg-[#DFF2FF] px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+1rem)] text-[#20243A] sm:px-6">
      <div className="mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col">
        <header className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.13em] text-[#526CA0]">
              {language === "si" ? "ක්‍රීඩාව 2" : "Game 2"}
            </p>
            <h1 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">
              {language === "si" ? "වළල්ල තුළ තබන්න" : "Keep it in the ring"}
            </h1>
          </div>
          <div className={`flex h-14 min-w-16 flex-col items-center justify-center rounded-2xl px-3 text-white shadow-sm ${secondsLeft <= 3 ? "bg-[#E4564E]" : "bg-[#566CD6]"}`}>
            <span className="text-xl font-black tabular-nums leading-none">{secondsLeft}</span>
            <span className="mt-1 text-[9px] font-extrabold uppercase tracking-wider">{copy.seconds}</span>
          </div>
        </header>

        <div className="mb-3 flex gap-2" aria-label={`${trialIndex + 1} of ${TOTAL_TRIALS}`}>
          {Array.from({ length: TOTAL_TRIALS }).map((_, index) => (
            <div
              key={index}
              className={`h-2.5 flex-1 overflow-hidden rounded-full ${index < trialIndex ? "bg-[#32A77A]" : "bg-[#C9D5ED]"}`}
            >
              {index === trialIndex && (
                <div
                  className="h-full rounded-full bg-[#566CD6] transition-[width] duration-100"
                  style={{ width: `${timePct}%` }}
                />
              )}
            </div>
          ))}
        </div>
        <p className="mb-1 text-right text-xs font-bold text-[#667394]">
          {language === "si" ? `වටය ${trialIndex + 1} / ${TOTAL_TRIALS}` : `Round ${trialIndex + 1} of ${TOTAL_TRIALS}`}
        </p>

        <div className={`flex flex-1 items-center justify-center py-3 transition-opacity duration-300 ${ready ? "opacity-100" : "opacity-0"}`}>
          <div
            ref={arenaRef}
            className="relative flex items-center justify-center rounded-full bg-white/55 shadow-[inset_0_0_0_1px_rgba(86,108,214,0.08)]"
            style={{ width: "min(290px, 78vw, 38dvh)", aspectRatio: "1" }}
          >
            <div
              className="absolute rounded-full border-[5px] transition-colors duration-200"
              style={{
                width: `${RING_MAX * 100}%`,
                height: `${RING_MAX * 100}%`,
                borderColor: inTarget ? "#F0A91B" : "#566CD6",
                boxShadow: inTarget ? "0 0 24px rgba(240,169,27,0.24)" : "none",
              }}
            />
            <div
              className="absolute rounded-full border-2 border-dashed transition-colors duration-200"
              style={{
                width: `${RING_MIN * 100}%`,
                height: `${RING_MIN * 100}%`,
                borderColor: inTarget ? "#F0A91B" : "#8A99C0",
              }}
            />

            {!burst ? (
              <button
                type="button"
                aria-label={copy.game2Status.holdInRing}
                aria-pressed={isHolding}
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
                className="absolute inset-0 z-10 flex select-none touch-none items-center justify-center rounded-full cursor-pointer focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#20243A]"
                style={{ backgroundColor: "transparent" }}
              >
                <span
                  className="rounded-full transition-[width,height,background-color] duration-[40ms] ease-out"
                  style={{
                    width: `${pressure * 100}%`,
                    height: `${pressure * 100}%`,
                    backgroundColor: ballBg,
                    boxShadow: inTarget
                      ? "0 6px 22px rgba(201,139,24,0.3)"
                      : "0 6px 18px rgba(62,79,139,0.18)",
                  }}
                />
              </button>
            ) : (
              <div className="relative flex items-center justify-center" aria-hidden="true">
                <div className="absolute h-24 w-24 rounded-full bg-[#F46D58]/25 halo-grow" />
                <div className="absolute h-14 w-14 rounded-full bg-[#F46D58]/45 halo-grow" style={{ animationDelay: "0.1s" }} />
                <div className="h-10 w-10 rounded-full bg-[#F46D58] anim-scaleIn" />
              </div>
            )}
          </div>
        </div>

        <section className="rounded-[1.5rem] border border-white bg-white p-4 text-center shadow-[0_10px_28px_rgba(61,82,147,0.1)] sm:p-5" aria-live="polite">
          <h2 className={`text-xl font-black sm:text-2xl ${burst ? "text-[#D94E43]" : inTarget ? "text-[#238454]" : "text-[#303957]"}`}>
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
          </h2>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-[#737B92]">
            {language === "si"
              ? "බෝලය වළල්ල තුළ තබාගැනීමට ඔබන්න හෝ අදින්න."
              : "Press or move gently to keep the ball inside the ring."}
          </p>
        </section>
      </div>
    </main>
  );
}
