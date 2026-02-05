import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PriceBundle {
  plays: number;
  price: number;
  label: string;
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

    const { machine_id, machine_code } = await req.json();

    if (!machine_id && !machine_code) {
      return new Response(JSON.stringify({ error: "Machine ID or code required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build query
    let query = supabase
      .from("vendx_machines")
      .select(`
        id, name, machine_code, status, machine_type, location_id,
        price_per_play, plays_per_bundle, bundle_price, pricing_template_id,
        location:locations(id, name, city, address)
      `);

    if (machine_id) {
      query = query.eq("id", machine_id);
    } else {
      query = query.eq("machine_code", machine_code);
    }

    const { data: machine, error } = await query.maybeSingle();

    if (error) {
      console.error("Machine query error:", error);
      throw error;
    }

    if (!machine) {
      return new Response(JSON.stringify({ error: "Machine not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if arcade machine
    const isArcade = machine.machine_type === "arcade" || machine.machine_type === "claw";

    if (!isArcade) {
      return new Response(JSON.stringify({ 
        error: "Not an arcade machine",
        machine_type: machine.machine_type,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get pricing info
    let pricePerPlay = machine.price_per_play || 1.00;
    let bundles: PriceBundle[] = [];
    let templateName: string | null = null;

    // Check for template pricing
    if (machine.pricing_template_id) {
      const { data: template } = await supabase
        .from("arcade_pricing_templates")
        .select("name, price_per_play, bundles")
        .eq("id", machine.pricing_template_id)
        .eq("is_active", true)
        .maybeSingle();

      if (template) {
        pricePerPlay = template.price_per_play;
        bundles = (template.bundles as unknown as PriceBundle[]) || [];
        templateName = template.name;
      }
    } else if (machine.bundle_price && machine.plays_per_bundle) {
      // Machine has custom bundle
      bundles = [{
        plays: machine.plays_per_bundle,
        price: machine.bundle_price,
        label: `${machine.plays_per_bundle} Plays`,
      }];
    }

    // Calculate savings for bundles
    const bundlesWithSavings = bundles.map(bundle => ({
      ...bundle,
      savings: (pricePerPlay * bundle.plays) - bundle.price,
      savingsPercent: Math.round((1 - bundle.price / (pricePerPlay * bundle.plays)) * 100),
    }));

    console.log("Machine info fetched:", machine.machine_code);

    return new Response(
      JSON.stringify({
        success: true,
        machine: {
          id: machine.id,
          name: machine.name,
          machine_code: machine.machine_code,
          machine_type: machine.machine_type,
          status: machine.status,
          location: machine.location,
        },
        pricing: {
          price_per_play: pricePerPlay,
          bundles: bundlesWithSavings,
          template_name: templateName,
          has_bundles: bundlesWithSavings.length > 0,
        },
        available: machine.status === "active",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Machine info error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
