import { createClient } from "@supabase/supabase-js";

// Initialize the Supabase client to fetch the active session
// Make sure you have these variables in your frontend .env.local file
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const BASE_URL = process.env.NEXT_PUBLIC_RISK_ANALYZE_API_URL || "http://localhost:8001";

// Helper function to get the token and build headers
async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    console.warn("No active Supabase session found. API requests will fail with 401.");
    return {
      "Content-Type": "application/json",
    };
  }

  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${session.access_token}`,
  };
}

export const api = {
  async get<T>(path: string): Promise<T> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "GET",
      headers,
    });
    if (!res.ok) {
      throw new Error(`GET ${path} failed: ${res.status} ${res.statusText}`);
    }
    return res.json();
  },

  async post<T>(path: string, body: any): Promise<T> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`POST ${path} failed: ${res.status} ${res.statusText}`);
    }
    return res.json();
  },

  async put<T>(path: string, body?: any): Promise<T> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "PUT",
      headers,
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