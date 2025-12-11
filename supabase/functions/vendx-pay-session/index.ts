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

// TOTP verification utilities
function base32ToBytes(base32: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  
  for (const char of base32.toUpperCase()) {
    const val = alphabet.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, (i + 1) * 8), 2);
  }
  
  return bytes;
}

async function hmacSha1(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, message.buffer as ArrayBuffer);
  return new Uint8Array(signature);
}

async function generateTOTP(secret: string, timeStep: number = 60, offset: number = 0): Promise<string> {
  const counter = Math.floor(Date.now() / 1000 / timeStep) + offset;
  const counterBytes = new Uint8Array(8);
  let temp = counter;
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = temp & 0xff;
    temp = Math.floor(temp / 256);
  }
  
  const key = base32ToBytes(secret);
  const hmac = await hmacSha1(key, counterBytes);
  
  const off = hmac[19] & 0xf;
  const code = (
    ((hmac[off] & 0x7f) << 24) |
    ((hmac[off + 1] & 0xff) << 16) |
    ((hmac[off + 2] & 0xff) << 8) |
    (hmac[off + 3] & 0xff)
  ) % 1000000;
  
  return code.toString().padStart(6, '0');
}

// Verify TOTP code, allowing for time drift (current and previous window)
async function verifyTOTP(secret: string, code: string, timeStep: number = 60): Promise<boolean> {
  // Check current window and previous window to handle clock skew
  for (let offset = 0; offset >= -1; offset--) {
    const expectedCode = await generateTOTP(secret, timeStep, offset);
    if (expectedCode === code) {
      return true;
    }
  }
  return false;
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

    const { action, session_code, user_id, machine_id, totp_code } = await req.json();

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

    // User scans QR or machine verifies TOTP
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

    // Verify TOTP code at machine (replaces verify_pin)
    if (action === "verify_totp") {
      const apiKey = req.headers.get("x-machine-api-key");
      
      // Demo mode for testing - skip machine validation
      const isDemoMode = apiKey === "demo-api-key";
      let machineDbId: string | null = null;

      if (!isDemoMode) {
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
        machineDbId = machine.id;
      }

      if (!totp_code || totp_code.length !== 6) {
        return new Response(JSON.stringify({ error: "Invalid code format" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get all users with TOTP secrets and check each one
      // In production, you'd want to limit this or use a more efficient lookup
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, totp_secret")
        .not("totp_secret", "is", null);

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        throw profilesError;
      }

      let matchedUserId: string | null = null;

      // Check the TOTP code against all users
      for (const profile of profiles || []) {
        if (profile.totp_secret) {
          const isValid = await verifyTOTP(profile.totp_secret, totp_code);
          if (isValid) {
            matchedUserId = profile.id;
            break;
          }
        }
      }

      if (!matchedUserId) {
        console.log("Invalid TOTP code attempted:", totp_code);
        return new Response(JSON.stringify({ error: "Invalid code" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // In demo mode, skip session creation if no machine
      if (isDemoMode && !machineDbId) {
        // Get wallet balance without creating session
        const { data: wallet } = await supabase
          .from("wallets")
          .select("balance")
          .eq("user_id", matchedUserId)
          .maybeSingle();

        console.log("Demo TOTP verified for user:", matchedUserId);

        return new Response(
          JSON.stringify({
            success: true,
            session_code: "DEMO",
            balance: wallet?.balance || 0,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create verified session for real machines
      const sessionCode = generateSessionCode();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      const { data: session } = await supabase
        .from("machine_sessions")
        .insert({
          machine_id: machineDbId!,
          user_id: matchedUserId,
          session_code: sessionCode,
          session_type: "totp",
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
        .eq("user_id", matchedUserId)
        .maybeSingle();

      console.log("TOTP verified for user:", matchedUserId);

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