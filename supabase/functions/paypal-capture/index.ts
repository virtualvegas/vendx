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
    const { orderId, type } = await req.json();
    
    if (!orderId) {
      throw new Error("Order ID is required");
    }

    console.log("Capturing PayPal order:", orderId, "type:", type);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();

    // Capture the order
    const captureResponse = await fetch(`${PAYPAL_API_URL}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!captureResponse.ok) {
      const error = await captureResponse.text();
      throw new Error(`Failed to capture PayPal order: ${error}`);
    }

    const captureData = await captureResponse.json();
    console.log("PayPal order captured:", captureData.id, "status:", captureData.status);

    if (captureData.status !== "COMPLETED") {
      throw new Error(`Payment not completed. Status: ${captureData.status}`);
    }

    // Process based on type
    const purchaseUnit = captureData.purchase_units[0];
    const customData = JSON.parse(purchaseUnit.custom_id || "{}");

    if (type === "wallet_load" || customData.type === "wallet_load") {
      // Handle wallet load
      const userId = customData.user_id;
      const amount = parseFloat(customData.amount);

      console.log("Processing wallet load for user:", userId, "amount:", amount);

      // Update wallet balance (parent wallet)
      const { data: wallet, error: walletError } = await supabaseClient
        .from("wallets")
        .select("id, balance")
        .eq("user_id", userId)
        .in("wallet_type", ["standard", "guest"])
        .is("parent_wallet_id", null)
        .maybeSingle();

      if (walletError || !wallet) {
        console.error("Error fetching wallet:", walletError);
        throw new Error("Failed to fetch wallet");
      }

      const newBalance = Number(wallet.balance) + amount;

      const { error: updateError } = await supabaseClient
        .from("wallets")
        .update({
          balance: newBalance,
          last_loaded: new Date().toISOString(),
        })
        .eq("id", wallet.id);

      if (updateError) {
        console.error("Error updating wallet:", updateError);
        throw new Error("Failed to update wallet balance");
      }

      // Create transaction record
      await supabaseClient
        .from("wallet_transactions")
        .insert({
          wallet_id: wallet.id,
          amount,
          transaction_type: "load",
          description: `PayPal wallet load - Order ${orderId}`,
          reference_id: orderId,
        });

      console.log("Wallet updated successfully. New balance:", newBalance);

      return new Response(JSON.stringify({ 
        success: true, 
        type: "wallet_load",
        newBalance 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      // Handle store order
      const userId = customData.supabase_user_id;
      const cartItems = customData.cart_items || [];
      const capture = purchaseUnit.payments.captures[0];
      const totalAmount = parseFloat(capture.amount.value);
      const shipping = purchaseUnit.shipping?.address;

      console.log("Processing store order for user:", userId);

      // Create store order
      const { data: order, error: orderError } = await supabaseClient
        .from("store_orders")
        .insert({
          user_id: userId,
          status: "paid",
          total: totalAmount,
          subtotal: totalAmount,
          shipping_cost: 0,
          payment_method: "paypal",
          paypal_order_id: orderId,
          shipping_address: shipping ? {
            address_line_1: shipping.address_line_1,
            address_line_2: shipping.address_line_2,
            city: shipping.admin_area_2,
            state: shipping.admin_area_1,
            postal_code: shipping.postal_code,
            country: shipping.country_code,
          } : null
        })
        .select("id")
        .single();

      if (orderError) {
        console.error("Error creating order:", orderError);
        throw new Error("Failed to create order");
      }

      // Create order items
      for (const item of cartItems) {
        const { data: product } = await supabaseClient
          .from("store_products")
          .select("price, name")
          .eq("id", item.product_id)
          .single();

        if (product) {
          await supabaseClient
            .from("store_order_items")
            .insert({
              order_id: order.id,
              product_id: item.product_id,
              quantity: item.quantity,
              unit_price: product.price,
              addon_ids: item.addon_ids
            });
        }
      }

      // Clear user's cart
      const { data: cart } = await supabaseClient
        .from("store_carts")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (cart) {
        await supabaseClient
          .from("store_cart_items")
          .delete()
          .eq("cart_id", cart.id);
      }

      // Award points (10 points per dollar)
      const pointsEarned = Math.floor(totalAmount * 10);
      
      const { data: rewards } = await supabaseClient
        .from("rewards_points")
        .select("balance, lifetime_points")
        .eq("user_id", userId)
        .single();

      if (rewards) {
        await supabaseClient
          .from("rewards_points")
          .update({
            balance: rewards.balance + pointsEarned,
            lifetime_points: rewards.lifetime_points + pointsEarned
          })
          .eq("user_id", userId);

        await supabaseClient
          .from("point_transactions")
          .insert({
            user_id: userId,
            points: pointsEarned,
            transaction_type: "earn",
            description: `Store purchase - Order ${order.id}`,
            reference_id: order.id
          });
      }

      console.log("Store order created:", order.id);

      return new Response(JSON.stringify({ 
        success: true, 
        type: "store_order",
        orderId: order.id 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error: unknown) {
    console.error("Error capturing PayPal order:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
