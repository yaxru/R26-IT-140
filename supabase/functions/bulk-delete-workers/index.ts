import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Use the Service Role Key to bypass RLS and access the Admin Auth API
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const payload = await req.json();
    const { userIds } = payload;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "An array of userIds is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    const results = { success: 0, failed: 0, errors: [] as string[] };

    // Loop through and delete from Supabase Auth.
    // NOTE: Because your public.operators table uses "ON DELETE CASCADE",
    // deleting them from Auth automatically wipes their records from all other tables.
    for (const id of userIds) {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
      if (error) {
        results.failed++;
        results.errors.push(`Failed to delete ${id}: ${error.message}`);
      } else {
        results.success++;
      }
    }

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
