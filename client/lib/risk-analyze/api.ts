import { createClient } from "@/lib/supabase/client"; // Import your SSR client 
import { getAuthHeaders } from "@/shared/auth/client"; 

// Use the singleton SSR client so we don't spawn multiple GoTrue instances
const supabase = createClient();

const BASE_URL = process.env.NEXT_PUBLIC_RISK_ANALYZE_API_URL || "http://localhost:8001";

export const api = {
  async get<T>(path: string): Promise<T> {
    const headers = await getAuthHeaders(supabase);
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    });
    if (!res.ok) {
      throw new Error(`GET ${path} failed: ${res.status} ${res.statusText}`);
    }
    return res.json();
  },

  async post<T>(path: string, body: any): Promise<T> {
    const headers = await getAuthHeaders(supabase);
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`POST ${path} failed: ${res.status} ${res.statusText}`);
    }
    return res.json();
  },

  async put<T>(path: string, body?: any): Promise<T> {
    const headers = await getAuthHeaders(supabase);
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      throw new Error(`PUT ${path} failed: ${res.status} ${res.statusText}`);
    }
    return res.json();
  },
};

// ---------------------------------------------------------------------------
// Types for the frontend components
// ---------------------------------------------------------------------------
export type FlaggedEmployee = {
  id: string;
  name: string;
  employee_code: string | null;
  is_flagged: boolean;
  flagged_at: string | null;
  flag_reason: string | null;
};

export type LaborEntry = {
  id: number;
  operator_id: string;
  laborer_name?: string;
  employee_code?: string | null;
  output: number | string;
  smv: number | string;
  working_minutes: number | string;
  efficiency: number | string;
  status: "HIGH" | "MEDIUM" | "LOW";
  date: string;
  time: string;
  predicted_output?: number | string;
  predicted_efficiency?: number | string;
  efficiency_class?: string;
  batch_completion_time?: number | string;
  risk_score?: number | string;
  risk_level?: "LOW" | "MEDIUM" | "HIGH" | null;
  is_outlier?: boolean;
};