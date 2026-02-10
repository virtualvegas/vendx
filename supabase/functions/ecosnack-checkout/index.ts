import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateLockerCode(): string {
  return String(Math.floor(100 + Math.random() * 900));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { action, machine_code, locker_number, item_name, amount, payment_method, session_code, purchase_id } = await req.json();

    // Action: Pay with wallet
    if (action === "wallet_purchase") {
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? ""
      );
      const authHeader = req.headers.get("Authorization")!;
      const token = authHeader.replace("Bearer ", "");
      const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
      if (userError || !userData.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check wallet balance
      const { data: wallet } = await supabaseAdmin
        .from("wallets")
        .select("id, balance")
        .eq("user_id", userData.user.id)
        .eq("wallet_type", "standard")
        .single();

      if (!wallet || wallet.balance < amount) {
        return new Response(JSON.stringify({ error: "Insufficient wallet balance" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check for pre-set locker code from inventory
      let lockerCode = generateLockerCode();
      if (machineRow?.id) {
        const { data: inventorySlot } = await supabaseAdmin
          .from("machine_inventory")
          .select("locker_code")
          .eq("machine_id", machineRow.id)
          .eq("slot_number", locker_number)
          .maybeSingle();
        if (inventorySlot?.locker_code) {
          lockerCode = inventorySlot.locker_code;
        }
      }

      // Deduct wallet
      await supabaseAdmin.from("wallets").update({ balance: wallet.balance - amount }).eq("id", wallet.id);

      // Log wallet transaction
      await supabaseAdmin.from("wallet_transactions").insert({
        wallet_id: wallet.id,
        amount: -amount,
        transaction_type: "ecosnack_purchase",
        description: `EcoSnack: ${item_name} (Locker ${locker_number})`,
        status: "completed",
      });

      // Get machine ID for inventory update
      const { data: machineRow } = await supabaseAdmin
        .from("vendx_machines")
        .select("id")
        .eq("machine_code", machine_code)
        .eq("machine_type", "ecosnack")
        .maybeSingle();

      // Create purchase record
      const { data: purchase } = await supabaseAdmin.from("ecosnack_locker_purchases").insert({
        machine_code,
        locker_number,
        item_name,
        locker_code: lockerCode,
        amount,
        payment_method: "wallet",
        payment_status: "completed",
        user_id: userData.user.id,
        machine_id: machineRow?.id || null,
      }).select().single();

      // Decrement inventory so locker shows as sold
      if (machineRow?.id) {
        await supabaseAdmin
          .from("machine_inventory")
          .update({ quantity: 0 })
          .eq("machine_id", machineRow.id)
          .eq("slot_number", locker_number);
      }

      // Log to synced_transactions for unified finance view
      await supabaseAdmin.from("synced_transactions").insert({
        provider: "vendx_pay",
        provider_transaction_id: `ecosnack_${purchase?.id || crypto.randomUUID()}`,
        transaction_type: "revenue",
        amount: amount,
        currency: "usd",
        status: "completed",
        description: `EcoSnack: ${item_name} (Locker ${locker_number}) at ${machine_code}`,
        customer_email: userData.user.email || null,
        customer_name: null,
        transaction_date: new Date().toISOString(),
        metadata: { source: "ecosnack", machine_code, locker_number, purchase_id: purchase?.id },
        synced_at: new Date().toISOString(),
      });

      return new Response(JSON.stringify({
        success: true,
        locker_code: lockerCode,
        locker_number,
        purchase_id: purchase?.id,
        new_balance: wallet.balance - amount,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: Pay with Stripe
    if (action === "stripe_checkout") {
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? ""
      );
      const authHeader = req.headers.get("Authorization");
      let userId: string | null = null;
      let userEmail: string | undefined;

      if (authHeader) {
        const token = authHeader.replace("Bearer ", "");
        const { data: userData } = await supabaseClient.auth.getUser(token);
        userId = userData.user?.id || null;
        userEmail = userData.user?.email;
      }

      // Get machine ID for inventory update
      const { data: machineRow } = await supabaseAdmin
        .from("vendx_machines")
        .select("id")
        .eq("machine_code", machine_code)
        .eq("machine_type", "ecosnack")
        .maybeSingle();

      // Check for pre-set locker code from inventory
      let lockerCode = generateLockerCode();
      if (machineRow?.id) {
        const { data: inventorySlot } = await supabaseAdmin
          .from("machine_inventory")
          .select("locker_code")
          .eq("machine_id", machineRow.id)
          .eq("slot_number", locker_number)
          .maybeSingle();
        if (inventorySlot?.locker_code) {
          lockerCode = inventorySlot.locker_code;
        }
      }

      // Create pending purchase with 5-minute expiry
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      const { data: purchase } = await supabaseAdmin.from("ecosnack_locker_purchases").insert({
        machine_code,
        locker_number,
        item_name,
        locker_code: lockerCode,
        amount,
        payment_method: "stripe",
        payment_status: "pending",
        user_id: userId,
        expires_at: expiresAt,
        machine_id: machineRow?.id || null,
      }).select().single();

      // Decrement inventory immediately so no one else can buy this locker
      if (machineRow?.id) {
        await supabaseAdmin
          .from("machine_inventory")
          .update({ quantity: 0 })
          .eq("machine_id", machineRow.id)
          .eq("slot_number", locker_number);
      }

      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
        apiVersion: "2023-10-16",
      });

      const origin = req.headers.get("origin") || "https://vendx.lovable.app";

      const session = await stripe.checkout.sessions.create({
        ...(userEmail ? { customer_email: userEmail } : {}),
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: {
              name: `EcoSnack - ${item_name}`,
              description: `Locker #${locker_number} at machine ${machine_code}`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        }],
        mode: "payment",
        success_url: `${origin}/ecosnack/success?purchase_id=${purchase?.id}&locker=${locker_number}`,
        cancel_url: `${origin}/ecosnack/${machine_code}?canceled=true`,
        metadata: {
          purchase_id: purchase?.id,
          type: "ecosnack",
        },
      });

      // Store stripe session ID
      await supabaseAdmin.from("ecosnack_locker_purchases")
        .update({ stripe_session_id: session.id })
        .eq("id", purchase?.id);

      return new Response(JSON.stringify({
        url: session.url,
        purchase_id: purchase?.id,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: Verify stripe payment and return locker code
    if (action === "verify_payment") {
      const { data: purchase } = await supabaseAdmin
        .from("ecosnack_locker_purchases")
        .select("*")
        .eq("id", purchase_id)
        .single();

      if (!purchase) {
        return new Response(JSON.stringify({ error: "Purchase not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // If already failed, return error
      if (purchase.payment_status === "failed") {
        return new Response(JSON.stringify({ error: "Payment expired. Please try again." }), {
          status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (purchase.payment_status === "completed") {
        return new Response(JSON.stringify({
          success: true,
          locker_code: purchase.locker_code,
          locker_number: purchase.locker_number,
          item_name: purchase.item_name,
          machine_code: purchase.machine_code,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if pending purchase has expired (5-minute window)
      if (purchase.payment_status === "pending" && purchase.expires_at) {
        const expiresAt = new Date(purchase.expires_at).getTime();
        if (Date.now() > expiresAt) {
          // Mark as failed
          await supabaseAdmin.from("ecosnack_locker_purchases")
            .update({ payment_status: "failed" })
            .eq("id", purchase_id);

          // Restore inventory so locker becomes available again
          if (purchase.machine_id) {
            await supabaseAdmin
              .from("machine_inventory")
              .update({ quantity: 1 })
              .eq("machine_id", purchase.machine_id)
              .eq("slot_number", purchase.locker_number);
          }

          return new Response(JSON.stringify({ error: "Payment expired. Please try again." }), {
            status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Verify with Stripe
      if (purchase.stripe_session_id) {
        const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
          apiVersion: "2023-10-16",
        });
        const session = await stripe.checkout.sessions.retrieve(purchase.stripe_session_id);

        if (session.payment_status === "paid") {
          await supabaseAdmin.from("ecosnack_locker_purchases")
            .update({ payment_status: "completed" })
            .eq("id", purchase_id);

          // Log to synced_transactions for unified finance view
          await supabaseAdmin.from("synced_transactions").insert({
            provider: "stripe",
            provider_transaction_id: `ecosnack_stripe_${purchase_id}`,
            transaction_type: "revenue",
            amount: purchase.amount,
            currency: "usd",
            status: "completed",
            description: `EcoSnack: ${purchase.item_name} (Locker ${purchase.locker_number}) at ${purchase.machine_code}`,
            customer_email: null,
            customer_name: null,
            transaction_date: new Date().toISOString(),
            metadata: { source: "ecosnack", machine_code: purchase.machine_code, locker_number: purchase.locker_number, purchase_id },
            synced_at: new Date().toISOString(),
          });

          return new Response(JSON.stringify({
            success: true,
            locker_code: purchase.locker_code,
            locker_number: purchase.locker_number,
            item_name: purchase.item_name,
            machine_code: purchase.machine_code,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      return new Response(JSON.stringify({ error: "Payment not confirmed yet" }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("EcoSnack checkout error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
