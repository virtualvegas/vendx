import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Not authenticated");
    const user = userData.user;

    // Get user's auto-reload config
    const { data: config, error: configError } = await supabaseAdmin
      .from("wallet_auto_reload")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_enabled", true)
      .maybeSingle();

    if (configError) throw configError;
    if (!config) {
      return new Response(JSON.stringify({ message: "No active auto-reload config" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get wallet balance
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from("wallets")
      .select("id, balance")
      .eq("id", config.wallet_id)
      .single();

    if (walletError || !wallet) throw new Error("Wallet not found");

    let shouldReload = false;

    if (config.reload_type === "threshold") {
      shouldReload = Number(wallet.balance) < Number(config.threshold_amount);
    } else if (config.reload_type === "scheduled") {
      const now = new Date();
      const nextReload = config.next_scheduled_reload ? new Date(config.next_scheduled_reload) : null;
      shouldReload = !nextReload || now >= nextReload;
    }

    if (!shouldReload) {
      return new Response(JSON.stringify({ message: "No reload needed", balance: wallet.balance }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const amount = Number(config.reload_amount);

    // Create checkout session based on preferred payment method
    if (config.preferred_payment_method === "stripe") {
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
        apiVersion: "2023-10-16",
      });

      // Find or create Stripe customer
      const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
      let customerId: string | undefined;
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      }

      const origin = req.headers.get("origin") || "https://vendx.lovable.app";

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : user.email!,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: { name: `VendX Pay Auto-Reload ($${amount.toFixed(2)})` },
              unit_amount: Math.round(amount * 100),
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${origin}/wallet?success=true&amount=${amount}&auto_reload=true`,
        cancel_url: `${origin}/wallet?canceled=true`,
        metadata: {
          wallet_id: wallet.id,
          user_id: user.id,
          type: "auto_reload",
        },
      });

      // Update last reload time and compute next scheduled reload
      const updatePayload: Record<string, unknown> = { last_reload_at: new Date().toISOString() };
      if (config.reload_type === "scheduled") {
        const now = new Date();
        const intervals: Record<string, number> = {
          daily: 1,
          weekly: 7,
          biweekly: 14,
          monthly: 30,
        };
        const days = intervals[config.schedule_interval] || 7;
        now.setDate(now.getDate() + days);
        updatePayload.next_scheduled_reload = now.toISOString();
      }

      await supabaseAdmin
        .from("wallet_auto_reload")
        .update(updatePayload)
        .eq("id", config.id);

      return new Response(JSON.stringify({ url: session.url, method: "stripe" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      // PayPal flow - reuse existing vendx-pay-paypal-checkout logic
      const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID");
      const PAYPAL_CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET");
      if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) throw new Error("PayPal not configured");

      const origin = req.headers.get("origin") || "https://vendx.lovable.app";

      // Get PayPal access token
      const authResponse = await fetch("https://api-m.sandbox.paypal.com/v1/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`)}`,
        },
        body: "grant_type=client_credentials",
      });
      const authData = await authResponse.json();

      // Create PayPal order
      const orderResponse = await fetch("https://api-m.sandbox.paypal.com/v2/checkout/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authData.access_token}`,
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [
            {
              amount: { currency_code: "USD", value: amount.toFixed(2) },
              description: `VendX Pay Auto-Reload ($${amount.toFixed(2)})`,
            },
          ],
          application_context: {
            return_url: `${origin}/wallet?paypal=true&amount=${amount}&auto_reload=true`,
            cancel_url: `${origin}/wallet?canceled=true`,
            brand_name: "VendX Pay",
            user_action: "PAY_NOW",
          },
        }),
      });

      const orderData = await orderResponse.json();
      const approvalUrl = orderData.links?.find((l: any) => l.rel === "approve")?.href;

      if (!approvalUrl) throw new Error("Failed to create PayPal order");

      // Update reload tracking
      const updatePayload: Record<string, unknown> = { last_reload_at: new Date().toISOString() };
      if (config.reload_type === "scheduled") {
        const now = new Date();
        const intervals: Record<string, number> = { daily: 1, weekly: 7, biweekly: 14, monthly: 30 };
        const days = intervals[config.schedule_interval] || 7;
        now.setDate(now.getDate() + days);
        updatePayload.next_scheduled_reload = now.toISOString();
      }

      await supabaseAdmin.from("wallet_auto_reload").update(updatePayload).eq("id", config.id);

      return new Response(JSON.stringify({ url: approvalUrl, method: "paypal" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error: any) {
    console.error("Auto-reload error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
