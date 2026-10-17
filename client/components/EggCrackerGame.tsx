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
const BG = "#FB923C"; // solid orange

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
    startTime.current = performance.timeOrigin + performance.now();
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
        ? Math.round(firstTap.current - startTime.current)
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
      firstTap.current = eventTimeInEpoch(e.nativeEvent.timeStamp);
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

  function updateTouch(e: React.TouchEvent<HTMLButtonElement>) {
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
    <div
      className="flex flex-col h-dvh w-full overflow-hidden relative"
      style={{ backgroundColor: BG }}
    >
      <div className="absolute inset-0 pattern-zigzag opacity-20 mix-blend-overlay pointer-events-none" />

      {/* Top Header zone */}
      <div className="flex-1 w-full flex flex-col items-center justify-center relative z-10 px-6">
        <div className="w-full max-w-[280px] mx-auto">
          <div className="flex justify-between items-center mb-6">
            <p className="text-xs font-bold uppercase tracking-widest text-black/50">
              {copy.game1}
            </p>
            <p className="text-xs font-black uppercase tracking-widest bg-black/10 px-3 py-1 rounded-full text-black/70">
              {remaining} {copy.eggsLeft}
            </p>
          </div>

          <div
            className={`grid grid-cols-3 gap-4 w-full transition-all duration-500 ${ready ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
          >
            {eggs.map((egg, idx) => (
              <button
                key={idx}
                disabled={egg !== "idle"}
                onPointerDown={(e) => startTap(idx, e)}
                onPointerMove={updateTap}
                onPointerUp={(e) => finishTap(idx, e)}
                onPointerCancel={(e) => finishTap(idx, e)}
                onTouchStart={updateTouch}
                onTouchMove={updateTouch}
                onTouchEnd={updateTouch}
                aria-label={`${copy.game1}, ${idx + 1}`}
                className={`
                  relative select-none aspect-square rounded-[2rem] flex items-center justify-center
                  text-4xl touch-none overflow-hidden transition-all duration-200
                  disabled:cursor-default bg-white/20 backdrop-blur-sm border border-white/30
                  ${egg === "idle" ? "active:scale-90 hover:scale-105" : ""}
                  ${shakingIdx === idx ? "egg-shake" : ""}
                `}
              >
                {/* Ripples */}
                {ripples[idx].map((r) => (
                  <span
                    key={r.id}
                    className="absolute rounded-full ripple-enter pointer-events-none"
                    style={{
                      width: "100%",
                      height: "100%",
                      left: `${r.x}%`,
                      top: `${r.y}%`,
                      transform: "translate(-50%, -50%)",
                      background:
                        egg === "burst"
                          ? "rgba(220,38,38,0.4)"
                          : "rgba(255,255,255,0.4)",
                    }}
                  />
                ))}

                {/* Emojis are back as requested */}
                <span
                  className={`relative z-10 drop-shadow-sm transition-transform duration-300 ${egg !== "idle" ? "anim-popIn" : ""}`}
                >
                  {egg === "cracked" ? "🐣" : egg === "burst" ? "💥" : "🥚"}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Hint Zone */}
      <div className="h-[35%] shrink-0 w-full bg-[#1a1a1a] relative z-20">
        <div className="w-full max-w-md mx-auto h-full px-6 flex flex-col items-center justify-center text-center">
          <h1 className="text-3xl font-black text-white uppercase leading-tight mb-3">
            {copy.tapGently}
          </h1>
          <p className="text-sm font-bold text-white/40 uppercase tracking-widest text-center">
            {copy.lightCrack}
          </p>
        </div>
      </div>
    </div>
  );
}
