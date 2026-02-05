import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STORE-REFUND-WALLET] ${step}${detailsStr}`);
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

    const { pendingTransactionId } = await req.json();
    logStep("Refund request received", { userId: user.id, pendingTransactionId });

    if (!pendingTransactionId) {
      throw new Error("No pending transaction ID provided");
    }

    // Get the pending transaction
    const { data: pendingTx, error: txError } = await supabase
      .from("wallet_transactions")
      .select("wallet_id, amount, status")
      .eq("id", pendingTransactionId)
      .single();

    if (txError || !pendingTx) {
      logStep("Transaction not found", { pendingTransactionId });
      return new Response(
        JSON.stringify({ success: true, message: "Transaction not found or already processed" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify the transaction belongs to the user's wallet
    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("id, balance, user_id")
      .eq("id", pendingTx.wallet_id)
      .single();

    if (walletError || !wallet || wallet.user_id !== user.id) {
      throw new Error("Wallet not found or does not belong to user");
    }

    // Only refund if transaction is still pending
    if (pendingTx.status !== "pending") {
      logStep("Transaction already processed", { status: pendingTx.status });
      return new Response(
        JSON.stringify({ success: true, message: "Transaction already processed" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Refund the wallet
    const refundAmount = Math.abs(pendingTx.amount);
    const { error: updateError } = await supabase
      .from("wallets")
      .update({ balance: wallet.balance + refundAmount })
      .eq("id", wallet.id);

    if (updateError) {
      throw new Error("Failed to refund wallet balance");
    }

    // Update transaction status to cancelled
    await supabase
      .from("wallet_transactions")
      .update({ 
        status: "cancelled",
        description: "Store purchase cancelled by user - wallet refunded"
      })
      .eq("id", pendingTransactionId);

    logStep("Wallet refunded successfully", { 
      refundAmount, 
      newBalance: wallet.balance + refundAmount 
    });

    return new Response(
      JSON.stringify({
        success: true,
        refundedAmount: refundAmount,
        newBalance: wallet.balance + refundAmount,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An error occurred";
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
