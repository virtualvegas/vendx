import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { token } = await req.json();
    if (!token) throw new Error("Download token is required");

    // Find purchase by token
    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from("beat_purchases")
      .select("*, beat_tracks(*)")
      .eq("download_token", token)
      .single();

    if (purchaseError || !purchase) {
      return new Response(JSON.stringify({ error: "Invalid download token" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    // Check expiration
    if (purchase.download_expires_at && new Date(purchase.download_expires_at) < new Date()) {
      return new Response(JSON.stringify({ expired: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify payment is completed - check with Stripe if still pending
    if (purchase.payment_status === "pending" && purchase.stripe_session_id) {
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
        apiVersion: "2023-10-16",
      });
      const session = await stripe.checkout.sessions.retrieve(purchase.stripe_session_id);
      
      if (session.payment_status === "paid") {
        await supabaseAdmin
          .from("beat_purchases")
          .update({ 
            payment_status: "completed",
            email: session.customer_details?.email || purchase.email,
          })
          .eq("id", purchase.id);

        // Increment purchase count
        await supabaseAdmin
          .from("beat_tracks")
          .update({ purchase_count: (purchase.beat_tracks?.purchase_count || 0) + 1 })
          .eq("id", purchase.beat_id);
      } else {
        return new Response(JSON.stringify({ error: "Payment not completed" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 402,
        });
      }
    } else if (purchase.payment_status !== "completed") {
      return new Response(JSON.stringify({ error: "Payment not completed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 402,
      });
    }

    // Increment download count
    await supabaseAdmin
      .from("beat_purchases")
      .update({ download_count: (purchase.download_count || 0) + 1 })
      .eq("id", purchase.id);

    // Generate signed URL for the full file
    const beat = purchase.beat_tracks;
    let downloadUrl = beat?.full_file_url;

    // If stored in Supabase storage, generate a signed URL
    if (downloadUrl && downloadUrl.includes("beat-files")) {
      const filePath = downloadUrl.split("beat-files/").pop();
      if (filePath) {
        const { data: signedData } = await supabaseAdmin.storage
          .from("beat-files")
          .createSignedUrl(filePath, 3600); // 1 hour
        if (signedData?.signedUrl) {
          downloadUrl = signedData.signedUrl;
        }
      }
    }

    return new Response(JSON.stringify({
      download_url: downloadUrl,
      title: beat?.title || "Beat",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
