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

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Machine API key required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Demo mode support
    const isDemoMode = apiKey === "demo-api-key";
    let machine = { id: "demo", machine_code: "DEMO", name: "Demo Machine" };

    if (!isDemoMode) {
      // Verify machine
      const { data: realMachine } = await supabase
        .from("vendx_machines")
        .select("id, machine_code, name")
        .eq("api_key", apiKey)
        .eq("status", "active")
        .maybeSingle();

      if (!realMachine) {
        return new Response(JSON.stringify({ error: "Invalid or inactive machine" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      machine = realMachine;
    }

    const { session_code, amount, item_name } = await req.json();

    if (!session_code || !amount || amount <= 0) {
      return new Response(JSON.stringify({ error: "Session code and valid amount required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let userId: string;
    let sessionId: string | null = null;

    // Demo mode: get user from JWT token
    if (isDemoMode && session_code === "DEMO") {
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

      userId = user.id;
      console.log("Demo mode purchase for user:", userId);
    } else {
      // Production mode: verify session from database
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

      userId = session.user_id;
      sessionId = session.id;
    }

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

    // Create wallet transaction (skip machine_id for demo)
    const walletTxData: Record<string, unknown> = {
      wallet_id: wallet.id,
      amount: -amount,
      transaction_type: "purchase",
      description: item_name ? `Purchase: ${item_name}` : "Machine purchase",
    };
    if (!isDemoMode) {
      walletTxData.machine_id = machine.id;
    }
    
    const { data: walletTx, error: txError } = await supabase
      .from("wallet_transactions")
      .insert(walletTxData)
      .select("id")
      .single();

    if (txError) throw txError;

    // Create machine transaction (skip for demo mode)
    if (!isDemoMode && sessionId) {
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
    }

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

      // Log point transaction
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
    if (!isDemoMode) {
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
    }

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
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
