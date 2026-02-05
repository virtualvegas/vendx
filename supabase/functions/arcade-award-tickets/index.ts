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
      return new Response(JSON.stringify({ error: "Machine API key required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Demo mode support
    const isDemoMode = apiKey === "demo-api-key";
    let machine: { id: string; machine_code: string; name: string; location_id: string | null } = {
      id: "demo",
      machine_code: "DEMO",
      name: "Demo Arcade",
      location_id: null,
    };

    if (!isDemoMode) {
      // Verify machine is active and is an arcade type
      const { data: realMachine } = await supabase
        .from("vendx_machines")
        .select("id, machine_code, name, location_id, machine_type")
        .eq("api_key", apiKey)
        .eq("status", "active")
        .in("machine_type", ["arcade", "claw"])
        .maybeSingle();

      if (!realMachine) {
        return new Response(JSON.stringify({ error: "Invalid or inactive arcade machine" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      machine = realMachine;
    }

    const body = await req.json();
    const { 
      user_id, 
      session_id, 
      tickets, 
      game_name, 
      score, 
      idempotency_key 
    } = body;

    // Validate required fields
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!tickets || tickets <= 0) {
      return new Response(JSON.stringify({ error: "Valid ticket amount required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate idempotency key if not provided
    const finalIdempotencyKey = idempotency_key || 
      `${machine.id}-${user_id}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    console.log("Awarding tickets:", {
      machine: machine.machine_code,
      user_id,
      tickets,
      game_name,
      idempotency_key: finalIdempotencyKey,
    });

    // Call the award_tickets function
    const { data: result, error: awardError } = await supabase.rpc("award_tickets", {
      p_user_id: user_id,
      p_machine_id: isDemoMode ? null : machine.id,
      p_session_id: session_id || null,
      p_amount: tickets,
      p_game_name: game_name || null,
      p_score: score || null,
      p_idempotency_key: finalIdempotencyKey,
      p_metadata: JSON.stringify({
        machine_code: machine.machine_code,
        machine_name: machine.name,
        awarded_via: "arcade-award-tickets",
      }),
    });

    if (awardError) {
      console.error("Award tickets error:", awardError);
      return new Response(JSON.stringify({ error: awardError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const awardResult = result?.[0];

    if (!awardResult?.success) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: awardResult?.message || "Failed to award tickets" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Tickets awarded successfully:", {
      transaction_id: awardResult.transaction_id,
      new_balance: awardResult.new_balance,
      message: awardResult.message,
    });

    // Log machine activity for arcade play
    if (!isDemoMode) {
      await supabase.rpc("log_machine_activity", {
        p_machine_id: machine.id,
        p_activity_type: "play",
        p_user_id: user_id,
        p_session_id: session_id || null,
        p_amount: 0, // Revenue tracked separately via VendX Pay
        p_credits_used: 1,
        p_item_name: game_name || null,
        p_metadata: JSON.stringify({
          tickets_awarded: tickets,
          score: score || null,
          is_jackpot: awardResult.message === "JACKPOT!",
          transaction_id: awardResult.transaction_id,
        }),
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        tickets_awarded: tickets,
        new_balance: awardResult.new_balance,
        transaction_id: awardResult.transaction_id,
        is_jackpot: awardResult.message === "JACKPOT!",
        message: awardResult.message,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Award tickets error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
