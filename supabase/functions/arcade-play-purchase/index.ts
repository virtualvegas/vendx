import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Points earned per dollar based on tier
const TIER_POINTS_RATE: Record<string, number> = {
  bronze: 10,
  silver: 12,
  gold: 15,
  platinum: 20,
};

interface PriceBundle {
  plays: number;
  price: number;
  label: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get user from auth header
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { 
      machine_id, 
      pricing_type = "single", // 'single', 'bundle', 'template_bundle'
      bundle_index,
      child_wallet_id 
    } = await req.json();

    if (!machine_id) {
      return new Response(JSON.stringify({ error: "Machine ID required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get machine details with pricing
    const { data: machine } = await supabase
      .from("vendx_machines")
      .select(`
        id, name, machine_code, status, machine_type, location_id,
        price_per_play, plays_per_bundle, bundle_price, pricing_template_id
      `)
      .eq("id", machine_id)
      .maybeSingle();

    if (!machine) {
      return new Response(JSON.stringify({ error: "Machine not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (machine.status !== "active") {
      return new Response(JSON.stringify({ error: "Machine is not active" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine pricing
    let amount: number;
    let plays: number;
    let pricingLabel: string;

    // Check if machine uses a template
    let bundles: PriceBundle[] = [];
    if (machine.pricing_template_id) {
      const { data: template } = await supabase
        .from("arcade_pricing_templates")
        .select("price_per_play, bundles")
        .eq("id", machine.pricing_template_id)
        .maybeSingle();

      if (template) {
        machine.price_per_play = template.price_per_play;
        bundles = (template.bundles as unknown as PriceBundle[]) || [];
      }
    }

    if (pricing_type === "single") {
      amount = machine.price_per_play || 1.00;
      plays = 1;
      pricingLabel = "Single Play";
    } else if (pricing_type === "bundle" && machine.bundle_price && machine.plays_per_bundle) {
      amount = machine.bundle_price;
      plays = machine.plays_per_bundle;
      pricingLabel = `${plays} Plays Bundle`;
    } else if (pricing_type === "template_bundle" && bundles.length > 0 && bundle_index !== undefined) {
      const selectedBundle = bundles[bundle_index];
      if (!selectedBundle) {
        return new Response(JSON.stringify({ error: "Invalid bundle selection" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      amount = selectedBundle.price;
      plays = selectedBundle.plays;
      pricingLabel = selectedBundle.label;
    } else {
      amount = machine.price_per_play || 1.00;
      plays = 1;
      pricingLabel = "Single Play";
    }

    // Determine which wallet to use
    let walletUserId = user.id;
    let walletId: string;
    let isChildWallet = false;

    if (child_wallet_id) {
      // Verify parent owns this child wallet
      const { data: childWallet } = await supabase
        .from("wallets")
        .select("id, user_id, parent_wallet_id, wallet_type, balance")
        .eq("id", child_wallet_id)
        .maybeSingle();

      if (!childWallet || childWallet.wallet_type !== "child") {
        return new Response(JSON.stringify({ error: "Invalid child wallet" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get parent wallet
      const { data: parentWallet } = await supabase
        .from("wallets")
        .select("id, user_id")
        .eq("user_id", user.id)
        .in("wallet_type", ["standard", "guest"])
        .is("parent_wallet_id", null)
        .maybeSingle();

      if (!parentWallet || childWallet.parent_wallet_id !== parentWallet.id) {
        return new Response(JSON.stringify({ error: "Not authorized to use this wallet" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      walletId = childWallet.id;
      isChildWallet = true;
    } else {
      // Get user's standard wallet
      const { data: userWallet } = await supabase
        .from("wallets")
        .select("id, balance")
        .eq("user_id", user.id)
        .eq("wallet_type", "standard")
        .maybeSingle();

      if (!userWallet) {
        return new Response(JSON.stringify({ error: "Wallet not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      walletId = userWallet.id;
    }

    // Check spending limits using the function
    const { data: limitCheck } = await supabase.rpc("check_wallet_spending_limits", {
      p_wallet_id: walletId,
      p_amount: amount,
    });

    if (!limitCheck || !limitCheck[0]?.allowed) {
      return new Response(JSON.stringify({ 
        error: limitCheck?.[0]?.reason || "Payment not allowed",
        remaining: limitCheck?.[0]?.remaining_daily || 0,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get wallet balance
    const { data: wallet } = await supabase
      .from("wallets")
      .select("id, balance")
      .eq("id", walletId)
      .single();

    if (!wallet || wallet.balance < amount) {
      return new Response(JSON.stringify({ 
        error: "Insufficient balance",
        balance: wallet?.balance || 0,
        required: amount,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduct from wallet
    const newBalance = wallet.balance - amount;
    const { error: walletError } = await supabase
      .from("wallets")
      .update({ balance: newBalance })
      .eq("id", walletId);

    if (walletError) throw walletError;

    // Create wallet transaction
    const { data: walletTx, error: txError } = await supabase
      .from("wallet_transactions")
      .insert({
        wallet_id: walletId,
        amount: -amount,
        transaction_type: "arcade_play",
        description: `${pricingLabel} at ${machine.name}`,
        machine_id: machine.id,
      })
      .select("id")
      .single();

    if (txError) throw txError;

    // Create arcade play session
    const { data: playSession, error: sessionError } = await supabase
      .from("arcade_play_sessions")
      .insert({
        user_id: user.id,
        wallet_id: walletId,
        machine_id: machine.id,
        amount: amount,
        plays_purchased: plays,
        plays_used: 0,
        status: "active",
        payment_method: "wallet",
        pricing_type: pricing_type,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min expiry
      })
      .select("id, plays_purchased, expires_at")
      .single();

    if (sessionError) throw sessionError;

    // Get user's rewards tier for points calculation
    const { data: rewardsRecord } = await supabase
      .from("rewards_points")
      .select("id, balance, lifetime_points, tier")
      .eq("user_id", user.id)
      .maybeSingle();

    const tier = rewardsRecord?.tier || "bronze";
    const pointsRate = TIER_POINTS_RATE[tier] || 10;
    const pointsEarned = Math.floor(amount * pointsRate);

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
          user_id: user.id,
          points: pointsEarned,
          transaction_type: "earn",
          description: `Arcade play at ${machine.name}`,
          reference_id: walletTx.id,
        });
    }

    // Log machine activity
    await supabase.rpc("log_machine_activity", {
      p_machine_id: machine.id,
      p_activity_type: "play",
      p_user_id: user.id,
      p_session_id: playSession.id,
      p_amount: amount,
      p_credits_used: plays,
      p_item_name: pricingLabel,
      p_metadata: JSON.stringify({
        wallet_tx_id: walletTx.id,
        points_earned: pointsEarned,
        is_child_wallet: isChildWallet,
        pricing_type: pricing_type,
      }),
    });

    // Log to synced_transactions for unified finance view
    await supabase.from("synced_transactions").insert({
      provider: "vendx_pay",
      provider_transaction_id: `arcade_${walletTx.id}`,
      transaction_type: "revenue",
      amount: amount,
      currency: "usd",
      status: "completed",
      description: `Arcade: ${pricingLabel} at ${machine.name}`,
      customer_email: user.email || null,
      customer_name: null,
      transaction_date: new Date().toISOString(),
      metadata: { source: "arcade", machine_code: machine.machine_code, plays, pricing_type, session_id: playSession.id },
      synced_at: new Date().toISOString(),
    });

    console.log("Arcade play purchased:", {
      user_id: user.id,
      machine: machine.machine_code,
      plays,
      amount,
      points_earned: pointsEarned,
      session_id: playSession.id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        session_id: playSession.id,
        plays_purchased: plays,
        amount_charged: amount,
        new_balance: newBalance,
        points_earned: pointsEarned,
        expires_at: playSession.expires_at,
        machine_name: machine.name,
        pricing_label: pricingLabel,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Arcade play purchase error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
