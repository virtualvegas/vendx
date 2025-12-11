import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STORE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

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

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get or create Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const newCustomer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id }
      });
      customerId = newCustomer.id;
    }
    logStep("Stripe customer", { customerId });

    // Fetch product details for cart items
    const productIds = cartItems.map((item: any) => item.product_id);
    const { data: products } = await supabaseClient
      .from("store_products")
      .select("*")
      .in("id", productIds);

    if (!products || products.length === 0) {
      throw new Error("Products not found");
    }

    // Build line items for Stripe
    const lineItems = [];
    let hasSubscription = false;

    for (const cartItem of cartItems) {
      const product = products.find((p: any) => p.id === cartItem.product_id);
      if (!product) continue;

      // Calculate item price including addons
      let unitPrice = product.is_subscription 
        ? (product.subscription_price || product.price) 
        : product.price;

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

      if (product.is_subscription) {
        hasSubscription = true;
        
        // Create or get Stripe price for subscription
        let priceId = product.stripe_price_id;
        
        if (!priceId) {
          // Create product and price in Stripe
          const stripeProduct = await stripe.products.create({
            name: product.name,
            description: product.short_description || product.description,
            metadata: { supabase_product_id: product.id }
          });

          const stripePrice = await stripe.prices.create({
            product: stripeProduct.id,
            unit_amount: Math.round(unitPrice * 100),
            currency: "usd",
            recurring: { interval: "month" }
          });

          priceId = stripePrice.id;

          // Save price ID back to database
          await supabaseClient
            .from("store_products")
            .update({ 
              stripe_product_id: stripeProduct.id, 
              stripe_price_id: priceId 
            })
            .eq("id", product.id);
        }

        lineItems.push({
          price: priceId,
          quantity: cartItem.quantity
        });
      } else {
        // One-time purchase
        lineItems.push({
          price_data: {
            currency: "usd",
            product_data: {
              name: product.name,
              description: product.short_description,
              images: product.images && product.images.length > 0 ? [product.images[0]] : undefined
            },
            unit_amount: Math.round(unitPrice * 100)
          },
          quantity: cartItem.quantity
        });
      }
    }

    logStep("Line items created", { count: lineItems.length, hasSubscription });

    // Create checkout session
    const origin = req.headers.get("origin") || "https://vendx.space";
    
    const sessionConfig: any = {
      customer: customerId,
      line_items: lineItems,
      mode: hasSubscription ? "subscription" : "payment",
      success_url: `${origin}/store/order-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/store/cart`,
      shipping_address_collection: {
        allowed_countries: ["US", "CA", "GB", "AU"]
      },
      metadata: {
        supabase_user_id: user.id,
        cart_items: JSON.stringify(cartItems.map((item: any) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          addon_ids: item.addon_ids
        })))
      }
    };

    // Add shipping options for non-subscription orders
    if (!hasSubscription) {
      sessionConfig.shipping_options = [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: 0, currency: "usd" },
            display_name: "Free shipping",
            delivery_estimate: {
              minimum: { unit: "business_day", value: 5 },
              maximum: { unit: "business_day", value: 7 }
            }
          }
        },
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: 999, currency: "usd" },
            display_name: "Express shipping",
            delivery_estimate: {
              minimum: { unit: "business_day", value: 2 },
              maximum: { unit: "business_day", value: 3 }
            }
          }
        }
      ];
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
    logStep("Checkout session created", { sessionId: session.id });

    return new Response(JSON.stringify({ url: session.url }), {
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
