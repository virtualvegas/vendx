import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-machine-api-key",
};

// Points earned per dollar based on tier
const TIER_POINTS_RATE: Record<string, number> = {
  bronze: 10,
  silver: 12,
  gold: 15,
  platinum: 20,
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
    const { session_code, amount, item_name, machine_id: bodyMachineId } = await req.json();

    // Support both api_key header (machine-to-machine) and machine_id in body (kiosk UI)
    let machine: { id: string; machine_code: string; name: string } | null = null;

    if (apiKey) {
      const { data } = await supabase
        .from("vendx_machines")
        .select("id, machine_code, name")
        .eq("api_key", apiKey)
        .eq("status", "active")
        .maybeSingle();
      machine = data;
    } else if (bodyMachineId && typeof bodyMachineId === "string") {
      const { data } = await supabase
        .from("vendx_machines")
        .select("id, machine_code, name")
        .eq("id", bodyMachineId)
        .eq("status", "active")
        .maybeSingle();
      machine = data;
    }

    if (!machine) {
      return new Response(JSON.stringify({ error: "Invalid or inactive machine" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Input validation
    if (!session_code || typeof session_code !== "string" || session_code.length > 50) {
      return new Response(JSON.stringify({ error: "Valid session_code required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!amount || typeof amount !== "number" || amount <= 0 || amount > 10000) {
      return new Response(JSON.stringify({ error: "Valid amount required (0.01-10000)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (item_name && (typeof item_name !== "string" || item_name.length > 200)) {
      return new Response(JSON.stringify({ error: "item_name must be under 200 characters" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify session from database
    const { data: session } = await supabase
      .from("machine_sessions")
      .select("id, user_id, status")
      .eq("session_code", session_code)
      .eq("status", "verified")
      .maybeSingle();

    if (!session || !session.user_id) {
      return new Response(JSON.stringify({ error: "Invalid or unverified session" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = session.user_id;
    const sessionId = session.id;

    // Get user's parent wallet
    const { data: wallet } = await supabase
      .from("wallets")
      .select("id, balance")
      .eq("user_id", userId)
      .in("wallet_type", ["standard", "guest"])
      .is("parent_wallet_id", null)
      .maybeSingle();

    if (!wallet) {
      return new Response(JSON.stringify({ error: "Wallet not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (wallet.balance < amount) {
      return new Response(
        JSON.stringify({ 
          error: "Insufficient balance", 
          balance: wallet.balance,
          required: amount 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user tier for points calculation
    const { data: rewardsRecord } = await supabase
      .from("rewards_points")
      .select("id, balance, lifetime_points, tier")
      .eq("user_id", userId)
      .maybeSingle();

    const tier = rewardsRecord?.tier || "bronze";
    const pointsRate = TIER_POINTS_RATE[tier] || 10;
    const pointsEarned = Math.floor(amount * pointsRate);

    // Deduct from wallet
    const newBalance = wallet.balance - amount;
    const { error: walletError } = await supabase
      .from("wallets")
      .update({ balance: newBalance })
      .eq("id", wallet.id);

    if (walletError) throw walletError;

    // Create wallet transaction
    const { data: walletTx, error: txError } = await supabase
      .from("wallet_transactions")
      .insert({
        wallet_id: wallet.id,
        amount: -amount,
        transaction_type: "purchase",
        description: item_name ? `Purchase: ${item_name}` : "Machine purchase",
        machine_id: machine.id,
      })
      .select("id")
      .single();

    if (txError) throw txError;

    // Create machine transaction
    await supabase
      .from("machine_transactions")
      .insert({
        machine_id: machine.id,
        user_id: userId,
        wallet_transaction_id: walletTx.id,
        amount: amount,
        item_name: item_name,
        points_earned: pointsEarned,
        session_id: sessionId,
      });

    // Award points
    if (rewardsRecord) {
      const newPointBalance = (rewardsRecord.balance || 0) + pointsEarned;
      const newLifetimePoints = (rewardsRecord.lifetime_points || 0) + pointsEarned;

      await supabase
        .from("rewards_points")
        .update({
          balance: newPointBalance,
          lifetime_points: newLifetimePoints,
        })
        .eq("id", rewardsRecord.id);

      await supabase
        .from("point_transactions")
        .insert({
          user_id: userId,
          points: pointsEarned,
          transaction_type: "earn",
          description: `Earned from purchase at ${machine.name}`,
          reference_id: walletTx.id,
        });
    }

    // Log machine activity
    await supabase.rpc("log_machine_activity", {
      p_machine_id: machine.id,
      p_activity_type: "vend",
      p_user_id: userId,
      p_session_id: sessionId,
      p_amount: amount,
      p_item_name: item_name || null,
      p_metadata: JSON.stringify({
        points_earned: pointsEarned,
        wallet_tx_id: walletTx.id,
      }),
    });

    // Log to synced_transactions for unified finance view
    await supabase.from("synced_transactions").insert({
      provider: "vendx_pay",
      provider_transaction_id: `vend_${walletTx.id}`,
      transaction_type: "revenue",
      amount: amount,
      currency: "usd",
      status: "completed",
      description: item_name ? `Vending: ${item_name} at ${machine.name}` : `Vending purchase at ${machine.name}`,
      customer_email: null,
      customer_name: null,
      transaction_date: new Date().toISOString(),
      metadata: { source: "vending", machine_code: machine.machine_code, wallet_tx_id: walletTx.id, points_earned: pointsEarned },
      synced_at: new Date().toISOString(),
    });

    console.log("Transaction processed:", {
      machine: machine.machine_code,
      amount,
      pointsEarned,
      newBalance,
    });

    return new Response(
      JSON.stringify({
        success: true,
        amount_charged: amount,
        new_balance: newBalance,
        points_earned: pointsEarned,
        tier: tier,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Process error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
