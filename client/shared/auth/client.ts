/**
 * Client-side authentication utilities for Opsis
 * Use in Next.js client components to interact with Supabase Auth
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthHeaders, AuthSession, AuthUser } from "./types";

/**
 * Get authorization headers from the current Supabase session
 * Call this in API requests to protected endpoints
 *
 * @param supabaseClient - The Supabase client instance
 * @returns Object with Authorization header, or empty object if not authenticated
 *
 * @example
 * const supabase = createClient();
 * const headers = await getAuthHeaders(supabase);
 * const res = await fetch('/api/protected', { headers });
 */
export async function getAuthHeaders(
  supabaseClient: SupabaseClient,
): Promise<AuthHeaders> {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};
}

/**
 * Get the current authenticated user and session info
 *
 * @param supabaseClient - The Supabase client instance
 * @returns Session containing user data and access token, or null if not authenticated
 */
export async function getAuthSession(
  supabaseClient: SupabaseClient,
): Promise<AuthSession | null> {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session || !session.user) {
    return {
      user: null,
      access_token: null,
    };
  }

  return {
    user: {
      id: session.user.id,
      email: session.user.email || "",
      role: "supervisor", // Default to supervisor; extend with user metadata if available
    },
    access_token: session.access_token,
  };
}

/**
 * Sign in with email and password
 * Redirects to dashboard on success, handles errors gracefully
 *
 * @param supabaseClient - The Supabase client instance
 * @param email - User's email
 * @param password - User's password
 * @returns Error message if login fails, null if successful
 */
export async function signInWithPassword(
  supabaseClient: SupabaseClient,
  email: string,
  password: string,
): Promise<string | null> {
  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Handle specific Supabase errors
    if (error.message === "Email not confirmed") {
      return "Your account email is not confirmed. Ask your admin to disable email confirmation in Supabase Auth settings, or confirm the email.";
    }
    return error.message;
  }

  return null; // Success
}

/**
 * Sign out the current user
 *
 * @param supabaseClient - The Supabase client instance
 * @returns Error message if sign out fails, null if successful
 */
export async function signOut(
  supabaseClient: SupabaseClient,
): Promise<string | null> {
  const { error } = await supabaseClient.auth.signOut();
  return error ? error.message : null;
}

/**
 * Verify the user is authenticated (for guards/middleware)
 *
 * @param supabaseClient - The Supabase client instance
 * @returns True if user is authenticated
 */
export async function isAuthenticated(
  supabaseClient: SupabaseClient,
): Promise<boolean> {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();

  return !!user;
}
