import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
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
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    const signature = req.headers.get("stripe-signature");
    const body = await req.text();

    let event: Stripe.Event;

    // For webhook signature verification (if webhook secret is set)
    const webhookSecret = Deno.env.get("STRIPE_WALLET_WEBHOOK_SECRET");
    if (webhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      } catch (err) {
        console.error("Webhook signature verification failed:", err);
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      event = JSON.parse(body);
    }

    console.log("Received Stripe event:", event.type);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      
      if (session.metadata?.type === "wallet_load") {
        const userId = session.metadata.user_id;
        const amount = parseFloat(session.metadata.amount);

        console.log("Processing wallet load for user:", userId, "amount:", amount);

        // Get or create wallet
        let { data: wallet, error: walletError } = await supabase
          .from("wallets")
          .select("id, balance")
          .eq("user_id", userId)
          .maybeSingle();

        if (!wallet) {
          const { data: newWallet, error: createError } = await supabase
            .from("wallets")
            .insert({ user_id: userId, balance: 0 })
            .select("id, balance")
            .single();
          
          if (createError) {
            console.error("Error creating wallet:", createError);
            throw createError;
          }
          wallet = newWallet;
        }

        // Update wallet balance
        const newBalance = (wallet.balance || 0) + amount;
        const { error: updateError } = await supabase
          .from("wallets")
          .update({ 
            balance: newBalance, 
            last_loaded: new Date().toISOString() 
          })
          .eq("id", wallet.id);

        if (updateError) {
          console.error("Error updating wallet:", updateError);
          throw updateError;
        }

        // Create transaction record
        const { error: txError } = await supabase
          .from("wallet_transactions")
          .insert({
            wallet_id: wallet.id,
            amount: amount,
            transaction_type: "load",
            description: `Added $${amount.toFixed(2)} via Stripe`,
            stripe_payment_intent_id: session.payment_intent as string,
          });

        if (txError) {
          console.error("Error creating transaction:", txError);
        }

        // Log to synced_transactions for unified finance view
        await supabase.from("synced_transactions").insert({
          provider: "vendx_pay",
          provider_transaction_id: `wallet_load_${session.payment_intent || session.id}`,
          transaction_type: "wallet_load",
          amount: amount,
          currency: "usd",
          status: "completed",
          description: `Wallet load via Stripe - $${amount.toFixed(2)}`,
          customer_email: null,
          customer_name: null,
          transaction_date: new Date().toISOString(),
          metadata: { source: "wallet_load", payment_method: "stripe", stripe_session_id: session.id },
          synced_at: new Date().toISOString(),
        });

        console.log("Wallet loaded successfully. New balance:", newBalance);
      }
    } else if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = charge.payment_intent as string;
      const refundAmount = (charge.amount_refunded || 0) / 100;

      console.log("Processing refund for payment intent:", paymentIntentId);

      // Find the original transaction
      const { data: originalTx } = await supabase
        .from("wallet_transactions")
        .select("wallet_id, amount")
        .eq("stripe_payment_intent_id", paymentIntentId)
        .eq("transaction_type", "load")
        .maybeSingle();

      if (originalTx) {
        // Deduct refund from wallet
        const { data: wallet } = await supabase
          .from("wallets")
          .select("id, balance")
          .eq("id", originalTx.wallet_id)
          .single();

        if (wallet) {
          const newBalance = Math.max(0, (wallet.balance || 0) - refundAmount);
          await supabase
            .from("wallets")
            .update({ balance: newBalance })
            .eq("id", wallet.id);

          // Record refund transaction
          await supabase
            .from("wallet_transactions")
            .insert({
              wallet_id: wallet.id,
              amount: -refundAmount,
              transaction_type: "refund",
              description: `Refund of $${refundAmount.toFixed(2)}`,
              stripe_payment_intent_id: paymentIntentId,
            });

          console.log("Refund processed. New balance:", newBalance);
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Webhook error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
