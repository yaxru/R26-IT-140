"use client";

import { useCallback, useRef } from "react";
import {
  measuredPressureValues,
  PressureSample,
  readPointerSamples,
  readTouchSamples,
} from "./pressureMeasurement";
/*To capture and store the touch events from react pointer */
export function usePressureCapture() {
  const pointerSamples = useRef<PressureSample[]>([]);
  const touchSamples = useRef<PressureSample[]>([]);

  const record = useCallback((e: React.PointerEvent) => {
    pointerSamples.current.push(...readPointerSamples(e));
  }, []);

  const recordTouch = useCallback((e: React.TouchEvent) => {
    touchSamples.current.push(...readTouchSamples(e));
  }, []);

  const reset = useCallback(() => {
    pointerSamples.current = [];
    touchSamples.current = [];
  }, []);

  const average = useCallback(() => {
    const arr = measuredPressureValues(
      pointerSamples.current,
      touchSamples.current,
    );
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }, []);

  const peak = useCallback(() => {
    const arr = measuredPressureValues(
      pointerSamples.current,
      touchSamples.current,
    );
    return arr.length === 0 ? 0 : Math.max(...arr);
  }, []);

  const variance = useCallback(() => {
    const arr = measuredPressureValues(
      pointerSamples.current,
      touchSamples.current,
    );
    if (arr.length < 2) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const sq = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
    return sq;
  }, []);

  const getSamples = useCallback(
    () => measuredPressureValues(pointerSamples.current, touchSamples.current),
    [],
  );
  return {
    record,
    recordTouch,
    reset,
    average,
    peak,
    variance,
    getSamples,
  };
}
