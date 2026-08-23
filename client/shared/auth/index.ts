/**
 * Shared authentication module for Opsis
 * Provides centralized auth utilities for client and server
 */

// Types
export type {
  AuthUser,
  AuthSession,
  AuthHeaders,
  BulkCreateWorkersPayload,
  WorkerRecord,
  BulkCreateWorkersResponse,
  WorkerAccountCreated,
  WorkerCreationError,
} from "./types";

// Client utilities (use in browser/client components)
export {
  getAuthHeaders,
  getAuthSession,
  signInWithPassword,
  signOut,
  isAuthenticated,
} from "./client";

// Server utilities (use in middleware/API routes/Edge Functions)
export {
  verifyJWT,
  extractBearerToken,
  checkAuth,
  requireAuth,
  CORS_HEADERS,
  handleCorsPrelight,
} from "./server";
