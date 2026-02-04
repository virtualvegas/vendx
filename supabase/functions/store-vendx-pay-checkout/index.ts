import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { cartItems } = await req.json();
    console.log("Processing VendX Pay checkout for user:", user.id);
    console.log("Cart items:", JSON.stringify(cartItems));

    if (!cartItems || cartItems.length === 0) {
      throw new Error("Cart is empty");
    }

    // Calculate total
    let total = 0;
    const orderItems = [];

    for (const item of cartItems) {
      // Fetch product details
      const { data: product, error: productError } = await supabase
        .from("store_products")
        .select("*")
        .eq("id", item.product_id)
        .single();

      if (productError || !product) {
        console.error("Product not found:", item.product_id);
        throw new Error(`Product not found: ${item.product_id}`);
      }

      // Check if it's a subscription - VendX Pay doesn't support subscriptions
      if (product.is_subscription) {
        throw new Error("VendX Pay cannot be used for subscription products. Please use Debit/Credit or PayPal.");
      }

      const itemPrice = product.price;
      let addonsTotal = 0;

      // Process addons if any
      if (item.addon_ids && item.addon_ids.length > 0) {
        const { data: addons } = await supabase
          .from("store_product_addons")
          .select("*")
          .in("id", item.addon_ids);

        if (addons) {
          addonsTotal = addons.reduce((sum: number, addon: any) => sum + addon.price, 0);
        }
      }

      const lineTotal = (itemPrice + addonsTotal) * item.quantity;
      total += lineTotal;

      orderItems.push({
        product_id: product.id,
        product_name: product.name,
        quantity: item.quantity,
        unit_price: itemPrice,
        addons_total: addonsTotal,
        line_total: lineTotal,
      });
    }

    // Add shipping if applicable
    const shipping = total > 50 ? 0 : 5.99;
    total += shipping;

    console.log("Order total:", total, "Shipping:", shipping);

    // Get user's wallet
    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("id, balance")
      .eq("user_id", user.id)
      .single();

    if (walletError || !wallet) {
      throw new Error("Wallet not found. Please set up your VendX Pay wallet first.");
    }

    console.log("User wallet balance:", wallet.balance);

    // Check if user has sufficient balance
    if (wallet.balance < total) {
      throw new Error(`Insufficient wallet balance. You need $${total.toFixed(2)} but only have $${wallet.balance.toFixed(2)}.`);
    }

    // Deduct from wallet
    const { error: deductError } = await supabase
      .from("wallets")
      .update({ balance: wallet.balance - total })
      .eq("id", wallet.id);

    if (deductError) {
      console.error("Failed to deduct from wallet:", deductError);
      throw new Error("Failed to process payment");
    }

    // Create wallet transaction record
    const { data: walletTx, error: walletTxError } = await supabase
      .from("wallet_transactions")
      .insert({
        wallet_id: wallet.id,
        amount: -total,
        transaction_type: "store_purchase",
        description: `VendX Store purchase - ${orderItems.length} item(s)`,
      })
      .select()
      .single();

    if (walletTxError) {
      console.error("Failed to create wallet transaction:", walletTxError);
      // Rollback wallet deduction
      await supabase
        .from("wallets")
        .update({ balance: wallet.balance })
        .eq("id", wallet.id);
      throw new Error("Failed to record transaction");
    }

    // Create store order
    const { data: order, error: orderError } = await supabase
      .from("vendx_store_orders")
      .insert({
        user_id: user.id,
        status: "confirmed",
        total_amount: total,
        payment_status: "paid",
        shipping_amount: shipping,
        payment_method: "vendx_pay",
      })
      .select()
      .single();

    if (orderError) {
      console.error("Failed to create order:", orderError);
      // Rollback wallet
      await supabase
        .from("wallets")
        .update({ balance: wallet.balance })
        .eq("id", wallet.id);
      throw new Error("Failed to create order");
    }

    // Create order items
    const orderItemsToInsert = orderItems.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.line_total,
    }));

    const { error: orderItemsError } = await supabase
      .from("vendx_store_order_items")
      .insert(orderItemsToInsert);

    if (orderItemsError) {
      console.error("Failed to create order items:", orderItemsError);
    }

    // Clear user's cart
    const { error: clearCartError } = await supabase
      .from("store_cart_items")
      .delete()
      .eq("user_id", user.id);

    if (clearCartError) {
      console.error("Failed to clear cart:", clearCartError);
    }

    // Award reward points (10 points per dollar for bronze tier)
    const { data: rewardsData } = await supabase
      .from("rewards_points")
      .select("balance, lifetime_points, tier")
      .eq("user_id", user.id)
      .single();

    if (rewardsData) {
      const earnRate = rewardsData.tier === "platinum" ? 20 : 
                       rewardsData.tier === "gold" ? 15 : 
                       rewardsData.tier === "silver" ? 12 : 10;
      const pointsEarned = Math.floor(total * earnRate);

      await supabase
        .from("rewards_points")
        .update({
          balance: rewardsData.balance + pointsEarned,
          lifetime_points: rewardsData.lifetime_points + pointsEarned,
        })
        .eq("user_id", user.id);

      // Record points transaction
      await supabase
        .from("point_transactions")
        .insert({
          user_id: user.id,
          points: pointsEarned,
          transaction_type: "earn",
          description: `Earned from store purchase #${order.order_number}`,
          reference_id: order.id,
        });

      console.log("Awarded", pointsEarned, "points to user");
    }

    console.log("Order completed successfully:", order.order_number);

    return new Response(
      JSON.stringify({
        success: true,
        orderId: order.id,
        orderNumber: order.order_number,
        total: total,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("VendX Pay checkout error:", error);
    const errorMessage = error instanceof Error ? error.message : "An error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
