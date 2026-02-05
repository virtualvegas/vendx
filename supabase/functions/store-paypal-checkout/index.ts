import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const { cartItems, walletCredit } = await req.json();
    if (!cartItems || cartItems.length === 0) {
      throw new Error("Cart is empty");
    }
    logStep("Cart items received", { count: cartItems.length, walletCredit });

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

    // Handle wallet credit for partial payments
    let pendingWalletTransactionId = null;
    let actualWalletCredit = 0;

    if (walletCredit && walletCredit > 0) {
      // Verify wallet balance
      const { data: wallet, error: walletError } = await supabaseClient
        .from("wallets")
        .select("id, balance")
        .eq("user_id", user.id)
        .single();

      if (walletError || !wallet) {
        throw new Error("Wallet not found");
      }

      // Calculate total with shipping
      const shipping = subtotal > 50 ? 0 : 5.99;
      const totalWithShipping = subtotal + shipping;

      // Use the lesser of requested credit or available balance
      actualWalletCredit = Math.min(walletCredit, wallet.balance, totalWithShipping);
      
      if (actualWalletCredit > 0) {
        // Create pending wallet transaction
        const { data: pendingTx, error: txError } = await supabaseClient
          .from("wallet_transactions")
          .insert({
            wallet_id: wallet.id,
            amount: -actualWalletCredit,
            transaction_type: "store_purchase_pending",
            description: "Pending store purchase (PayPal) - awaiting payment confirmation",
            status: "pending"
          })
          .select()
          .single();

        if (txError) {
          throw new Error("Failed to create pending wallet transaction");
        }

        pendingWalletTransactionId = pendingTx.id;

        // Temporarily deduct from wallet
        await supabaseClient
          .from("wallets")
          .update({ balance: wallet.balance - actualWalletCredit })
          .eq("id", wallet.id);

        logStep("Wallet credit reserved", { 
          walletCredit: actualWalletCredit, 
          pendingTxId: pendingWalletTransactionId 
        });

        // Add VendX Pay credit as a discount item
        items.push({
          name: "VendX Pay Credit",
          unit_amount: {
            currency_code: "USD",
            value: (-actualWalletCredit).toFixed(2),
          },
          quantity: "1",
        });

        // Reduce subtotal by wallet credit
        subtotal -= actualWalletCredit;
      }
    }

    // Calculate shipping
    const originalSubtotal = subtotal + actualWalletCredit;
    const shipping = originalSubtotal > 50 ? 0 : 5.99;
    const total = subtotal + shipping;

    logStep("Order calculated", { subtotal, shipping, total, walletCredit: actualWalletCredit, itemCount: items.length });

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
          wallet_credit: actualWalletCredit,
          pending_wallet_tx_id: pendingWalletTransactionId,
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
        items: items.filter(item => parseFloat(item.unit_amount.value) > 0), // Filter out negative items for PayPal
      }],
      application_context: {
        brand_name: "VendX",
        landing_page: "NO_PREFERENCE",
        user_action: "PAY_NOW",
        return_url: `${origin}/store/order-success?paypal=true&pending_tx=${pendingWalletTransactionId || ''}`,
        cancel_url: `${origin}/store/cart?cancelled=true&pending_tx=${pendingWalletTransactionId || ''}`,
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
      // Refund wallet if PayPal order creation fails
      if (pendingWalletTransactionId) {
        await refundPendingWalletTransaction(supabaseClient, pendingWalletTransactionId, user.id);
      }
      throw new Error(`Failed to create PayPal order: ${error}`);
    }

    const order = await orderResponse.json();
    logStep("PayPal order created", { orderId: order.id });

    // Find the approval URL
    const approvalLink = order.links.find((link: any) => link.rel === "approve");
    if (!approvalLink) {
      // Refund wallet if no approval link
      if (pendingWalletTransactionId) {
        await refundPendingWalletTransaction(supabaseClient, pendingWalletTransactionId, user.id);
      }
      throw new Error("PayPal approval URL not found");
    }

    return new Response(JSON.stringify({ 
      url: approvalLink.href,
      orderId: order.id,
      pendingWalletTransactionId,
      walletCreditApplied: actualWalletCredit
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

async function refundPendingWalletTransaction(supabaseClient: any, txId: string, userId: string) {
  try {
    // Get the pending transaction
    const { data: pendingTx } = await supabaseClient
      .from("wallet_transactions")
      .select("wallet_id, amount")
      .eq("id", txId)
      .single();

    if (pendingTx) {
      // Refund the wallet
      const { data: wallet } = await supabaseClient
        .from("wallets")
        .select("balance")
        .eq("id", pendingTx.wallet_id)
        .single();

      if (wallet) {
        await supabaseClient
          .from("wallets")
          .update({ balance: wallet.balance + Math.abs(pendingTx.amount) })
          .eq("id", pendingTx.wallet_id);
      }

      // Update transaction status
      await supabaseClient
        .from("wallet_transactions")
        .update({ 
          status: "cancelled",
          description: "Store purchase cancelled - wallet refunded"
        })
        .eq("id", txId);
    }
  } catch (e) {
    console.error("Failed to refund wallet transaction:", e);
  }
}
