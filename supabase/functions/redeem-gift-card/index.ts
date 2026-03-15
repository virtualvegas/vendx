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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { code } = await req.json();

    if (!code || typeof code !== "string") {
      return new Response(JSON.stringify({ error: "Gift card code is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedCode = code.trim().toUpperCase();

    // Use service role to update gift card
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Find the gift card
    const { data: giftCard, error: findError } = await adminClient
      .from("gift_cards")
      .select("*")
      .eq("code", normalizedCode)
      .single();

    if (findError || !giftCard) {
      return new Response(JSON.stringify({ error: "Invalid gift card code" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (giftCard.status !== "active") {
      return new Response(JSON.stringify({ error: `Gift card is ${giftCard.status}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (giftCard.expires_at && new Date(giftCard.expires_at) < new Date()) {
      await adminClient.from("gift_cards").update({ status: "expired" }).eq("id", giftCard.id);
      return new Response(JSON.stringify({ error: "Gift card has expired" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const amount = Number(giftCard.remaining_value);
    if (amount <= 0) {
      return new Response(JSON.stringify({ error: "Gift card has no remaining value" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's wallet
    const { data: wallet, error: walletError } = await adminClient
      .from("wallets")
      .select("id, balance")
      .eq("user_id", userData.user.id)
      .in("wallet_type", ["standard", "guest"])
      .is("parent_wallet_id", null)
      .single();

    if (walletError || !wallet) {
      return new Response(JSON.stringify({ error: "Wallet not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update wallet balance
    const newBalance = Number(wallet.balance) + amount;
    const { error: updateWalletError } = await adminClient
      .from("wallets")
      .update({ balance: newBalance, last_loaded: new Date().toISOString() })
      .eq("id", wallet.id);

    if (updateWalletError) throw updateWalletError;

    // Record transaction
    await adminClient.from("wallet_transactions").insert({
      wallet_id: wallet.id,
      amount: amount,
      transaction_type: "load",
      description: `Gift card redeemed: ${normalizedCode}`,
      status: "completed",
    });

    // Mark gift card as redeemed
    await adminClient.from("gift_cards").update({
      remaining_value: 0,
      status: "fully_redeemed",
      redeemed_by: userData.user.id,
      redeemed_at: new Date().toISOString(),
    }).eq("id", giftCard.id);

    console.log("Gift card redeemed:", normalizedCode, "amount:", amount, "user:", userData.user.id);

    return new Response(JSON.stringify({ 
      success: true, 
      amount, 
      new_balance: newBalance,
      message: `$${amount.toFixed(2)} added to your wallet!`
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error redeeming gift card:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
