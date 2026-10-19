export interface PressureSample {
  pointerType: string;
  pressure: number;
  width: number;
  height: number;
}

export type MeasurementSupport =
  | "variable"
  | "uninformative"
  | "unavailable"
  | "not_applicable";

export interface PressureMeasurement {
  support: MeasurementSupport;
  mean: number | null;
  source: "pointer" | "touchforce";
}

export interface ContactMeasurement {
  support: Exclude<MeasurementSupport, "not_applicable">;
  meanPx: number | null;
  estimate: number | null;
  source: "pointer" | "touchradius";
}

const CONTACT = { minPx: 20, maxPx: 60, outMin: 0.2, outMax: 0.88 };

export function contactToPressureEstimate(diameter: number) {
  const progress = Math.min(
    1,
    Math.max(0, (diameter - CONTACT.minPx) / (CONTACT.maxPx - CONTACT.minPx)),
  );
  return (
    Math.round((CONTACT.outMin + progress * (CONTACT.outMax - CONTACT.outMin)) *
      1000) / 1000
  );
}

function standardDeviation(values: number[]) {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    values.length;
  return Math.sqrt(variance);
}

function validTouchSamples(samples: PressureSample[]) {
  return samples.filter(
    (sample) =>
      (sample.pointerType === "touch" || sample.pointerType === "pen") &&
      Number.isFinite(sample.pressure) &&
      sample.pressure >= 0 &&
      sample.pressure <= 1,
  );
}

export function classifyPressure(
  samples: PressureSample[],
): Omit<PressureMeasurement, "source"> {
  const types = new Set(samples.map((sample) => sample.pointerType));
  if (types.size > 0 && [...types].every((type) => type === "mouse")) {
    return { support: "not_applicable", mean: null };
  }

  const values = validTouchSamples(samples).map((sample) => sample.pressure);
  if (!values.length || values.every((value) => value === 0)) {
    return { support: "unavailable", mean: null };
  }

  const nonzero = values.filter((value) => value > 0);
  const onlyPlaceholders = nonzero.every(
    (value) => value === 0.5 || value === 1,
  );
  if (
    onlyPlaceholders ||
    nonzero.length < 2 ||
    Math.max(...nonzero) - Math.min(...nonzero) < 0.02 ||
    standardDeviation(nonzero) < 0.01
  ) {
    return { support: "uninformative", mean: null };
  }

  return {
    support: "variable",
    mean:
      Math.round(
        (nonzero.reduce((sum, value) => sum + value, 0) / nonzero.length) *
          1000,
      ) / 1000,
  };
}

export function classifyContact(
  samples: PressureSample[],
): Omit<ContactMeasurement, "source"> {
  const diameters = samples
    .filter(
      (sample) =>
        sample.pointerType === "touch" &&
        Number.isFinite(sample.width) &&
        Number.isFinite(sample.height),
    )
    .map((sample) => (sample.width + sample.height) / 2)
    .filter((diameter) => diameter > 1.5 && diameter < 500);
  if (diameters.length < 3) {
    return { support: "unavailable", meanPx: null, estimate: null };
  }
  if (
    Math.max(...diameters) - Math.min(...diameters) < 1 ||
    standardDeviation(diameters) < 0.5
  ) {
    return { support: "uninformative", meanPx: null, estimate: null };
  }

  const meanPx =
    diameters.reduce((sum, diameter) => sum + diameter, 0) / diameters.length;
  return {
    support: "variable",
    meanPx: Math.round(meanPx * 10) / 10,
    estimate: contactToPressureEstimate(meanPx),
  };
}

export function bestPressure(
  pointerSamples: PressureSample[],
  touchSamples: PressureSample[],
): PressureMeasurement {
  const pointer = classifyPressure(pointerSamples);
  if (pointer.support === "variable") {
    return { ...pointer, source: "pointer" };
  }

  const touch = classifyPressure(touchSamples);
  if (touch.support === "variable") {
    return { ...touch, source: "touchforce" };
  }
  return {
    ...(pointer.support === "not_applicable" ? pointer : touch),
    source: pointer.support === "not_applicable" ? "pointer" : "touchforce",
  };
}

export function bestContact(
  pointerSamples: PressureSample[],
  touchSamples: PressureSample[],
): ContactMeasurement {
  const pointer = classifyContact(pointerSamples);
  if (pointer.support === "variable") {
    return { ...pointer, source: "pointer" };
  }
  const touch = classifyContact(touchSamples);
  if (touch.support === "variable") {
    return { ...touch, source: "touchradius" };
  }
  return {
    ...(pointer.support === "uninformative" ? pointer : touch),
    source: pointer.support === "uninformative" ? "pointer" : "touchradius",
  };
}
/*reading browser pointer event data */
export function readPointerSamples(
  event: React.PointerEvent,
): PressureSample[] {
  let events: PointerEvent[] = [event.nativeEvent];
  try {
    const coalesced = event.nativeEvent.getCoalescedEvents?.();
    if (coalesced?.length) events = coalesced;
  } catch {
    events = [event.nativeEvent];
  }

  return events.map((sample) => ({
    pointerType: sample.pointerType || "unknown",
    pressure: sample.pressure,
    width: sample.width,
    height: sample.height,
  }));
}

export function readTouchSamples(event: React.TouchEvent): PressureSample[] {
  return Array.from(event.nativeEvent.changedTouches, (touch) => ({
    pointerType: "touch",
    pressure: typeof touch.force === "number" ? touch.force : Number.NaN,
    width: typeof touch.radiusX === "number" ? touch.radiusX * 2 : Number.NaN,
    height: typeof touch.radiusY === "number" ? touch.radiusY * 2 : Number.NaN,
  }));
}

export function measuredPressureValues(
  pointerSamples: PressureSample[],
  touchSamples: PressureSample[],
): number[] {
  const pressure = bestPressure(pointerSamples, touchSamples);
  if (pressure.support !== "variable") return [];

  const source = pressure.source === "pointer" ? pointerSamples : touchSamples;
  return validTouchSamples(source)
    .map((sample) => sample.pressure)
    .filter((value) => value > 0);
}

export function contactEstimateValues(
  pointerSamples: PressureSample[],
  touchSamples: PressureSample[],
): number[] {
  const contact = bestContact(pointerSamples, touchSamples);
  if (contact.support !== "variable") return [];
  const source = contact.source === "pointer" ? pointerSamples : touchSamples;
  return source
    .filter(
      (sample) =>
        sample.pointerType === "touch" &&
        Number.isFinite(sample.width) &&
        Number.isFinite(sample.height),
    )
    .map((sample) =>
      contactToPressureEstimate((sample.width + sample.height) / 2),
    );
}
