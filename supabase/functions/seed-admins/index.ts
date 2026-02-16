import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMINS = [
  { username: "purumedhe", password: "mango_plw", name: "Purushottam Medhe" },
  { username: "admin02", password: "admin02_plw", name: "Admin 02" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const results = [];

    for (const admin of ADMINS) {
      const email = `${admin.username}@legalworkspace.local`;

      // Check if already exists
      const { data: existing } = await supabase
        .from("profiles")
        .select("username")
        .eq("username", admin.username)
        .maybeSingle();

      if (existing) {
        results.push({ username: admin.username, status: "already_exists" });
        continue;
      }

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: admin.password,
        email_confirm: true,
        user_metadata: { name: admin.name, username: admin.username, phone: "" },
      });

      if (authError) {
        results.push({ username: admin.username, status: "error", error: authError.message });
        continue;
      }

      // Add admin role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: authData.user.id, role: "admin" });

      if (roleError) {
        results.push({ username: admin.username, status: "user_created_role_failed", error: roleError.message });
      } else {
        results.push({ username: admin.username, status: "created" });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
