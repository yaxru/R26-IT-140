/**
 * Server-side authentication utilities for Opsis
 * Use in Next.js middleware, API routes, and server components
 */

import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import type { AuthUser } from "./types";

/**
 * Verify JWT token from Authorization header
 * Useful for validating tokens in backend services/Edge Functions
 *
 * @param token - JWT bearer token (without "Bearer " prefix)
 * @param supabaseUrl - Supabase project URL
 * @param supabaseAnonKey - Supabase anon key
 * @returns User info if token is valid, throws error if invalid
 *
 * @example
 * try {
 *   const token = req.headers.get("authorization")?.replace("Bearer ", "");
 *   const user = await verifyJWT(token, supabaseUrl, supabaseAnonKey);
 *   console.log(user.id); // User ID from token
 * } catch (error) {
 *   // Token is invalid or expired
 * }
 */
export async function verifyJWT(
  token: string,
  supabaseUrl: string,
  supabaseKey: string,
): Promise<AuthUser> {
  // Create a client to verify the token via Supabase Auth API
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => [],
      setAll: () => {},
    },
  });

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    throw new Error(
      `Invalid or expired token: ${error?.message || "Unknown error"}`,
    );
  }

  return {
    id: data.user.id,
    email: data.user.email || "",
    role: "supervisor", // Extend with custom user metadata if available
  };
}

/**
 * Extract Bearer token from Authorization header
 *
 * @param request - Next.js request object
 * @returns Token string or null if not present
 */
export function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Check if request is authenticated
 * Can be used in middleware or API route guards
 *
 * @param request - Next.js request object
 * @param supabaseUrl - Supabase project URL
 * @param supabaseAnonKey - Supabase anon key
 * @returns User object if authenticated, null otherwise
 */
export async function checkAuth(
  request: NextRequest,
  supabaseUrl: string,
  supabaseAnonKey: string,
): Promise<AuthUser | null> {
  const token = extractBearerToken(request);
  if (!token) {
    return null;
  }

  try {
    return await verifyJWT(token, supabaseUrl, supabaseAnonKey);
  } catch {
    return null;
  }
}

/**
 * Require authentication middleware response
 * Use in API routes that require authentication
 *
 * @param request - Next.js request object
 * @param supabaseUrl - Supabase project URL
 * @param supabaseAnonKey - Supabase anon key
 * @returns User object if authenticated, or an error response
 *
 * @example
 * export async function POST(request: NextRequest) {
 *   const user = await requireAuth(request, url, key);
 *   if (user instanceof NextResponse) return user; // It's an error response
 *
 *   // Now user is AuthUser, safely use it
 *   console.log(user.id);
 * }
 */
export async function requireAuth(
  request: NextRequest,
  supabaseUrl: string,
  supabaseAnonKey: string,
): Promise<AuthUser | NextResponse> {
  const user = await checkAuth(request, supabaseUrl, supabaseAnonKey);

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized: Missing or invalid authentication token" },
      { status: 401 },
    );
  }

  return user;
}

/**
 * CORS headers for Edge Functions and API routes
 * Allows browser requests from localhost and production origins
 */
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin":
    process.env.NODE_ENV === "production"
      ? process.env.NEXT_PUBLIC_FRONTEND_URL || "*"
      : "http://localhost:3000",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * Handle CORS preflight requests
 *
 * @param request - Next.js request object
 * @returns Response with CORS headers if OPTIONS request
 */
export function handleCorsPrelight(request: NextRequest) {
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { headers: CORS_HEADERS });
  }
  return null;
}
