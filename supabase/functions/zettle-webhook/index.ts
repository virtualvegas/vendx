import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { fetchZettlePurchase } from "../_shared/zettle.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    if (body?.eventName !== "PurchaseCreated") return json({ ok: true, ignored: true });
    const payload = typeof body.payload === "string" ? JSON.parse(body.payload) : body.payload;
    const purchaseUuid = payload?.purchaseUuid;
    if (typeof purchaseUuid !== "string" || !purchaseUuid) return json({ error: "Missing Zettle purchase UUID" }, 400);

    // Never trust event-supplied sale details. Validate the notification by retrieving
    // the purchase from Zettle with this app's native credentials, then run the normal importer.
    await fetchZettlePurchase(purchaseUuid);
    const projectUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!projectUrl || !serviceKey) throw new Error("Backend configuration is unavailable");
    const response = await fetch(`${projectUrl}/functions/v1/zettle-sync`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ since: payload.created || new Date(Date.now() - 5 * 60000).toISOString(), limit: 100 }),
    });
    if (!response.ok) throw new Error(`Zettle sync failed after event (${response.status}): ${(await response.text()).slice(0, 300)}`);
    return json({ ok: true, purchase_uuid: purchaseUuid });
  } catch (error: any) {
    console.error("zettle-webhook error", error);
    return json({ error: error?.message || "Zettle event failed" }, 500);
  }
});
