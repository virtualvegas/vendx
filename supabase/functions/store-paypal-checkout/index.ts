import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAYPAL_API_URL = Deno.env.get("PAYPAL_API_URL") || "https://api-m.paypal.com";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STORE-PAYPAL] ${step}${detailsStr}`);
};

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
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { cartItems } = await req.json();
    if (!cartItems || cartItems.length === 0) {
      throw new Error("Cart is empty");
    }
    logStep("Cart items received", { count: cartItems.length });

    // Fetch product details for cart items
    const productIds = cartItems.map((item: any) => item.product_id);
    const { data: products } = await supabaseClient
      .from("store_products")
      .select("*")
      .in("id", productIds);

    if (!products || products.length === 0) {
      throw new Error("Products not found");
    }

    // Build PayPal order items
    const items: any[] = [];
    let subtotal = 0;

    for (const cartItem of cartItems) {
      const product = products.find((p: any) => p.id === cartItem.product_id);
      if (!product) continue;

      // PayPal doesn't support subscriptions in basic checkout - only one-time payments
      if (product.is_subscription) {
        throw new Error("PayPal checkout is not available for subscription products. Please use Debit/Credit card.");
      }

      let unitPrice = product.price;

      // Add addon prices
      if (cartItem.addon_ids && cartItem.addon_ids.length > 0) {
        const { data: addons } = await supabaseClient
          .from("store_product_addons")
          .select("price")
          .in("id", cartItem.addon_ids);
        
        if (addons) {
          unitPrice += addons.reduce((sum: number, a: any) => sum + Number(a.price), 0);
        }
      }

      const itemTotal = unitPrice * cartItem.quantity;
      subtotal += itemTotal;

      items.push({
        name: product.name.substring(0, 127),
        unit_amount: {
          currency_code: "USD",
          value: unitPrice.toFixed(2),
        },
        quantity: cartItem.quantity.toString(),
      });
    }

    // Calculate shipping
    const shipping = subtotal > 50 ? 0 : 5.99;
    const total = subtotal + shipping;

    logStep("Order calculated", { subtotal, shipping, total, itemCount: items.length });

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();
    logStep("PayPal access token obtained");

    // Create PayPal order
    const origin = req.headers.get("origin") || "https://vendx.space";
    
    const orderPayload = {
      intent: "CAPTURE",
      purchase_units: [{
        reference_id: user.id,
        description: "VendX Store Order",
        custom_id: JSON.stringify({
          supabase_user_id: user.id,
          cart_items: cartItems.map((item: any) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            addon_ids: item.addon_ids
          }))
        }),
        amount: {
          currency_code: "USD",
          value: total.toFixed(2),
          breakdown: {
            item_total: {
              currency_code: "USD",
              value: subtotal.toFixed(2),
            },
            shipping: {
              currency_code: "USD",
              value: shipping.toFixed(2),
            },
          },
        },
        items,
      }],
      application_context: {
        brand_name: "VendX",
        landing_page: "NO_PREFERENCE",
        user_action: "PAY_NOW",
        return_url: `${origin}/store/order-success?paypal=true`,
        cancel_url: `${origin}/store/cart`,
        shipping_preference: "GET_FROM_FILE",
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
    logStep("PayPal order created", { orderId: order.id });

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
      status: 200
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    });
  }
});
