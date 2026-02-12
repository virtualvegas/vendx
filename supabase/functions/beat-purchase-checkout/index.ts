import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { beat_id } = await req.json();
    if (!beat_id) throw new Error("beat_id is required");

    // Get beat info
    const { data: beat, error: beatError } = await supabaseAdmin
      .from("beat_tracks")
      .select("*")
      .eq("id", beat_id)
      .eq("is_active", true)
      .single();

    if (beatError || !beat) throw new Error("Beat not found or inactive");

    // Get user if authenticated
    let userEmail: string | undefined;
    let userId: string | undefined;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? ""
      );
      const { data: { user } } = await supabaseClient.auth.getUser(token);
      if (user) {
        userEmail = user.email;
        userId = user.id;
      }
    }

    // Generate download token
    const downloadToken = crypto.randomUUID();

    // Create purchase record
    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from("beat_purchases")
      .insert({
        user_id: userId || null,
        beat_id: beat.id,
        email: userEmail || "pending@checkout",
        amount: beat.price,
        payment_method: "stripe",
        payment_status: "pending",
        download_token: downloadToken,
        download_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (purchaseError) throw new Error("Failed to create purchase: " + purchaseError.message);

    // Create Stripe session
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    let customerId: string | undefined;
    if (userEmail) {
      const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
      if (customers.data.length > 0) customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || "https://vendx.lovable.app";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : userEmail,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: beat.title,
              description: `${beat.license_type} license — ${beat.producer || "VendX Music"}`,
              ...(beat.cover_image_url ? { images: [beat.cover_image_url] } : {}),
            },
            unit_amount: Math.round(beat.price * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/media/download?token=${downloadToken}`,
      cancel_url: `${origin}/media/track-shop`,
      metadata: {
        purchase_id: purchase.id,
        beat_id: beat.id,
        download_token: downloadToken,
      },
    });

    // Update purchase with Stripe session ID
    await supabaseAdmin
      .from("beat_purchases")
      .update({ stripe_session_id: session.id })
      .eq("id", purchase.id);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
