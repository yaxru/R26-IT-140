import { createClient } from "@/lib/supabase/client";
import { getAuthHeaders } from "@/shared/auth/client";

export type PredictionRequest = {
  department: string;
  team: number;
  batch_qty: number;
  date: string;
  no_of_workers: number;
  over_time: number;
  smv: number;
  machine_breakdown_minutes: number;
};

export type PredictionResponse = {
  history_id: number | null;
  history_saved: boolean;
  predicted_productivity: number;
  efficiency_level: string;
  delay_prediction: string;
  base_time_minutes: number;
  base_time_hours: number;
  machine_breakdown_minutes: number;
  estimated_time_minutes: number;
  estimated_time_hours: number;
};

export type HealthResponse = {
  status: string;
  service: string;
  database?: "connected" | "unavailable";
};

export type PredictionHistoryItem = {
  id: number;
  created_at: string;
  department: string;
  team: number;
  batch_qty: number;
  date: string;
  no_of_workers: number;
  over_time: number;
  smv: number;
  machine_breakdown_minutes: number;
  predicted_productivity: number;
  efficiency_level: string;
  delay_prediction: string;
  base_time_minutes: number;
  base_time_hours: number;
  estimated_time_minutes: number;
  estimated_time_hours: number;
};

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_TIME_PREDICTION_API_URL ?? "http://127.0.0.1:8002";

const supabase = createClient();

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string };
    if (body.detail) return body.detail;
  } catch {
    // Fall through to the generic status message when the body is not JSON.
  }

  return `Request failed (${response.status})`;
}

export async function checkHealth(): Promise<HealthResponse> {
  const headers = await getAuthHeaders(supabase);
  const response = await fetch(`${API_BASE_URL}/health`, {
    cache: "no-store",
    headers: { ...headers },
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return (await response.json()) as HealthResponse;
}

export async function predictBatch(
  payload: PredictionRequest,
): Promise<PredictionResponse> {
  const headers = await getAuthHeaders(supabase);
  const response = await fetch(`${API_BASE_URL}/predict`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return (await response.json()) as PredictionResponse;
}

export async function fetchPredictionHistory(
  limit = 20,
): Promise<PredictionHistoryItem[]> {
  const headers = await getAuthHeaders(supabase);
  const response = await fetch(`${API_BASE_URL}/history?limit=${limit}`, {
    cache: "no-store",
    headers: { ...headers },
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return (await response.json()) as PredictionHistoryItem[];
}
