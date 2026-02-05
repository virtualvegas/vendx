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

    const { 
      prize_id, 
      location_id, 
      redemption_type = "online",
      shipping_address_id 
    } = await req.json();

    if (!prize_id) {
      return new Response(JSON.stringify({ error: "Prize ID required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Processing ticket redemption:", {
      user_id: user.id,
      prize_id,
      location_id,
      redemption_type,
    });

    // Call the process_ticket_redemption function
    const { data: result, error: redeemError } = await supabase.rpc(
      "process_ticket_redemption",
      {
        p_user_id: user.id,
        p_prize_id: prize_id,
        p_location_id: location_id || null,
        p_redemption_type: redemption_type,
        p_shipping_address_id: shipping_address_id || null,
      }
    );

    if (redeemError) {
      console.error("Redemption error:", redeemError);
      return new Response(JSON.stringify({ error: redeemError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const redemptionResult = result?.[0];

    if (!redemptionResult?.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: redemptionResult?.message || "Failed to process redemption",
          new_balance: redemptionResult?.new_balance,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Redemption successful:", {
      redemption_id: redemptionResult.redemption_id,
      redemption_code: redemptionResult.redemption_code,
      new_balance: redemptionResult.new_balance,
    });

    return new Response(
      JSON.stringify({
        success: true,
        redemption_id: redemptionResult.redemption_id,
        redemption_code: redemptionResult.redemption_code,
        new_balance: redemptionResult.new_balance,
        message: "Prize redeemed successfully!",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Ticket redemption error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
