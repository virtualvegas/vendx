import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get user from JWT
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get or create ticket balance
    let { data: tickets } = await supabase
      .from("user_tickets")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!tickets) {
      // Create initial ticket record
      const { data: newTickets, error: createError } = await supabase
        .from("user_tickets")
        .insert({ user_id: user.id, balance: 0 })
        .select()
        .single();

      if (createError) {
        console.error("Create tickets error:", createError);
        return new Response(JSON.stringify({ error: "Failed to initialize tickets" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      tickets = newTickets;
    }

    // Get recent transactions
    const { data: transactions } = await supabase
      .from("ticket_transactions")
      .select(`
        id,
        transaction_type,
        amount,
        balance_after,
        game_name,
        score,
        metadata,
        created_at,
        machine:vendx_machines(id, name, machine_code),
        location:locations(id, name, city)
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    return new Response(
      JSON.stringify({
        balance: tickets.balance,
        lifetime_earned: tickets.lifetime_earned,
        lifetime_redeemed: tickets.lifetime_redeemed,
        transactions: transactions || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Tickets balance error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
