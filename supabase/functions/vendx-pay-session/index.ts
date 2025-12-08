import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-machine-api-key",
};

function generateSessionCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { action, session_code, user_id, machine_id, pin } = await req.json();

    // For machine-side operations (create session, verify)
    if (action === "create") {
      const apiKey = req.headers.get("x-machine-api-key");
      
      if (!apiKey) {
        return new Response(JSON.stringify({ error: "Machine API key required" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify machine
      const { data: machine } = await supabase
        .from("vendx_machines")
        .select("id, status, vendx_pay_enabled")
        .eq("api_key", apiKey)
        .maybeSingle();

      if (!machine || machine.status !== "active" || !machine.vendx_pay_enabled) {
        return new Response(JSON.stringify({ error: "Invalid or inactive machine" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create QR session
      const sessionCode = generateSessionCode();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      const { data: session, error: sessionError } = await supabase
        .from("machine_sessions")
        .insert({
          machine_id: machine.id,
          session_code: sessionCode,
          session_type: "qr",
          status: "pending",
          expires_at: expiresAt.toISOString(),
        })
        .select("id, session_code, expires_at")
        .single();

      if (sessionError) {
        console.error("Error creating session:", sessionError);
        throw sessionError;
      }

      console.log("Created session:", sessionCode, "for machine:", machine.id);

      return new Response(
        JSON.stringify({
          session_code: session.session_code,
          expires_at: session.expires_at,
          qr_data: `vendxpay:${session.session_code}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // User scans QR or machine verifies PIN
    if (action === "verify_qr") {
      // User is scanning QR code to link their wallet
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Authorization required" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const token = authHeader.replace("Bearer ", "");
      const supabaseUser = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? ""
      );

      const { data: userData, error: userError } = await supabaseUser.auth.getUser(token);
      if (userError || !userData.user) {
        return new Response(JSON.stringify({ error: "Invalid user" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find and verify session
      const { data: session, error: sessionError } = await supabase
        .from("machine_sessions")
        .select("id, machine_id, status, expires_at")
        .eq("session_code", session_code)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (!session) {
        return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update session with user
      const { error: updateError } = await supabase
        .from("machine_sessions")
        .update({
          user_id: userData.user.id,
          status: "verified",
          verified_at: new Date().toISOString(),
        })
        .eq("id", session.id);

      if (updateError) throw updateError;

      // Get user wallet balance
      const { data: wallet } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      console.log("Session verified for user:", userData.user.id);

      return new Response(
        JSON.stringify({
          success: true,
          balance: wallet?.balance || 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify PIN at machine
    if (action === "verify_pin") {
      const apiKey = req.headers.get("x-machine-api-key");
      
      if (!apiKey) {
        return new Response(JSON.stringify({ error: "Machine API key required" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify machine
      const { data: machine } = await supabase
        .from("vendx_machines")
        .select("id")
        .eq("api_key", apiKey)
        .maybeSingle();

      if (!machine) {
        return new Response(JSON.stringify({ error: "Invalid machine" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find user by PIN
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("pin_code", pin)
        .maybeSingle();

      if (!profile) {
        return new Response(JSON.stringify({ error: "Invalid PIN" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create verified session
      const sessionCode = generateSessionCode();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      const { data: session } = await supabase
        .from("machine_sessions")
        .insert({
          machine_id: machine.id,
          user_id: profile.id,
          session_code: sessionCode,
          session_type: "pin",
          status: "verified",
          expires_at: expiresAt.toISOString(),
          verified_at: new Date().toISOString(),
        })
        .select("id, session_code")
        .single();

      // Get wallet balance
      const { data: wallet } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", profile.id)
        .maybeSingle();

      console.log("PIN verified for user:", profile.id);

      return new Response(
        JSON.stringify({
          success: true,
          session_code: session?.session_code,
          balance: wallet?.balance || 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check session status (machine polling)
    if (action === "check") {
      const apiKey = req.headers.get("x-machine-api-key");
      
      if (!apiKey) {
        return new Response(JSON.stringify({ error: "Machine API key required" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: session } = await supabase
        .from("machine_sessions")
        .select("id, user_id, status, expires_at")
        .eq("session_code", session_code)
        .maybeSingle();

      if (!session) {
        return new Response(JSON.stringify({ status: "not_found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (new Date(session.expires_at) < new Date()) {
        return new Response(JSON.stringify({ status: "expired" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (session.status === "verified" && session.user_id) {
        const { data: wallet } = await supabase
          .from("wallets")
          .select("balance")
          .eq("user_id", session.user_id)
          .maybeSingle();

        return new Response(
          JSON.stringify({
            status: "verified",
            user_id: session.user_id,
            balance: wallet?.balance || 0,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ status: session.status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Session error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
