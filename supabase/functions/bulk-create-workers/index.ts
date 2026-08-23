import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0/+esm";

// ============================================================================
// Types
// ============================================================================
interface WorkerRecord {
  firstName: string;
  workerId: string; // 4-digit ID
  lineId: string;
}

interface BulkCreateRequest {
  workers: WorkerRecord[];
}

interface WorkerAccountCreated {
  id: string;
  email: string;
  firstName: string;
  workerId: string;
  lineId: string;
  plainTextPin: string;
}

interface WorkerCreationError {
  firstName?: string;
  workerId?: string;
  lineId?: string;
  reason: string;
}

interface BulkCreateResponse {
  success: WorkerAccountCreated[];
  failed: WorkerCreationError[];
  summary: {
    total: number;
    created: number;
    failed: number;
  };
}

// ============================================================================
// Constants
// ============================================================================
const MAX_WORKERS_PER_REQUEST = 100;
const WORKER_EMAIL_DOMAIN = "opsis.int";

// ============================================================================
// Helpers
// ============================================================================

/**
 * Generate a random 4-digit PIN
 */
function generatePin(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

/**
 * Validate required fields in a worker record
 */
function validateWorkerRecord(
  worker: WorkerRecord,
  index: number,
): string | null {
  if (!worker.firstName || typeof worker.firstName !== "string") {
    return `Record ${index}: Missing or invalid firstName`;
  }

  if (!worker.workerId || typeof worker.workerId !== "string") {
    return `Record ${index}: Missing or invalid workerId`;
  }

  if (!/^\d{4}$/.test(worker.workerId)) {
    return `Record ${index}: workerId must be exactly 4 digits (got "${worker.workerId}")`;
  }

  if (!worker.lineId || typeof worker.lineId !== "string") {
    return `Record ${index}: Missing or invalid lineId`;
  }

  return null;
}

/**
 * Construct worker email from firstName and workerId
 * Example: yasiru.4092@opsis.int
 */
function constructEmail(firstName: string, workerId: string): string {
  return `${firstName.toLowerCase()}.${workerId}@${WORKER_EMAIL_DOMAIN}`;
}

/**
 * Verify JWT token from Authorization header
 */
async function verifyToken(
  authHeader: string,
  supabaseUrl: string,
  supabaseKey: string,
): Promise<{ id: string; email: string }> {
  if (!authHeader.startsWith("Bearer ")) {
    throw new Error("Invalid Authorization header format");
  }

  const token = authHeader.slice(7);

  // Create a client to verify the token
  const supabase = createClient(supabaseUrl, supabaseKey);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new Error(
      `Token verification failed: ${error?.message || "Unknown error"}`,
    );
  }

  return {
    id: user.id,
    email: user.email || "",
  };
}

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // ════════════════════════════════════════════════════════════════════
    // 1. Authenticate the request
    // ════════════════════════════════════════════════════════════════════
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase configuration" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    let supervisorId: string;
    try {
      const supervisor = await verifyToken(
        authHeader,
        supabaseUrl,
        supabaseKey,
      );
      supervisorId = supervisor.id;
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: `Authentication failed: ${error.message}`,
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // ════════════════════════════════════════════════════════════════════
    // 2. Parse and validate payload
    // ════════════════════════════════════════════════════════════════════
    let payload: BulkCreateRequest;
    try {
      payload = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!Array.isArray(payload.workers)) {
      return new Response(
        JSON.stringify({
          error: 'Request must contain "workers" array',
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Enforce payload size limit
    if (payload.workers.length > MAX_WORKERS_PER_REQUEST) {
      return new Response(
        JSON.stringify({
          error: `Payload too large: ${payload.workers.length} workers exceeds ${MAX_WORKERS_PER_REQUEST} limit`,
        }),
        {
          status: 413,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Validate each worker record
    const validationErrors: WorkerCreationError[] = [];
    const validWorkers: WorkerRecord[] = [];

    for (let i = 0; i < payload.workers.length; i++) {
      const validationError = validateWorkerRecord(payload.workers[i], i);
      if (validationError) {
        validationErrors.push({
          firstName: payload.workers[i].firstName,
          workerId: payload.workers[i].workerId,
          lineId: payload.workers[i].lineId,
          reason: validationError,
        });
      } else {
        validWorkers.push(payload.workers[i]);
      }
    }

    // ════════════════════════════════════════════════════════════════════
    // 3. Create auth accounts and database records
    // ════════════════════════════════════════════════════════════════════
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const createdWorkers: WorkerAccountCreated[] = [];

    for (const worker of validWorkers) {
      const email = constructEmail(worker.firstName, worker.workerId);
      const plainTextPin = generatePin();

      try {
        // Create auth account with admin API
        const { data: authData, error: authError } =
          await supabase.auth.admin.createUser({
            email,
            password: plainTextPin,
            email_confirm: true, // Auto-confirm email
            user_metadata: {
              firstName: worker.firstName,
              workerId: worker.workerId,
              lineId: worker.lineId,
            },
          });

        if (authError) {
          validationErrors.push({
            firstName: worker.firstName,
            workerId: worker.workerId,
            lineId: worker.lineId,
            reason: `Auth creation failed: ${authError.message}`,
          });
          continue;
        }

        const userId = authData?.user?.id;
        if (!userId) {
          validationErrors.push({
            firstName: worker.firstName,
            workerId: worker.workerId,
            lineId: worker.lineId,
            reason: "Auth creation failed: No user ID returned",
          });
          continue;
        }

        // Insert into operators table (not workers)
        const { error: dbError } = await supabase.from("operators").insert({
          id: userId,
          internal_email: email,
          name: worker.firstName,
          worker_id: worker.workerId,
          line_id: worker.lineId,
          created_at: new Date().toISOString(),
        });

        if (dbError) {
          validationErrors.push({
            firstName: worker.firstName,
            workerId: worker.workerId,
            lineId: worker.lineId,
            reason: `Database insert failed: ${dbError.message}`,
          });
          continue;
        }

        createdWorkers.push({
          id: userId,
          email,
          firstName: worker.firstName,
          workerId: worker.workerId,
          lineId: worker.lineId,
          plainTextPin,
        });
      } catch (error) {
        validationErrors.push({
          firstName: worker.firstName,
          workerId: worker.workerId,
          lineId: worker.lineId,
          reason: `Unexpected error: ${error.message}`,
        });
      }
    }

    // ════════════════════════════════════════════════════════════════════
    // 4. Return response
    // ════════════════════════════════════════════════════════════════════
    const response: BulkCreateResponse = {
      success: createdWorkers,
      failed: validationErrors,
      summary: {
        total: payload.workers.length,
        created: createdWorkers.length,
        failed: validationErrors.length,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
