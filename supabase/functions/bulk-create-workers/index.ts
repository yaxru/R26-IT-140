import { createClient } from "@supabase/supabase-js";

// ============================================================================
// Types
// ============================================================================
interface WorkerRecord {
  firstName: string;
  workerId: string;
  lineId: string;
  phoneNumber?: string;
  contactEmail?: string;
  primarySkill: string;
  proficiencyGrade: string;
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
  contactEmail?: string;
  phoneNumber?: string;
  primarySkill: string;
  proficiencyGrade: string;
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
function generatePin(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

function validateWorkerRecord(
  worker: WorkerRecord,
  index: number,
): string | null {
  if (!worker.firstName) return `Record ${index}: Missing firstName`;
  if (!worker.workerId) return `Record ${index}: Missing workerId`;
  if (!/^\d{4}$/.test(worker.workerId))
    return `Record ${index}: workerId must be 4 digits`;
  if (!worker.lineId) return `Record ${index}: Missing lineId`;
  if (!worker.primarySkill) return `Record ${index}: Missing primarySkill`;

  if (!worker.proficiencyGrade)
    return `Record ${index}: Missing proficiencyGrade`;
  const grade = worker.proficiencyGrade.toUpperCase().trim();
  if (!["A", "B", "C"].includes(grade)) {
    return `Record ${index}: proficiencyGrade must be exactly A, B, or C`;
  }

  return null;
}

function constructEmail(firstName: string, workerId: string): string {
  return `${firstName.toLowerCase()}.${workerId}@${WORKER_EMAIL_DOMAIN}`;
}

async function verifyToken(
  authHeader: string,
  supabaseUrl: string,
  supabaseKey: string,
) {
  if (!authHeader.startsWith("Bearer "))
    throw new Error("Invalid Authorization header format");
  const token = authHeader.slice(7);
  const supabase = createClient(supabaseUrl, supabaseKey);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user)
    throw new Error(`Token verification failed: ${error?.message}`);
  return { id: user.id, email: user.email || "" };
}

// ============================================================================
// Main Handler
// ============================================================================
Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing config" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    try {
      await verifyToken(authHeader, supabaseUrl, supabaseKey);
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: `Auth failed: ${error.message}` }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    let payload: BulkCreateRequest;
    try {
      payload = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (
      !Array.isArray(payload.workers) ||
      payload.workers.length > MAX_WORKERS_PER_REQUEST
    ) {
      return new Response(
        JSON.stringify({ error: "Invalid payload or exceeds limit" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    const validationErrors: WorkerCreationError[] = [];
    const validWorkers: WorkerRecord[] = [];

    for (let i = 0; i < payload.workers.length; i++) {
      const error = validateWorkerRecord(payload.workers[i], i);
      if (error) {
        validationErrors.push({ ...payload.workers[i], reason: error });
      } else {
        validWorkers.push(payload.workers[i]);
      }
    }

    // Use the Service Role Key to bypass RLS for admin operations
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    // ========================================================================
    // 1. Automatically create missing Factory Lines from the CSV data
    // ========================================================================
    const uniqueLines = Array.from(new Set(validWorkers.map(w => w.lineId)));
    if (uniqueLines.length > 0) {
      const linePayloads = uniqueLines.map(line => ({
        line_id: line,
        ml_team_number: 1.0 // Default placeholder
      }));
      
      const { error: lineError } = await supabase
        .from("factory_lines")
        .upsert(linePayloads, { onConflict: "line_id" });
        
      if (lineError) {
        console.error("Failed to upsert factory lines:", lineError);
      }
    }
    // ========================================================================

    const createdWorkers: WorkerAccountCreated[] = [];

    for (const worker of validWorkers) {
      const email = constructEmail(worker.firstName, worker.workerId);
      const plainTextPin = generatePin();
      const grade = worker.proficiencyGrade.toUpperCase().trim();

      try {
        // 2. Create Auth Account
        const { data: authData, error: authError } =
          await supabase.auth.admin.createUser({
            email,
            password: plainTextPin,
            email_confirm: true,
            user_metadata: {
              firstName: worker.firstName,
              workerId: worker.workerId,
              lineId: worker.lineId,
            },
          });

        if (authError)
          throw new Error(`Auth creation failed: ${authError.message}`);
        const userId = authData?.user?.id;
        if (!userId) throw new Error("No user ID returned");

        // 3. Insert into Operators table
        const { error: dbError } = await supabase.from("operators").insert({
          id: userId,
          internal_email: email,
          name: worker.firstName,
          worker_id: worker.workerId,
          phone_number: worker.phoneNumber || null,
          contact_email: worker.contactEmail || null,
        });
        if (dbError) throw new Error(`DB insert failed: ${dbError.message}`);

        // 4. Auto-assign Line Productivity Status
        const { error: prodError } = await supabase
          .from("operator_productivity")
          .insert({
            operator_id: userId,
            current_line_id: worker.lineId,
            productivity_level: 0.0,
          });
        if (prodError)
          throw new Error(`Productivity assignment failed: ${prodError.message}`);

        // 5. Auto-assign Primary Skill
        const { error: skillError } = await supabase
          .from("skill_matrix")
          .insert({
            operator_id: userId,
            machine_type: worker.primarySkill,
            proficiency_grade: grade,
          });
        if (skillError)
          throw new Error(`Skill assignment failed: ${skillError.message}`);

        createdWorkers.push({
          id: userId,
          email,
          firstName: worker.firstName,
          workerId: worker.workerId,
          lineId: worker.lineId,
          plainTextPin,
          contactEmail: worker.contactEmail,
          phoneNumber: worker.phoneNumber,
          primarySkill: worker.primarySkill,
          proficiencyGrade: grade,
        });
      } catch (error: any) {
        validationErrors.push({ ...worker, reason: error.message });
      }
    }

    return new Response(
      JSON.stringify({
        success: createdWorkers,
        failed: validationErrors,
        summary: {
          total: payload.workers.length,
          created: createdWorkers.length,
          failed: validationErrors.length,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }
});