import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-shopify-topic, x-shopify-hmac-sha256, x-shopify-shop-domain",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SHOPIFY-ORDER-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const body = await req.text();
    const topic = req.headers.get("x-shopify-topic");
    logStep("Topic", { topic });

    const order = JSON.parse(body);

    if (topic === "orders/create" || topic === "orders/paid") {
      logStep("Processing order", { orderId: order.id, orderNumber: order.order_number });

      // Extract VendX user ID from note attributes or tags
      const noteAttributes = order.note_attributes || [];
      const vendxUserIdAttr = noteAttributes.find((a: any) => a.name === "vendx_user_id");
      const userId = vendxUserIdAttr?.value || null;

      // Extract customer info
      const customerEmail = order.contact_email || order.email || order.customer?.email || null;
      const customerName = order.customer
        ? `${order.customer.first_name || ""} ${order.customer.last_name || ""}`.trim()
        : null;

      // Build order items
      const orderItems = (order.line_items || []).map((item: any) => ({
        product_name: item.title,
        product_price: parseFloat(item.price),
        quantity: item.quantity,
        total: parseFloat(item.price) * item.quantity,
        addon_details: [],
      }));

      const subtotal = parseFloat(order.subtotal_price || "0");
      const shipping = parseFloat(order.total_shipping_price_set?.shop_money?.amount || "0");
      const total = parseFloat(order.total_price || "0");

      // Check if order already exists
      const { data: existing } = await supabaseClient
        .from("store_orders")
        .select("id")
        .eq("shopify_order_id", String(order.id))
        .maybeSingle();

      if (existing) {
        logStep("Order already synced", { orderId: order.id });
        return new Response(JSON.stringify({ received: true, status: "already_synced" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      // Determine status
      const status = order.financial_status === "paid" ? "paid" : "pending";

      // Insert order
      const { data: newOrder, error: orderError } = await supabaseClient
        .from("store_orders")
        .insert({
          user_id: userId,
          status,
          subtotal,
          shipping_cost: shipping,
          total,
          wallet_credit_applied: 0,
          shopify_order_id: String(order.id),
          shopify_order_number: String(order.order_number),
          customer_email: customerEmail,
          customer_name: customerName,
        })
        .select("id")
        .single();

      if (orderError) {
        logStep("Order insert failed", { error: orderError.message });
        throw orderError;
      }

      logStep("Order created", { localOrderId: newOrder.id });

      // Insert order items
      if (orderItems.length > 0) {
        const itemsToInsert = orderItems.map((item: any) => ({
          ...item,
          order_id: newOrder.id,
        }));
        await supabaseClient.from("store_order_items").insert(itemsToInsert);
        logStep("Order items created", { count: itemsToInsert.length });
      }

      // Log to synced_transactions
      await supabaseClient.from("synced_transactions").insert({
        provider: "shopify",
        provider_transaction_id: `shopify_${order.id}`,
        transaction_type: "revenue",
        amount: total,
        currency: (order.currency || "usd").toLowerCase(),
        status: "completed",
        description: `Shopify order #${order.order_number} (${orderItems.length} items)`,
        customer_email: customerEmail,
        customer_name: customerName,
        transaction_date: order.created_at || new Date().toISOString(),
        metadata: { source: "shopify", shopify_order_id: order.id, order_number: order.order_number },
        synced_at: new Date().toISOString(),
      });

      // Award reward points if user is identified
      if (userId) {
        const pointsToAward = Math.floor(subtotal * 10);
        if (pointsToAward > 0) {
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
                lifetime_points: rewardsPoints.lifetime_points + pointsToAward,
              })
              .eq("user_id", userId);

            await supabaseClient.from("point_transactions").insert({
              user_id: userId,
              points: pointsToAward,
              transaction_type: "earn",
              description: `Shopify purchase - Order #${order.order_number}`,
              reference_id: newOrder.id,
            });

            logStep("Points awarded", { points: pointsToAward });
          }
        }
      }
    }

    if (topic === "orders/fulfilled") {
      logStep("Order fulfilled", { orderId: order.id });

      const trackingInfo = order.fulfillments?.[0];
      const trackingNumber = trackingInfo?.tracking_number || null;
      const trackingUrl = trackingInfo?.tracking_url || null;

      await supabaseClient
        .from("store_orders")
        .update({
          status: "shipped",
          tracking_number: trackingNumber,
          tracking_url: trackingUrl,
          shipped_at: new Date().toISOString(),
        })
        .eq("shopify_order_id", String(order.id));

      logStep("Order updated to shipped");
    }

    if (topic === "orders/cancelled") {
      logStep("Order cancelled", { orderId: order.id });

      await supabaseClient
        .from("store_orders")
        .update({ status: "cancelled" })
        .eq("shopify_order_id", String(order.id));
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
