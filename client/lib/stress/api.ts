import {
  SessionInfo,
  Pss10Answers,
  InflatorTrial,
  PredictResult,
} from "./types";

function getBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_STRESS_API_BASE_URL;
  if (configuredUrl) return configuredUrl.replace(/\/+$/, "");

  if (typeof window !== "undefined") return window.location.origin;

  return "http://localhost:5003";
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
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

export async function generateAssessmentToken(
  workerId: string,
  workerName: string,
): Promise<string> {
  const url = new URL(
    `${getBaseUrl()}/api/stress-detection/dev/token`,
  );
  url.searchParams.set("worker_id", workerId);
  url.searchParams.set("worker_name", workerName);

  const res = await fetch(url);
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : `Failed to generate link (${res.status})`;
    throw new Error(message);
  }
  if (
    !data ||
    typeof data !== "object" ||
    !("token" in data) ||
    typeof data.token !== "string" ||
    data.token.length === 0
  ) {
    throw new Error("The stress service returned an invalid assessment token.");
  }

  return data.token;
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
