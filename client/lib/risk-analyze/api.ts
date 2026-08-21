// Thin fetch wrapper around the risk_analyze FastAPI service
// (services/risk_analyze). Point NEXT_PUBLIC_RISK_ANALYZE_API_URL at
// wherever that service is running — defaults to http://localhost:8001
// (see client/.env.local.example).
//
// This is a SEPARATE backend/auth system from the rest of the app's
// Supabase-backed services (e.g. worker_reallocation) — see
// services/risk_analyze/README.md for why.

import { getEmployeeSession, getSupervisorSession } from "./session";

const BASE_URL =
  process.env.NEXT_PUBLIC_RISK_ANALYZE_API_URL?.replace(/\/$/, "") ||
  "http://localhost:8001";

export class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

function authHeader(): Record<string, string> {
  // Prefer whichever session is present — employee dashboard pages will
  // only have an employee session, supervisor pages only a supervisor one.
  const employee = getEmployeeSession();
  const supervisor = getSupervisorSession();
  const token = employee?.token || supervisor?.token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
      ...(options.headers || {}),
    },
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const message =
      (body && (body.detail || body.message || body.error)) ||
      `Request failed (${res.status})`;
    throw new ApiError(
      typeof message === "string" ? message : JSON.stringify(message),
      res.status,
      body
    );
  }

  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: data ? JSON.stringify(data) : undefined }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PUT", body: data ? JSON.stringify(data) : undefined }),
};

// ---------------------------- Types ----------------------------

export type EmployeeUser = {
  id: number;
  name: string;
  role: "labor";
  employee_code: string;
  submission_count: number;
  is_flagged: boolean;
};

export type SupervisorUser = {
  id: number;
  name: string;
  role: "admin";
  employee_code: string | null;
};

export type Prediction = {
  predicted_output: number;
  predicted_efficiency: number;
  efficiency_class: "High Efficiency" | "Low Efficiency";
  batch_completion_time: number | null;
};

export type RiskInfo = {
  risk_score: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  is_outlier: boolean;
};

export type LaborEntry = {
  id: number;
  laborers_id: number;
  output: string | number;
  smv: string | number;
  manpower: string | number;
  working_minutes: string | number;
  shift: string;
  operator_skill: string;
  machine_status: string;
  downtime_reason: string | null;
  efficiency: string | number;
  status: "HIGH" | "MEDIUM" | "LOW";
  predicted_output: string | number | null;
  predicted_efficiency: string | number | null;
  efficiency_class: string | null;
  batch_completion_time: string | number | null;
  risk_score: string | number | null;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | null;
  is_outlier: boolean;
  date: string;
  time: string;
  created_at: string;
  laborer_name?: string;
  employee_code?: string;
};

export type SubmitResponse = {
  entry: LaborEntry;
  prediction: Prediction;
  risk: RiskInfo;
  flagged: boolean;
  flagged_now: boolean;
  submission_count: number;
  notification: string | null;
};

export type FlaggedEmployee = {
  id: number;
  name: string;
  age: number | null;
  employee_code: string;
  submission_count: number;
  is_flagged: boolean;
  flagged_at: string | null;
  flag_reason: string | null;
};

export type Notification = {
  id: number;
  laborer_id: number;
  audience: "employee" | "supervisor";
  type: "FLAG" | "RISK_ALERT";
  message: string;
  is_read: boolean;
  created_at: string;
  laborer_name?: string;
  employee_code?: string;
};
