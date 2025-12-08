import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-machine-api-key",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const apiKey = req.headers.get("x-machine-api-key");

    if (!apiKey) {
      console.error("No API key provided");
      return new Response(JSON.stringify({ error: "API key required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify machine API key
    const { data: machine, error: machineError } = await supabase
      .from("vendx_machines")
      .select("id, machine_code, name, machine_type, status, vendx_pay_enabled")
      .eq("api_key", apiKey)
      .maybeSingle();

    if (machineError || !machine) {
      console.error("Invalid API key or machine not found");
      return new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (machine.status !== "active") {
      return new Response(JSON.stringify({ error: "Machine is not active" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!machine.vendx_pay_enabled) {
      return new Response(JSON.stringify({ error: "VendX Pay not enabled on this machine" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update last_seen
    await supabase
      .from("vendx_machines")
      .update({ last_seen: new Date().toISOString() })
      .eq("id", machine.id);

    console.log("Machine authenticated:", machine.machine_code);

    return new Response(
      JSON.stringify({
        success: true,
        machine: {
          id: machine.id,
          code: machine.machine_code,
          name: machine.name,
          type: machine.machine_type,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Machine auth error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
