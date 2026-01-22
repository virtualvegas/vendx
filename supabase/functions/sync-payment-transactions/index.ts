import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  console.log(`[SYNC-TRANSACTIONS] ${step}`, details ? JSON.stringify(details) : "");
};

// PayPal sync now uses internal records instead of Transaction Search API

async function syncStripeTransactions(supabase: any, startDate?: string): Promise<number> {
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    throw new Error("Stripe secret key not configured");
  }

  const stripe = new Stripe(stripeKey, {
    apiVersion: "2023-10-16",
    httpClient: Stripe.createFetchHttpClient(),
  });

  logStep("Starting Stripe sync");

  // Update sync status to syncing
  await supabase
    .from("transaction_sync_status")
    .update({ sync_status: "syncing", error_message: null, updated_at: new Date().toISOString() })
    .eq("provider", "stripe");

  let synced = 0;
  let hasMore = true;
  let startingAfter: string | undefined;

  // Calculate date range (last 30 days if no start date)
  const createdGte = startDate 
    ? Math.floor(new Date(startDate).getTime() / 1000)
    : Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);

  try {
    while (hasMore) {
      const params: any = {
        limit: 100,
        created: { gte: createdGte },
        expand: ["data.customer"],
      };
      if (startingAfter) params.starting_after = startingAfter;

      const charges = await stripe.charges.list(params);
      logStep(`Fetched ${charges.data.length} Stripe charges`);

      for (const charge of charges.data) {
        if (charge.status !== "succeeded") continue;

        const customer = charge.customer as Stripe.Customer | null;
        
        const transaction = {
          provider: "stripe",
          provider_transaction_id: charge.id,
          transaction_type: charge.refunded ? "refund" : "revenue",
          amount: charge.amount / 100,
          currency: charge.currency,
          status: charge.status,
          description: charge.description || `Stripe charge ${charge.id}`,
          customer_email: charge.billing_details?.email || customer?.email || null,
          customer_name: charge.billing_details?.name || customer?.name || null,
          transaction_date: new Date(charge.created * 1000).toISOString(),
          metadata: {
            payment_method: charge.payment_method_details?.type,
            receipt_url: charge.receipt_url,
            payment_intent: charge.payment_intent,
          },
          synced_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from("synced_transactions")
          .upsert(transaction, { onConflict: "provider,provider_transaction_id" });

        if (error) {
          logStep("Error upserting Stripe transaction", { error, id: charge.id });
        } else {
          synced++;
        }
      }

      hasMore = charges.has_more;
      if (charges.data.length > 0) {
        startingAfter = charges.data[charges.data.length - 1].id;
      }
    }

    // Also sync refunds
    hasMore = true;
    startingAfter = undefined;

    while (hasMore) {
      const params: any = {
        limit: 100,
        created: { gte: createdGte },
        expand: ["data.charge"],
      };
      if (startingAfter) params.starting_after = startingAfter;

      const refunds = await stripe.refunds.list(params);
      logStep(`Fetched ${refunds.data.length} Stripe refunds`);

      for (const refund of refunds.data) {
        const charge = refund.charge as Stripe.Charge | null;

        const transaction = {
          provider: "stripe",
          provider_transaction_id: `refund_${refund.id}`,
          transaction_type: "refund",
          amount: -(refund.amount / 100),
          currency: refund.currency,
          status: refund.status || "succeeded",
          description: refund.reason || `Refund for charge ${charge?.id}`,
          customer_email: charge?.billing_details?.email || null,
          customer_name: charge?.billing_details?.name || null,
          transaction_date: new Date(refund.created * 1000).toISOString(),
          metadata: {
            original_charge: charge?.id,
            reason: refund.reason,
          },
          synced_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from("synced_transactions")
          .upsert(transaction, { onConflict: "provider,provider_transaction_id" });

        if (error) {
          logStep("Error upserting Stripe refund", { error, id: refund.id });
        } else {
          synced++;
        }
      }

      hasMore = refunds.has_more;
      if (refunds.data.length > 0) {
        startingAfter = refunds.data[refunds.data.length - 1].id;
      }
    }

    // Update sync status to completed
    await supabase
      .from("transaction_sync_status")
      .update({ 
        sync_status: "completed", 
        last_sync_at: new Date().toISOString(),
        transactions_synced: synced,
        error_message: null,
        updated_at: new Date().toISOString()
      })
      .eq("provider", "stripe");

    logStep(`Stripe sync complete: ${synced} transactions`);
    return synced;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await supabase
      .from("transaction_sync_status")
      .update({ sync_status: "error", error_message: message, updated_at: new Date().toISOString() })
      .eq("provider", "stripe");
    throw error;
  }
}

async function syncPayPalTransactions(supabase: any, startDate?: string): Promise<number> {
  logStep("Starting PayPal sync from internal records");

  // Update sync status to syncing
  await supabase
    .from("transaction_sync_status")
    .update({ sync_status: "syncing", error_message: null, updated_at: new Date().toISOString() })
    .eq("provider", "paypal");

  let synced = 0;

  try {
    // Calculate date range (last 30 days if no start date)
    const start = startDate 
      ? new Date(startDate).toISOString()
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Sync PayPal store orders from internal records
    const { data: paypalOrders, error: ordersError } = await supabase
      .from("store_orders")
      .select("*, profiles:user_id(email, full_name)")
      .eq("payment_method", "paypal")
      .not("paypal_order_id", "is", null)
      .gte("created_at", start)
      .order("created_at", { ascending: false });

    if (ordersError) {
      logStep("Error fetching PayPal orders", { error: ordersError });
    } else {
      logStep(`Found ${paypalOrders?.length || 0} PayPal store orders`);

      for (const order of paypalOrders || []) {
        const transaction = {
          provider: "paypal",
          provider_transaction_id: order.paypal_order_id,
          transaction_type: "revenue",
          amount: Number(order.total),
          currency: "USD",
          status: order.status === "paid" ? "completed" : order.status,
          description: `Store Order ${order.order_number || order.id}`,
          customer_email: order.profiles?.email || null,
          customer_name: order.profiles?.full_name || null,
          transaction_date: order.created_at,
          metadata: {
            order_id: order.id,
            order_number: order.order_number,
            source: "store",
          },
          synced_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from("synced_transactions")
          .upsert(transaction, { onConflict: "provider,provider_transaction_id" });

        if (error) {
          logStep("Error upserting PayPal order", { error, id: order.paypal_order_id });
        } else {
          synced++;
        }
      }
    }

    // Sync PayPal wallet transactions from internal records
    const { data: walletTxns, error: walletError } = await supabase
      .from("wallet_transactions")
      .select("*, wallets:wallet_id(user_id, profiles:user_id(email, full_name))")
      .eq("transaction_type", "load")
      .ilike("description", "%PayPal%")
      .gte("created_at", start)
      .order("created_at", { ascending: false });

    if (walletError) {
      logStep("Error fetching PayPal wallet transactions", { error: walletError });
    } else {
      logStep(`Found ${walletTxns?.length || 0} PayPal wallet loads`);

      for (const txn of walletTxns || []) {
        const refId = txn.reference_id || `wallet_${txn.id}`;
        const transaction = {
          provider: "paypal",
          provider_transaction_id: refId,
          transaction_type: "revenue",
          amount: Number(txn.amount),
          currency: "USD",
          status: "completed",
          description: txn.description || "Wallet load via PayPal",
          customer_email: txn.wallets?.profiles?.email || null,
          customer_name: txn.wallets?.profiles?.full_name || null,
          transaction_date: txn.created_at,
          metadata: {
            wallet_transaction_id: txn.id,
            source: "wallet",
          },
          synced_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from("synced_transactions")
          .upsert(transaction, { onConflict: "provider,provider_transaction_id" });

        if (error) {
          logStep("Error upserting PayPal wallet transaction", { error, id: refId });
        } else {
          synced++;
        }
      }
    }

    // Update sync status to completed
    await supabase
      .from("transaction_sync_status")
      .update({ 
        sync_status: "completed", 
        last_sync_at: new Date().toISOString(),
        transactions_synced: synced,
        error_message: null,
        updated_at: new Date().toISOString()
      })
      .eq("provider", "paypal");

    logStep(`PayPal sync complete: ${synced} transactions from internal records`);
    return synced;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await supabase
      .from("transaction_sync_status")
      .update({ sync_status: "error", error_message: message, updated_at: new Date().toISOString() })
      .eq("provider", "paypal");
    throw error;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify user has finance role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization required");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Invalid authorization");
    }

    // Check if user has finance role
    const { data: roles } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const hasAccess = roles?.some(r => 
      r.role === "super_admin" || r.role === "finance_accounting"
    );

    if (!hasAccess) {
      throw new Error("Access denied: Finance role required");
    }

    const { provider, startDate } = await req.json();
    logStep("Sync request received", { provider, startDate, userId: user.id });

    let stripeCount = 0;
    let paypalCount = 0;
    let stripeError: string | null = null;
    let paypalError: string | null = null;

    if (!provider || provider === "stripe") {
      try {
        stripeCount = await syncStripeTransactions(supabaseClient, startDate);
      } catch (error) {
        stripeError = error instanceof Error ? error.message : "Unknown Stripe error";
        logStep("Stripe sync failed, continuing", { error: stripeError });
      }
    }

    if (!provider || provider === "paypal") {
      try {
        paypalCount = await syncPayPalTransactions(supabaseClient, startDate);
      } catch (error) {
        paypalError = error instanceof Error ? error.message : "Unknown PayPal error";
        logStep("PayPal sync failed, continuing", { error: paypalError });
        
        // Check if it's a permissions error and provide helpful message
        if (paypalError.includes("NOT_AUTHORIZED") || paypalError.includes("insufficient permissions")) {
          paypalError = "PayPal Transaction Search API requires additional permissions. Enable 'Transaction Search' in your PayPal Developer Dashboard under App Settings > Advanced Options.";
        }
      }
    }

    // Always return 200 with details - let the UI handle displaying errors
    return new Response(JSON.stringify({
      success: true,
      stripe_transactions: stripeCount,
      paypal_transactions: paypalCount,
      total: stripeCount + paypalCount,
      stripe_error: stripeError,
      paypal_error: paypalError,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    logStep("Error during sync", { error: error instanceof Error ? error.message : error });
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});