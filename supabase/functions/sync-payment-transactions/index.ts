import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  console.log(`[SYNC-TRANSACTIONS] ${step}`, details ? JSON.stringify(details) : "");
};

const PAYPAL_API_URL = Deno.env.get("PAYPAL_API_URL") || "https://api-m.paypal.com";

async function getPayPalAccessToken(): Promise<string> {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const clientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("PayPal credentials not configured");

  const auth = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch(`${PAYPAL_API_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get PayPal access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Batch upsert to avoid N+1 queries — uses provider_transaction_id for dedup
async function batchUpsert(supabase: any, rows: any[]): Promise<number> {
  if (rows.length === 0) return 0;
  let synced = 0;
  // Process in chunks of 50
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const { data, error } = await supabase
      .from("synced_transactions")
      .upsert(chunk, { onConflict: "provider,provider_transaction_id", ignoreDuplicates: true });
    if (!error) synced += chunk.length;
    else logStep("Batch upsert error", { error: error.message, chunk_size: chunk.length });
  }
  return synced;
}

async function syncStripeTransactions(supabase: any, startDate?: string): Promise<number> {
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) throw new Error("Stripe secret key not configured");

  const stripe = new Stripe(stripeKey, {
    apiVersion: "2023-10-16",
    httpClient: Stripe.createFetchHttpClient(),
  });

  logStep("Starting Stripe sync");

  await supabase
    .from("transaction_sync_status")
    .update({ sync_status: "syncing", error_message: null, updated_at: new Date().toISOString() })
    .eq("provider", "stripe");

  const createdGte = startDate 
    ? Math.floor(new Date(startDate).getTime() / 1000)
    : Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);

  try {
    const rows: any[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const params: any = { limit: 100, created: { gte: createdGte }, expand: ["data.customer"] };
      if (startingAfter) params.starting_after = startingAfter;
      const charges = await stripe.charges.list(params);

      for (const charge of charges.data) {
        if (charge.status !== "succeeded") continue;
        const customer = charge.customer as Stripe.Customer | null;
        rows.push({
          provider: "stripe",
          provider_transaction_id: charge.id,
          transaction_type: "revenue",
          amount: charge.amount / 100,
          currency: charge.currency,
          status: charge.status,
          description: `${charge.description || "Stripe charge"} (Txn #${charge.id})`,
          customer_email: charge.billing_details?.email || customer?.email || null,
          customer_name: charge.billing_details?.name || customer?.name || null,
          transaction_date: new Date(charge.created * 1000).toISOString(),
          metadata: { payment_method: charge.payment_method_details?.type, receipt_url: charge.receipt_url, payment_intent: charge.payment_intent },
          synced_at: new Date().toISOString(),
        });
      }

      hasMore = charges.has_more;
      if (charges.data.length > 0) startingAfter = charges.data[charges.data.length - 1].id;
    }

    // Refunds
    hasMore = true;
    startingAfter = undefined;
    while (hasMore) {
      const params: any = { limit: 100, created: { gte: createdGte }, expand: ["data.charge"] };
      if (startingAfter) params.starting_after = startingAfter;
      const refunds = await stripe.refunds.list(params);

      for (const refund of refunds.data) {
        const charge = refund.charge as Stripe.Charge | null;
        rows.push({
          provider: "stripe",
          provider_transaction_id: `refund_${refund.id}`,
          transaction_type: "expense",
          amount: -(refund.amount / 100),
          currency: refund.currency,
          status: refund.status || "succeeded",
          description: `Refund ${refund.reason || ""} (Refund #${refund.id}, Charge #${charge?.id || "unknown"})`.trim(),
          customer_email: charge?.billing_details?.email || null,
          customer_name: charge?.billing_details?.name || null,
          transaction_date: new Date(refund.created * 1000).toISOString(),
          metadata: { original_charge: charge?.id, reason: refund.reason },
          synced_at: new Date().toISOString(),
        });
      }

      hasMore = refunds.has_more;
      if (refunds.data.length > 0) startingAfter = refunds.data[refunds.data.length - 1].id;
    }

    const synced = await batchUpsert(supabase, rows);

    await supabase
      .from("transaction_sync_status")
      .update({ sync_status: "completed", last_sync_at: new Date().toISOString(), transactions_synced: synced, error_message: null, updated_at: new Date().toISOString() })
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
  logStep("Starting PayPal sync");

  await supabase
    .from("transaction_sync_status")
    .update({ sync_status: "syncing", error_message: null, updated_at: new Date().toISOString() })
    .eq("provider", "paypal");

  try {
    const accessToken = await getPayPalAccessToken();

    const endDate = new Date().toISOString();
    const start = startDate 
      ? new Date(startDate).toISOString()
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const url = new URL(`${PAYPAL_API_URL}/v1/reporting/transactions`);
    url.searchParams.set("start_date", start);
    url.searchParams.set("end_date", endDate);
    url.searchParams.set("fields", "all");
    url.searchParams.set("page_size", "100");

    const rows: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      url.searchParams.set("page", page.toString());

      const response = await fetch(url.toString(), {
        headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to fetch PayPal transactions: ${error}`);
      }

      const data = await response.json();
      const transactions = data.transaction_details || [];
      logStep(`Fetched page ${page} with ${transactions.length} PayPal transactions`);

      for (const txn of transactions) {
        const info = txn.transaction_info;
        const payerInfo = txn.payer_info;
        if (info.transaction_status !== "S") continue;

        const amount = parseFloat(info.transaction_amount?.value || "0");
        const isRefund = info.transaction_event_code?.startsWith("T11") || amount < 0;

        rows.push({
          provider: "paypal",
          provider_transaction_id: info.transaction_id,
          transaction_type: isRefund ? "expense" : "revenue",
          amount: isRefund ? -Math.abs(amount) : Math.abs(amount),
          currency: info.transaction_amount?.currency_code || "USD",
          status: "completed",
          description: info.transaction_subject || info.transaction_note || `PayPal transaction ${info.transaction_id}`,
          customer_email: payerInfo?.email_address || null,
          customer_name: payerInfo?.payer_name?.alternate_full_name || null,
          transaction_date: info.transaction_initiation_date || info.transaction_updated_date,
          metadata: { transaction_event_code: info.transaction_event_code, fee_amount: info.fee_amount?.value, custom_field: info.custom_field },
          synced_at: new Date().toISOString(),
        });
      }

      hasMore = data.total_pages > page;
      page++;
    }

    const synced = await batchUpsert(supabase, rows);

    await supabase
      .from("transaction_sync_status")
      .update({ sync_status: "completed", last_sync_at: new Date().toISOString(), transactions_synced: synced, error_message: null, updated_at: new Date().toISOString() })
      .eq("provider", "paypal");

    logStep(`PayPal sync complete: ${synced} transactions`);
    return synced;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.includes("NOT_AUTHORIZED") || message.includes("insufficient permissions")) {
      const friendlyMsg = "PayPal Transaction Search API requires additional permissions. Enable 'Transaction Search' in your PayPal Developer Dashboard under App Settings > Advanced Options.";
      await supabase
        .from("transaction_sync_status")
        .update({ sync_status: "error", error_message: friendlyMsg, updated_at: new Date().toISOString() })
        .eq("provider", "paypal");
      throw new Error(friendlyMsg);
    }

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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authorization required");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) throw new Error("Invalid authorization");

    const { data: roles } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const hasAccess = roles?.some(r => r.role === "super_admin" || r.role === "finance_accounting");
    if (!hasAccess) throw new Error("Access denied: Finance role required");

    const { provider, startDate } = await req.json();
    logStep("Sync request received", { provider, startDate, userId: user.id });

    // Run Stripe and PayPal syncs in parallel for speed
    const results = await Promise.allSettled([
      (!provider || provider === "stripe") ? syncStripeTransactions(supabaseClient, startDate) : Promise.resolve(0),
      (!provider || provider === "paypal") ? syncPayPalTransactions(supabaseClient, startDate) : Promise.resolve(0),
    ]);

    const stripeResult = results[0];
    const paypalResult = results[1];

    const stripeCount = stripeResult.status === "fulfilled" ? stripeResult.value : 0;
    const stripeError = stripeResult.status === "rejected" ? stripeResult.reason?.message || "Unknown Stripe error" : null;

    const paypalCount = paypalResult.status === "fulfilled" ? paypalResult.value : 0;
    const paypalError = paypalResult.status === "rejected" ? paypalResult.reason?.message || "Unknown PayPal error" : null;

    const hasSuccess = stripeCount > 0 || paypalCount > 0 || (!stripeError && !paypalError);
    
    return new Response(JSON.stringify({
      success: hasSuccess,
      stripe_transactions: stripeCount,
      paypal_transactions: paypalCount,
      total: stripeCount + paypalCount,
      stripe_error: stripeError,
      paypal_error: paypalError,
    }), {
      status: hasSuccess ? 200 : 500,
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
