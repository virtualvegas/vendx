import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { ad_location_id, start_date, end_date, total_price, ad_title, ad_description, ad_creative_url } = await req.json();

    if (!ad_location_id || !start_date || !end_date || !total_price) {
      throw new Error("Missing required fields");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2023-10-16" });

    // Get or create Stripe customer
    const { data: profile } = await supabaseClient.from("profiles").select("stripe_customer_id, email, full_name").eq("id", user.id).single();

    let customerId = profile?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile?.email || user.email,
        name: profile?.full_name || undefined,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
      await supabaseClient.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    // Create the ad booking record with pending_payment status
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: booking, error: bookingError } = await supabaseAdmin.from("ad_bookings").insert({
      ad_location_id,
      business_owner_id: user.id,
      start_date,
      end_date,
      total_price,
      ad_title: ad_title || null,
      ad_description: ad_description || null,
      ad_creative_url: ad_creative_url || null,
      status: "pending",
    }).select("id").single();

    if (bookingError) throw bookingError;

    // Get ad location name for checkout description
    const { data: adLocation } = await supabaseAdmin.from("ad_locations").select("name").eq("id", ad_location_id).single();

    const origin = req.headers.get("origin") || "https://vendx.lovable.app";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: `VendX AdReach: ${adLocation?.name || "Ad Placement"}`,
            description: ad_title || `Ad booking from ${start_date} to ${end_date}`,
          },
          unit_amount: Math.round(total_price * 100),
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `${origin}/dashboard/business-adreach?payment=success&booking_id=${booking.id}`,
      cancel_url: `${origin}/dashboard/business-adreach?payment=cancelled`,
      metadata: {
        booking_id: booking.id,
        user_id: user.id,
        type: "adreach_booking",
      },
    });

    // Booking already set to "pending" on insert

    return new Response(JSON.stringify({ url: session.url, booking_id: booking.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
