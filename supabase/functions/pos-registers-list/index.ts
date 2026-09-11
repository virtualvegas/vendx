// Lists PayPal Zettle registers available for linking.
// Uses the native Zettle API when Zettle credentials are configured,
// otherwise falls back to the connected register feed API token.
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

type Register = {
  kind: "store" | "device" | "register";
  id: string;
  name: string;
  store_id: string | null;
  store_name: string | null;
  address: string | null;
  activated: boolean;
  linked: boolean;
  linked_name: string | null;
  receipts: number;
  total: number;
  last_sale_at: string | null;
  last_receipt_number: string | null;
  sample_items: string[];
};

async function zettleToken(clientId: string, apiKey: string) {
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    client_id: clientId,
    assertion: apiKey,
  });
  const resp = await fetch("https://oauth.zettle.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!resp.ok) {
    throw new Error(`Zettle sign-in failed (${resp.status}): ${(await resp.text()).slice(0, 200)}`);
  }
  const j = await resp.json();
  return j.access_token as string;
}

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

  // ---- what we already know locally (used to identify each register) ----
  const { data: linkedRows } = await admin
    .from("vendx_pos_stores")
    .select("pos_store_id, display_name, is_active");
  const linkedMap = new Map<string, string>();
  (linkedRows || []).forEach((l: any) =>
    linkedMap.set(String(l.pos_store_id), l.display_name || "")
  );

  const { data: receiptRows } = await admin
    .from("vendx_pos_receipts")
    .select("pos_store_id, store_name, total_amount, receipt_date, receipt_number, id")
    .not("pos_store_id", "is", null)
    .order("receipt_date", { ascending: false })
    .limit(5000);

  type Stat = {
    receipts: number; total: number; last_sale_at: string | null;
    last_receipt_number: string | null; store_name: string | null; recent_ids: string[];
  };
  const stats = new Map<string, Stat>();
  (receiptRows || []).forEach((r: any) => {
    const k = String(r.pos_store_id);
    const cur = stats.get(k) || {
      receipts: 0, total: 0, last_sale_at: null, last_receipt_number: null,
      store_name: null, recent_ids: [],
    };
    cur.receipts += 1;
    cur.total += Number(r.total_amount || 0);
    if (!cur.last_sale_at || (r.receipt_date && r.receipt_date > cur.last_sale_at)) {
      cur.last_sale_at = r.receipt_date;
      cur.last_receipt_number = r.receipt_number || null;
      cur.store_name = r.store_name || cur.store_name;
    }
    if (cur.recent_ids.length < 3) cur.recent_ids.push(r.id);
    stats.set(k, cur);
  });

  // A few item names per register make it obvious which counter it is
  const allRecent = Array.from(stats.values()).flatMap((s) => s.recent_ids);
  const itemsByRegister = new Map<string, string[]>();
  if (allRecent.length) {
    const { data: items } = await admin
      .from("vendx_pos_receipt_items")
      .select("receipt_id, item_name")
      .in("receipt_id", allRecent.slice(0, 300));
    const receiptToRegister = new Map<string, string>();
    stats.forEach((s, k) => s.recent_ids.forEach((id) => receiptToRegister.set(id, k)));
    (items || []).forEach((it: any) => {
      const k = receiptToRegister.get(it.receipt_id);
      if (!k) return;
      const arr = itemsByRegister.get(k) || [];
      if (arr.length < 4 && it.item_name && !arr.includes(it.item_name)) arr.push(it.item_name);
      itemsByRegister.set(k, arr);
    });
  }

  const decorate = (r: Omit<Register, "linked" | "linked_name" | "receipts" | "total" | "last_sale_at" | "last_receipt_number" | "sample_items">): Register => {
    const s = stats.get(r.id);
    return {
      ...r,
      store_name: r.store_name || s?.store_name || null,
      linked: linkedMap.has(r.id),
      linked_name: linkedMap.get(r.id) || null,
      receipts: s?.receipts || 0,
      total: Number((s?.total || 0).toFixed(2)),
      last_sale_at: s?.last_sale_at || null,
      last_receipt_number: s?.last_receipt_number || null,
      sample_items: itemsByRegister.get(r.id) || [],
    };
  };

  const zettleClientId = Deno.env.get("PAYPAL_ZETTLE_CLIENT_ID");
  const zettleApiKey = Deno.env.get("PAYPAL_ZETTLE_API_KEY");
  const feedToken = Deno.env.get("PAYPAL_ZETTLE_ACCESS_TOKEN") || Deno.env.get("LOYVERSE_ACCESS_TOKEN");

  try {
    let registers: Register[] = [];
    let provider = "";

    if (zettleClientId && zettleApiKey) {
      // ---- native PayPal Zettle ----
      provider = "zettle";
      const token = await zettleToken(zettleClientId, zettleApiKey);
      const headers = { Authorization: `Bearer ${token}` };

      let orgName: string | null = null;
      try {
        const meResp = await fetch("https://oauth.zettle.com/users/me", { headers });
        if (meResp.ok) {
          const me = await meResp.json();
          orgName = me?.organizationName || me?.name || null;
        }
      } catch { /* ignore */ }

      // Zettle has no register directory endpoint; registers are the till users/devices
      // that appear on purchases, so derive them from recent purchases.
      const purchasesResp = await fetch(
        "https://purchase.izettle.com/purchases/v2?limit=500&descending=true",
        { headers }
      );
      if (!purchasesResp.ok) {
        throw new Error(
          `Zettle API error (${purchasesResp.status}): ${(await purchasesResp.text()).slice(0, 200)}`
        );
      }
      const pj = await purchasesResp.json();
      const purchases: any[] = pj.purchases || [];

      const byRegister = new Map<string, { name: string; count: number; total: number; last: string | null }>();
      for (const p of purchases) {
        const id = String(p.userId ?? p.userDisplayName ?? "unknown");
        const name = p.userDisplayName || `Register ${id}`;
        const cur = byRegister.get(id) || { name, count: 0, total: 0, last: null };
        cur.count += 1;
        cur.total += Number(p.amount || 0) / 100;
        const t = p.timestamp || null;
        if (t && (!cur.last || t > cur.last)) cur.last = t;
        byRegister.set(id, cur);
      }

      registers = Array.from(byRegister.entries()).map(([id, v]) =>
        decorate({
          kind: "register",
          id,
          name: v.name,
          store_id: null,
          store_name: orgName,
          address: v.last ? `Zettle activity: ${v.count} sales, last ${new Date(v.last).toLocaleDateString()}` : null,
          activated: true,
        })
      );
    } else if (feedToken) {
      // ---- connected register feed (Zettle sales arriving through the linked POS account) ----
      provider = "connected_feed";
      const headers = { Authorization: `Bearer ${feedToken}` };
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

      registers = [
        ...stores.map((s) =>
          decorate({
            kind: "store",
            id: String(s.id),
            name: s.name || `Store ${String(s.id).slice(0, 8)}`,
            store_id: String(s.id),
            store_name: s.name || null,
            address: s.address || null,
            activated: true,
          })
        ),
        ...devices.map((d) =>
          decorate({
            kind: "device",
            id: String(d.id),
            name: d.name || `Register ${String(d.id).slice(0, 8)}`,
            store_id: d.store_id ? String(d.store_id) : null,
            store_name: d.store_id ? storeName(String(d.store_id)) : null,
            address: null,
            activated: d.activated !== false,
          })
        ),
      ];
    } else {
      return json({ error: "No PayPal Zettle credentials are configured." }, 500);
    }

    // Registers that only exist in our sales history (never returned by the API)
    const known = new Set(registers.map((r) => r.id));
    stats.forEach((s, id) => {
      if (known.has(id)) return;
      registers.push(
        decorate({
          kind: "register",
          id,
          name: linkedMap.get(id) || s.store_name || `Register ${id.slice(0, 8)}`,
          store_id: null,
          store_name: s.store_name,
          address: null,
          activated: true,
        })
      );
    });

    registers.sort((a, b) => b.receipts - a.receipts || a.name.localeCompare(b.name));
    return json({ provider, registers });
  } catch (e: any) {
    return json({ error: e?.message || "Failed to load registers" }, 500);
  }
});
