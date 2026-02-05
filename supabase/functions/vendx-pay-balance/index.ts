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

    const { session_code } = await req.json();
    const apiKey = req.headers.get("x-machine-api-key");

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Machine API key required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify machine
    const { data: machine } = await supabase
      .from("vendx_machines")
      .select("id")
      .eq("api_key", apiKey)
      .eq("status", "active")
      .maybeSingle();

    if (!machine) {
      return new Response(JSON.stringify({ error: "Invalid machine" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!session_code) {
      return new Response(JSON.stringify({ error: "Session code required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get session
    const { data: session } = await supabase
      .from("machine_sessions")
      .select("user_id, status")
      .eq("session_code", session_code)
      .maybeSingle();

    if (!session || session.status !== "verified") {
      return new Response(JSON.stringify({ error: "Session not verified" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get wallet balance (parent wallet)
    const { data: wallet } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", session.user_id)
      .in("wallet_type", ["standard", "guest"])
      .is("parent_wallet_id", null)
      .maybeSingle();

    // Get rewards info
    const { data: rewards } = await supabase
      .from("rewards_points")
      .select("balance, tier")
      .eq("user_id", session.user_id)
      .maybeSingle();

    console.log("Balance check for session:", session_code);

    return new Response(
      JSON.stringify({
        balance: wallet?.balance || 0,
        points: rewards?.balance || 0,
        tier: rewards?.tier || "bronze",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Balance check error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
