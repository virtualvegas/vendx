import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    // Get user from JWT
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { amount, reason, prize_id, prize_name } = await req.json();

    if (!amount || amount <= 0) {
      return new Response(JSON.stringify({ error: "Valid amount required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Redeeming tickets:", {
      user_id: user.id,
      amount,
      reason,
      prize_id,
    });

    // Call the redeem_tickets function
    const { data: result, error: redeemError } = await supabase.rpc("redeem_tickets", {
      p_user_id: user.id,
      p_amount: amount,
      p_reason: reason || "Prize redemption",
      p_metadata: JSON.stringify({
        prize_id,
        prize_name,
        redeemed_via: "tickets-redeem",
      }),
    });

    if (redeemError) {
      console.error("Redeem tickets error:", redeemError);
      return new Response(JSON.stringify({ error: redeemError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const redeemResult = result?.[0];

    if (!redeemResult?.success) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: redeemResult?.message || "Failed to redeem tickets",
          current_balance: redeemResult?.new_balance || 0,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Tickets redeemed successfully:", {
      transaction_id: redeemResult.transaction_id,
      new_balance: redeemResult.new_balance,
    });

    return new Response(
      JSON.stringify({
        success: true,
        tickets_redeemed: amount,
        new_balance: redeemResult.new_balance,
        transaction_id: redeemResult.transaction_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Redeem tickets error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
