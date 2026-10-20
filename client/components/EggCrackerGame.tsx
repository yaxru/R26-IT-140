"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePressureCapture } from "@/lib/stress/usePressureCapture";
import { Language } from "@/lib/stress/types";
import { getStressCopy } from "@/lib/stress/translations";
import {
  bestContact,
  bestPressure,
  contactEstimateValues,
  measuredPressureValues,
  PressureSample,
  readPointerSamples,
  readTouchSamples,
} from "@/lib/stress/pressureMeasurement";

const EGG_COUNT = 9;
const BURST_PRESSURE = 0.72;

type EggState = "idle" | "cracked" | "burst";

interface Ripple {
  id: number;
  x: number;
  y: number;
}

interface ActivePress {
  index: number;
  pointerId: number;
  pointerSamples: PressureSample[];
  touchSamples: PressureSample[];
}

function eventTimeInEpoch(timestamp: number) {
  return timestamp > 1_000_000_000_000
    ? timestamp
    : performance.timeOrigin + timestamp;
}

export default function EggCrackerGame({
  language,
  onComplete,
}: {
  language: Language;
  onComplete: (pressures: number[], responseTimeMs: number) => void;
}) {
  const [eggs, setEggs] = useState<EggState[]>(
    Array.from({ length: EGG_COUNT }, () => "idle"),
  );
  const [shakingIdx, setShakingIdx] = useState<number | null>(null);
  const [ripples, setRipples] = useState<Ripple[][]>(
    Array.from({ length: EGG_COUNT }, () => []),
  );
  const [ready, setReady] = useState(false);

  const startTime = useRef(0);
  const firstTap = useRef<number | null>(null);
  const rippleId = useRef(0);
  const activePress = useRef<ActivePress | null>(null);
  const pendingEggs = useRef(new Set<number>());
  const onCompleteRef = useRef(onComplete);
  const { record, recordTouch, getSamples } = usePressureCapture();
  const copy = getStressCopy(language);

  const remaining = eggs.filter((e) => e === "idle").length;
  const done = remaining === 0;

  useEffect(() => {
    startTime.current = performance.timeOrigin + performance.now();/* record the start time*/
  }, []);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (done) {
      const rt = firstTap.current !== null
        ? Math.round(firstTap.current - startTime.current)   /*calculate the response time */
        : 0;
      const t = setTimeout(
        () => onCompleteRef.current(getSamples(), rt),
        650,
      );
      return () => clearTimeout(t);
    }
  }, [done, getSamples]);

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

  function startTap(idx: number, e: React.PointerEvent<HTMLButtonElement>) {
    if (
      eggs[idx] !== "idle" ||
      pendingEggs.current.has(idx) ||
      activePress.current
    ) {
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    activePress.current = {
      index: idx,
      pointerId: e.pointerId,
      pointerSamples: readPointerSamples(e),
      touchSamples: [],
    };
    if (firstTap.current === null) {
      firstTap.current = eventTimeInEpoch(e.nativeEvent.timeStamp);    /*take the first tap time */
    }
    record(e);

    const rect = e.currentTarget.getBoundingClientRect();
    addRipple(
      idx,
      ((e.clientX - rect.left) / rect.width) * 100,
      ((e.clientY - rect.top) / rect.height) * 100,
    );
  }

  function updateTap(e: React.PointerEvent<HTMLButtonElement>) {
    const press = activePress.current;
    if (!press || press.pointerId !== e.pointerId) return;
    record(e);
    press.pointerSamples.push(...readPointerSamples(e));
  }

  function updateTouch(e: React.TouchEvent<HTMLButtonElement>) {     /*record the touch */
    recordTouch(e);
    const press = activePress.current;
    if (press) press.touchSamples.push(...readTouchSamples(e));
  }

  function finishTap(idx: number, e: React.PointerEvent<HTMLButtonElement>) {
    const press = activePress.current;
    if (!press || press.index !== idx || press.pointerId !== e.pointerId) return;
    record(e);
    press.pointerSamples.push(...readPointerSamples(e));
    activePress.current = null;
    pendingEggs.current.add(idx);
    const pressure = bestPressure(press.pointerSamples, press.touchSamples);
    const contact = bestContact(press.pointerSamples, press.touchSamples);
    const measurements =
      pressure.support === "variable"
        ? measuredPressureValues(press.pointerSamples, press.touchSamples)
        : contact.support === "variable"
          ? contactEstimateValues(press.pointerSamples, press.touchSamples)
          : [];
    const isBurst = measurements.length > 0 && Math.max(...measurements) > BURST_PRESSURE;

    setShakingIdx(idx);
    setTimeout(() => setShakingIdx(null), 380);

    setTimeout(() => {
      setEggs((prev) => {
        const next = [...prev];
        next[idx] = isBurst ? "burst" : "cracked";
        return next;
      });
      pendingEggs.current.delete(idx);
    }, 180);
  }

  return (
    <main className="min-h-dvh bg-[#FFF1E3] px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-[calc(env(safe-area-inset-top)+1rem)] text-[#35291F] sm:px-6">
      <div className="mx-auto flex min-h-[calc(100dvh-2.25rem)] w-full max-w-xl flex-col">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.13em] text-[#A76531]">
              {copy.game1}
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
              {copy.tapGently.replace("\n", " ")}
            </h1>
          </div>
          <div className="rounded-2xl bg-white px-4 py-2 text-center shadow-sm">
            <p className="text-xl font-black text-[#E97924]">{remaining}</p>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#8F7560]">
              {copy.eggsLeft}
            </p>
          </div>
        </header>

        <p className="mb-4 rounded-2xl border border-[#F5D6BA] bg-white/70 px-4 py-3 text-sm font-semibold leading-relaxed text-[#705843]">
          {copy.lightCrack}
        </p>

        <div
          className={`grid grid-cols-3 gap-3 rounded-[1.75rem] border border-white bg-[#FFE3C9] p-3 shadow-[0_12px_30px_rgba(163,87,32,0.1)] transition-all duration-300 sm:gap-4 sm:p-5 ${ready ? "scale-100 opacity-100" : "scale-[0.98] opacity-0"}`}
        >
          {eggs.map((egg, idx) => (
            <button
              key={idx}
              disabled={egg !== "idle"}
              onPointerDown={(event) => startTap(idx, event)}
              onPointerMove={updateTap}
              onPointerUp={(event) => finishTap(idx, event)}
              onPointerCancel={(event) => finishTap(idx, event)}
              onTouchStart={updateTouch}
              onTouchMove={updateTouch}
              onTouchEnd={updateTouch}
              aria-label={`${copy.game1}, ${idx + 1}`}
              aria-pressed={egg !== "idle"}
              className={`relative flex aspect-square min-h-0 select-none items-center justify-center overflow-hidden rounded-[1.25rem] border-2 text-4xl touch-none transition-all duration-200 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#D56A1C] disabled:cursor-default ${egg === "idle" ? "border-white bg-white shadow-sm hover:-translate-y-0.5 hover:shadow-md active:scale-95" : egg === "cracked" ? "border-[#BFE8CE] bg-[#E4F7EA]" : "border-[#FFC5B8] bg-[#FFE2DC]"} ${shakingIdx === idx ? "egg-shake" : ""}`}
            >
              {ripples[idx].map((ripple) => (
                <span
                  key={ripple.id}
                  className="pointer-events-none absolute ripple-enter rounded-full bg-[#F9B24A]/40"
                  style={{
                    width: "100%",
                    height: "100%",
                    left: `${ripple.x}%`,
                    top: `${ripple.y}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                />
              ))}
              <span className={`relative z-10 drop-shadow-sm transition-transform duration-300 ${egg !== "idle" ? "anim-popIn" : ""}`}>
                {egg === "cracked" ? "🐣" : egg === "burst" ? "💥" : "🥚"}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-auto pt-4">
          <div className="mb-2 flex items-center justify-between text-xs font-extrabold text-[#896448]">
            <span>{copy.game1}</span>
            <span>{EGG_COUNT - remaining} / {EGG_COUNT}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#F3D6BD]">
            <div
              className="h-full rounded-full bg-[#E97924] transition-[width] duration-300"
              style={{ width: `${((EGG_COUNT - remaining) / EGG_COUNT) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
