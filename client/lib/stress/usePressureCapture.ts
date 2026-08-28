"use client";

import { useCallback, useRef } from "react";

/**
 * Captures PointerEvent.pressure (0..1) on every pointer move/down while the
 * pointer is active over an element. Falls back to a fixed 0.5 on devices
 * that don't report real pressure (most desktop mice), so the flow keeps
 * working during development.
 */
export function usePressureCapture() {
  const samples = useRef<number[]>([]);

  const record = useCallback((e: React.PointerEvent) => {
    const raw = e.pressure;
    const value = raw && raw > 0 ? raw : 0.5;
    samples.current.push(value);
  }, []);

  const reset = useCallback(() => {
    samples.current = [];
  }, []);

  const average = useCallback(() => {
    const arr = samples.current;
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }, []);

  const peak = useCallback(() => {
    const arr = samples.current;
    return arr.length === 0 ? 0 : Math.max(...arr);
  }, []);

  const variance = useCallback(() => {
    const arr = samples.current;
    if (arr.length < 2) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const sq = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
    return sq;
  }, []);

  const getSamples = useCallback(() => samples.current.slice(), []);

  return { record, reset, average, peak, variance, getSamples };
}
