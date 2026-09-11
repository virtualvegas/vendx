// Lists real PayPal Zettle (connected register feed) stores + individual registers via API token
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // --- auth: must be a signed-in privileged user ---
  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace("Bearer ", "").trim();
  if (!jwt) return json({ error: "Unauthorized" }, 401);

  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);
  const allowed = new Set([
    "super_admin",
    "global_operations_manager",
    "finance_accounting",
    "regional_manager",
  ]);
  if (!(roles || []).some((r: any) => allowed.has(r.role))) {
    return json({ error: "Forbidden" }, 403);
  }

  const token = (Deno.env.get("PAYPAL_ZETTLE_ACCESS_TOKEN") || Deno.env.get("LOYVERSE_ACCESS_TOKEN"));
  if (!token) return json({ error: "POS API key is not configured" }, 500);

  try {
    const headers = { Authorization: `Bearer ${token}` };
    const [storesResp, devicesResp] = await Promise.all([
      fetch("https://api.loyverse.com/v1.0/stores?limit=250", { headers }),
      fetch("https://api.loyverse.com/v1.0/pos_devices?limit=250", { headers }),
    ]);

    if (!storesResp.ok) {
      const t = await storesResp.text();
      return json({ error: `POS API error (${storesResp.status}): ${t.slice(0, 300)}` }, 502);
    }

    const storesJson = await storesResp.json();
    const devicesJson = devicesResp.ok ? await devicesResp.json() : { pos_devices: [] };

    const stores: any[] = storesJson.stores || [];
    const devices: any[] = devicesJson.pos_devices || [];
    const storeName = (id: string) => stores.find((s) => s.id === id)?.name || null;

    // Already-linked registers in our DB
    const { data: linked } = await admin
      .from("vendx_pos_stores")
      .select("pos_store_id, display_name, is_active");
    const linkedIds = new Set((linked || []).map((l: any) => String(l.pos_store_id)));

    // Receipt counts per register id we already hold
    const { data: receiptRows } = await admin
      .from("vendx_pos_receipts")
      .select("pos_store_id")
      .not("pos_store_id", "is", null)
      .limit(5000);
    const counts = new Map<string, number>();
    (receiptRows || []).forEach((r: any) => {
      const k = String(r.pos_store_id);
      counts.set(k, (counts.get(k) || 0) + 1);
    });

    const registers = [
      ...stores.map((s) => ({
        kind: "store" as const,
        id: String(s.id),
        name: s.name || `Store ${String(s.id).slice(0, 8)}`,
        store_id: String(s.id),
        store_name: s.name || null,
        address: s.address || null,
        activated: true,
        linked: linkedIds.has(String(s.id)),
        receipts: counts.get(String(s.id)) || 0,
      })),
      ...devices.map((d) => ({
        kind: "device" as const,
        id: String(d.id),
        name: d.name || `Register ${String(d.id).slice(0, 8)}`,
        store_id: d.store_id ? String(d.store_id) : null,
        store_name: d.store_id ? storeName(String(d.store_id)) : null,
        address: null,
        activated: d.activated !== false,
        linked: linkedIds.has(String(d.id)),
        receipts: counts.get(String(d.id)) || 0,
      })),
    ];

    return json({ registers });
  } catch (e: any) {
    return json({ error: e?.message || "Failed to load registers" }, 500);
  }
});
