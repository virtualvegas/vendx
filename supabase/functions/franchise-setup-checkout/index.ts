import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user?.email) throw new Error("Not authenticated");
    const user = userData.user;

    const { data: franchise, error: fErr } = await supabaseClient
      .from("vendx_franchises")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (fErr) throw fErr;
    if (!franchise) throw new Error("Franchise application not found");
    if (franchise.setup_fee_paid) throw new Error("Setup fee already paid");

    const amount = Number(franchise.setup_fee_amount || 8000);
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data[0]?.id ||
      (await stripe.customers.create({ email: user.email, metadata: { supabase_user_id: user.id } })).id;

    const origin = req.headers.get("origin") || "https://vendx.space";
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: `VendX Franchise Setup Fee — ${franchise.business_name}`,
            description: "One-time franchise onboarding & setup fee",
          },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      }],
      success_url: `${origin}/dashboard/franchise-onboarding?setup=success`,
      cancel_url: `${origin}/dashboard/franchise-onboarding?setup=cancelled`,
      metadata: {
        franchise_id: franchise.id,
        supabase_user_id: user.id,
        purpose: "franchise_setup_fee",
      },
    });

    await supabaseClient.from("vendx_franchise_setup_payments").insert({
      franchise_id: franchise.id,
      amount,
      stripe_session_id: session.id,
      status: "pending",
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[franchise-setup-checkout]", message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
