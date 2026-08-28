"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePressureCapture } from "@/lib/usePressureCapture";

const EGG_COUNT = 9;
const BURST_PRESSURE = 0.75;

export default function EggCrackerGame({
  onComplete,
}: {
  onComplete: (pressures: number[], responseTimeMs: number) => void;
}) {
  const [started, setStarted] = useState(false);
  const [eggs, setEggs] = useState(
    Array.from({ length: EGG_COUNT }, () => ({ cracked: false, burst: false }))
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
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [remaining, started, getSamples, onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center gap-6 px-6 w-full"
    >
      <div className="text-center">
        <span className="text-xs font-semibold tracking-wide text-lilac-500 uppercase">
          Game 1 · Egg Cracker
        </span>
        <h2 className="text-lg font-semibold text-lilac-900 mt-1">
          Tap gently to crack each egg 🥚
        </h2>
        <p className="text-xs text-lilac-500 mt-1">{remaining} eggs left</p>
      </div>

      <div className="grid grid-cols-3 gap-4 w-full max-w-xs">
        {eggs.map((egg, idx) => (
          <motion.button
            key={idx}
            disabled={egg.cracked || egg.burst}
            onPointerDown={(e) => tapEgg(idx, e)}
            whileTap={{ scale: 0.85 }}
            className="tap-target no-select aspect-square rounded-3xl bg-white/80 shadow-card flex items-center justify-center text-4xl"
          >
            <AnimatePresence mode="wait">
              {egg.burst ? (
                <motion.span
                  key="burst"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1.2 }}
                  className="text-coral-500"
                >
                  💥
                </motion.span>
              ) : egg.cracked ? (
                <motion.span
                  key="cracked"
                  initial={{ scale: 0.5, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                >
                  🐣
                </motion.span>
              ) : (
                <motion.span key="whole">🥚</motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
