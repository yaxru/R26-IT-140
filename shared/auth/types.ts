/**
 * Shared authentication types for Opsis
 */

export interface AuthUser {
  id: string;
  email: string;
  role?: "supervisor" | "worker" | "admin";
  supervisor_id?: string;
}

export interface AuthSession {
  user: AuthUser | null;
  access_token: string | null;
}

export interface AuthHeaders {
  Authorization: string;
}

export interface BulkCreateWorkersPayload {
  workers: WorkerRecord[];
}

export interface WorkerRecord {
  firstName: string;
  workerId: string; // 4-digit ID
  lineId: string;
}

export interface BulkCreateWorkersResponse {
  success: WorkerAccountCreated[];
  failed: WorkerCreationError[];
  summary: {
    total: number;
    created: number;
    failed: number;
  };
}

export interface WorkerAccountCreated {
  id: string;
  email: string;
  firstName: string;
  workerId: string;
  lineId: string;
  plainTextPin: string; // 4-digit PIN for printing
}

export interface WorkerCreationError {
  firstName?: string;
  workerId?: string;
  lineId?: string;
  reason: string;
}
