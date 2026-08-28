import {
  SessionInfo,
  Pss10Answers,
  InflatorTrial,
  PredictResult,
} from "./types";

// CHANGED TO 8003
const BASE_URL =
  process.env.NEXT_PUBLIC_STRESS_API_BASE_URL ?? "http://localhost:8003";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail?.error ?? `Request to ${path} failed (${res.status})`);
  }
  return res.json();
}


export function resolveSession(token: string): Promise<SessionInfo> {
  return post<SessionInfo>("/api/stress-detection/session/resolve", { token });
}

export function submitBaseline(sessionId: string, pressures: number[]) {
  return post<{ avg_baseline_pressure: number }>(
    "/api/stress-detection/baseline",
    { session_id: sessionId, pressures }
  );
}

export function submitPss10(sessionId: string, answers: Pss10Answers) {
  return post<{ pss10_score: number; pss10_classification: string }>(
    "/api/stress-detection/pss10",
    { session_id: sessionId, answers }
  );
}

export function submitGame1(
  sessionId: string,
  pressures: number[],
  responseTimeMs: number
) {
  return post<{ avg_game1_pressure: number; response_time_ms: number }>(
    "/api/stress-detection/game1",
    { session_id: sessionId, pressures, response_time_ms: responseTimeMs }
  );
}

export function submitGame2(sessionId: string, trials: InflatorTrial[]) {
  return post<Record<string, number>>("/api/stress-detection/game2", {
    session_id: sessionId,
    trials,
  });
}

export function predict(sessionId: string): Promise<PredictResult> {
  return post<PredictResult>("/api/stress-detection/predict", {
    session_id: sessionId,
  });
}
