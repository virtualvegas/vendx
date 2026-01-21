import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STORE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const body = await req.text();
    const sig = req.headers.get("stripe-signature");
    
    let event: Stripe.Event;
    
    // Try to verify webhook signature if secret is available
    const webhookSecret = Deno.env.get("STRIPE_STORE_WEBHOOK_SECRET");
    if (webhookSecret && sig) {
      try {
        event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
      } catch (err) {
        logStep("Webhook signature verification failed, parsing directly");
        event = JSON.parse(body);
      }
    } else {
      event = JSON.parse(body);
    }

    logStep("Event type", { type: event.type });

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      logStep("Checkout session completed", { sessionId: session.id });

      const metadata = session.metadata || {};
      const userId = metadata.supabase_user_id;
      const cartItemsJson = metadata.cart_items;

      if (!userId) {
        logStep("No user ID in metadata");
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        });
      }

      // Parse cart items
      let cartItems = [];
      try {
        cartItems = JSON.parse(cartItemsJson || "[]");
      } catch (e) {
        logStep("Failed to parse cart items");
      }

      // Get product details
      const productIds = cartItems.map((item: any) => item.product_id);
      const { data: products } = await supabaseClient
        .from("store_products")
        .select("*")
        .in("id", productIds);

      // Calculate order total
      let subtotal = 0;
      const orderItems = [];

      for (const cartItem of cartItems) {
        const product = products?.find((p: any) => p.id === cartItem.product_id);
        if (!product) continue;

        let unitPrice = product.is_subscription 
          ? (product.subscription_price || product.price) 
          : product.price;

        // Add addon prices
        let addonDetails: any[] = [];
        if (cartItem.addon_ids && cartItem.addon_ids.length > 0) {
          const { data: addons } = await supabaseClient
            .from("store_product_addons")
            .select("id, name, price")
            .in("id", cartItem.addon_ids);
          
          if (addons) {
            addonDetails = addons;
            unitPrice += addons.reduce((sum: number, a: any) => sum + Number(a.price), 0);
          }
        }

        const itemTotal = unitPrice * cartItem.quantity;
        subtotal += itemTotal;

        orderItems.push({
          product_id: product.id,
          product_name: product.name,
          product_price: unitPrice,
          quantity: cartItem.quantity,
          addon_details: addonDetails,
          total: itemTotal
        });

        // Create subscription record if subscription product
        if (product.is_subscription && session.subscription) {
          await supabaseClient.from("store_subscriptions").insert({
            user_id: userId,
            product_id: product.id,
            stripe_subscription_id: session.subscription as string,
            stripe_customer_id: session.customer as string,
            status: "active",
            addon_ids: cartItem.addon_ids || []
          });
          logStep("Subscription created", { productId: product.id });
        }
      }

      // Create order
      const shipping = session.shipping_cost?.amount_total 
        ? session.shipping_cost.amount_total / 100 
        : 0;
      const total = subtotal + shipping;

      const { data: order, error: orderError } = await supabaseClient
        .from("store_orders")
        .insert({
          user_id: userId,
          status: "paid",
          subtotal,
          shipping_cost: shipping,
          total,
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent as string
        })
        .select("id")
        .single();

      if (orderError) {
        logStep("Order creation failed", { error: orderError.message });
      } else {
        logStep("Order created", { orderId: order.id });

        // Create order items
        const itemsToInsert = orderItems.map(item => ({
          ...item,
          order_id: order.id
        }));

        await supabaseClient.from("store_order_items").insert(itemsToInsert);
        logStep("Order items created", { count: itemsToInsert.length });
      }

      // Clear user's cart
      const { data: cart } = await supabaseClient
        .from("store_carts")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (cart) {
        await supabaseClient.from("store_cart_items").delete().eq("cart_id", cart.id);
        logStep("Cart cleared");
      }

      // Award reward points (10 points per dollar spent)
      const pointsToAward = Math.floor(total * 10);
      const { data: rewardsPoints } = await supabaseClient
        .from("rewards_points")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (rewardsPoints) {
        await supabaseClient
          .from("rewards_points")
          .update({
            balance: rewardsPoints.balance + pointsToAward,
            lifetime_points: rewardsPoints.lifetime_points + pointsToAward
          })
          .eq("user_id", userId);

        await supabaseClient.from("point_transactions").insert({
          user_id: userId,
          points: pointsToAward,
          transaction_type: "earn",
          description: `Store purchase - Order ${order?.id?.substring(0, 8)}`,
          reference_id: order?.id
        });

        logStep("Points awarded", { points: pointsToAward });
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      
      await supabaseClient
        .from("store_subscriptions")
        .update({ status: "cancelled", canceled_at: new Date().toISOString() })
        .eq("stripe_subscription_id", subscription.id);

      logStep("Subscription cancelled", { subscriptionId: subscription.id });
    }

    return new Response(JSON.stringify({ received: true }), {
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
