import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAYPAL_API_URL = Deno.env.get("PAYPAL_API_URL") || "https://api-m.paypal.com";

async function getPayPalAccessToken(): Promise<string> {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const clientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET");
  
  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials not configured");
  }

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
      console.error("Auth error:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { amount } = await req.json();

    if (!amount || amount < 5 || amount > 500) {
      return new Response(
        JSON.stringify({ error: "Amount must be between $5 and $500" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Creating PayPal order for wallet load:", amount, "user:", userData.user.id);

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();

    // Create PayPal order
    const origin = req.headers.get("origin") || "https://vendx.space";
    
    const orderPayload = {
      intent: "CAPTURE",
      purchase_units: [{
        reference_id: userData.user.id,
        description: `VendX Pay Wallet Load - $${amount.toFixed(2)}`,
        custom_id: JSON.stringify({
          user_id: userData.user.id,
          amount: amount.toString(),
          type: "wallet_load"
        }),
        amount: {
          currency_code: "USD",
          value: amount.toFixed(2),
        },
      }],
      application_context: {
        brand_name: "VendX Pay",
        landing_page: "NO_PREFERENCE",
        user_action: "PAY_NOW",
        return_url: `${origin}/wallet?paypal=true&amount=${amount}`,
        cancel_url: `${origin}/wallet?canceled=true`,
        shipping_preference: "NO_SHIPPING",
      },
    };

    const orderResponse = await fetch(`${PAYPAL_API_URL}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderPayload),
    });

    if (!orderResponse.ok) {
      const error = await orderResponse.text();
      throw new Error(`Failed to create PayPal order: ${error}`);
    }

    const order = await orderResponse.json();
    console.log("PayPal order created:", order.id, "for user:", userData.user.id);

    // Find the approval URL
    const approvalLink = order.links.find((link: any) => link.rel === "approve");
    if (!approvalLink) {
      throw new Error("PayPal approval URL not found");
    }

    return new Response(JSON.stringify({ 
      url: approvalLink.href,
      orderId: order.id 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error creating PayPal checkout:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
