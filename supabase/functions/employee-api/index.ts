// VendX Employee Operations API
// Auth: Bearer vxat_... access token issued by VendX SSO for an employee account.
// Scopes: ops:routes, ops:collections, ops:tickets. Every write is attributed to the
// employee and recorded in audit_logs. Managers see everything; operators/techs see
// only their own assigned routes, collections and tickets (plus unassigned tickets).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const STAFF = ["super_admin", "global_operations_manager", "event_manager", "tech_support_lead", "finance_accounting",
  "regional_manager", "employee_operator", "support", "warehouse_logistics"];
const MANAGERS = ["super_admin", "global_operations_manager", "regional_manager", "tech_support_lead"];

async function sha256Hex(i: string) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(i));
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const uuid = z.string().uuid();
const StopPatch = z.object({
  status: z.enum(["pending", "in_progress", "completed", "skipped"]).optional(),
  tech_notes: z.string().max(5000).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  restocked_items: z.array(z.record(z.unknown())).max(500).optional(),
}).strict();
const CollectionIn = z.object({
  machine_id: uuid, location_id: uuid.nullable().optional(), route_stop_id: uuid.nullable().optional(),
  cash_amount: z.number().min(0).max(1_000_000).default(0), coins_amount: z.number().min(0).max(1_000_000).default(0),
  collection_date: z.string().datetime().optional(), notes: z.string().max(2000).nullable().optional(),
}).strict();
const CollectionPatch = CollectionIn.partial().omit({ machine_id: true }).strict();
const SR_STATUS = z.enum(["open", "in_progress", "pending", "resolved", "closed"]);
const PRIORITY = z.enum(["low", "medium", "normal", "high", "critical", "urgent"]);
const ServiceReqIn = z.object({
  machine_id: z.string().min(1).max(100), location: z.string().min(1).max(300),
  issue_type: z.string().min(1).max(100), description: z.string().min(1).max(5000),
  priority: PRIORITY.optional(), assigned_to: uuid.nullable().optional(),
}).strict();
const ServiceReqPatch = z.object({
  status: SR_STATUS.optional(), priority: PRIORITY.optional(), resolution: z.string().max(5000).nullable().optional(),
  description: z.string().max(5000).optional(), issue_type: z.string().max(100).optional(),
  assigned_to: uuid.nullable().optional(),
}).strict();
const ExtTicketIn = z.object({
  client_id: uuid.nullable().optional(), location_id: uuid.nullable().optional(), machine_id: uuid.nullable().optional(),
  subject: z.string().min(1).max(300), description: z.string().max(5000).nullable().optional(),
  priority: PRIORITY.optional(), scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  assigned_technician_id: uuid.nullable().optional(),
}).strict();
const ExtTicketPatch = z.object({
  status: z.enum(["new", "scheduled", "in_progress", "on_hold", "completed", "cancelled"]).optional(),
  priority: PRIORITY.optional(), scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  scheduled_time: z.string().max(10).nullable().optional(), technician_notes: z.string().max(5000).nullable().optional(),
  resolution: z.string().max(5000).nullable().optional(), labor_hours: z.number().min(0).max(1000).nullable().optional(),
  parts_cost: z.number().min(0).max(1_000_000).nullable().optional(),
  actual_duration_minutes: z.number().int().min(0).max(100000).nullable().optional(),
  assigned_technician_id: uuid.nullable().optional(), subject: z.string().max(300).optional(),
  description: z.string().max(5000).nullable().optional(),
}).strict();
const NoteIn = z.object({ message: z.string().min(1).max(5000), internal: z.boolean().optional() }).strict();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!token.startsWith("vxat_")) return json({ error: "invalid_token" }, 401);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: tok } = await db.from("vendx_sso_tokens")
      .select("id, user_id, scopes, expires_at, revoked_at").eq("access_token_hash", await sha256Hex(token)).maybeSingle();
    if (!tok || tok.revoked_at || new Date(tok.expires_at) < new Date()) return json({ error: "invalid_token" }, 401);
    const uid: string = tok.user_id;
    const scopes: string[] = tok.scopes ?? [];

    const [{ data: roleRows }, { data: profile }] = await Promise.all([
      db.from("user_roles").select("role").eq("user_id", uid),
      db.from("profiles").select("full_name, email").eq("id", uid).maybeSingle(),
    ]);
    const roles = (roleRows ?? []).map((r: any) => r.role as string);
    if (!roles.some((r) => STAFF.includes(r))) return json({ error: "forbidden", message: "Employee account required" }, 403);
    const isMgr = roles.some((r) => MANAGERS.includes(r));
    const name = profile?.full_name || profile?.email || "Employee";
    db.from("vendx_sso_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", tok.id).then(() => {});

    const need = (s: string) => { if (!scopes.includes(s)) throw new HttpErr(403, `missing_scope:${s}`); };
    const audit = (action: string, entity: string, id: string, details: unknown) =>
      db.from("audit_logs").insert({ user_id: uid, user_email: profile?.email, user_role: roles[0], action,
        entity_type: entity, entity_id: id, details: { via: "employee-api", ...(details as object) } });

    const url = new URL(req.url);
    const parts = url.pathname.split("/employee-api")[1]?.split("/").filter(Boolean) ?? [];
    const [res, id, sub] = parts;
    const m = req.method;
    const body = m === "GET" ? null : await req.json().catch(() => { throw new HttpErr(400, "invalid_json"); });
    const parse = <T>(s: z.ZodType<T>, b: unknown): T => {
      const r = s.safeParse(b);
      if (!r.success) throw new HttpErr(400, "validation_error", r.error.flatten().fieldErrors);
      return r.data;
    };
    if (id && !uuid.safeParse(id).success) throw new HttpErr(400, "invalid_id");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 100) || 100, 500);

    // ---------- me ----------
    if (res === "me" && m === "GET") return json({ id: uid, name, email: profile?.email, roles, is_manager: isMgr, scopes });

    // ---------- routes ----------
    const routeAllowed = async (routeId: string) => {
      const { data: r } = await db.from("service_routes").select("id, assigned_to").eq("id", routeId).maybeSingle();
      if (!r) throw new HttpErr(404, "not_found");
      if (!isMgr && r.assigned_to !== uid) throw new HttpErr(403, "forbidden");
      return r;
    };
    if (res === "routes") {
      need("ops:routes");
      if (m === "GET" && !id) {
        let q = db.from("service_routes").select("*").order("name").limit(limit);
        if (!isMgr || url.searchParams.get("mine") === "true") q = q.eq("assigned_to", uid);
        const st = url.searchParams.get("status"); if (st) q = q.eq("status", st);
        const { data, error } = await q; if (error) throw error;
        return json({ data });
      }
      if (m === "GET" && id) {
        await routeAllowed(id);
        const [{ data: route }, { data: stops }] = await Promise.all([
          db.from("service_routes").select("*").eq("id", id).single(),
          db.from("route_stops").select("*, location:locations(id,name,address,city), machine:vendx_machines(id,name,machine_code)")
            .eq("route_id", id).order("day_number").order("stop_order"),
        ]);
        return json({ data: { ...route, stops } });
      }
      if (m === "PATCH" && id) {
        await routeAllowed(id);
        const p = parse(z.object({ status: z.enum(["active", "in_progress", "completed", "paused"]) }).strict(), body);
        const upd: any = { ...p }; if (p.status === "completed") upd.last_serviced_at = new Date().toISOString();
        const { data, error } = await db.from("service_routes").update(upd).eq("id", id).select().single(); if (error) throw error;
        await audit("update", "service_route", id, p); return json({ data });
      }
    }

    // ---------- stops ----------
    if (res === "stops" && id) {
      need("ops:routes");
      const { data: stop } = await db.from("route_stops").select("id, route_id").eq("id", id).maybeSingle();
      if (!stop) throw new HttpErr(404, "not_found");
      await routeAllowed(stop.route_id);
      if (m === "GET") { const { data } = await db.from("route_stops").select("*").eq("id", id).single(); return json({ data }); }
      if (m === "PATCH" || (m === "POST" && sub === "complete")) {
        const p = parse(StopPatch, body ?? {});
        const upd: any = { ...p };
        if (sub === "complete") upd.status = "completed";
        if (upd.status === "completed") { upd.completed_at = new Date().toISOString(); upd.completed_by = uid; }
        const { data, error } = await db.from("route_stops").update(upd).eq("id", id).select().single(); if (error) throw error;
        await audit(sub === "complete" ? "complete" : "update", "route_stop", id, p); return json({ data });
      }
    }

    // ---------- collections ----------
    if (res === "collections") {
      need("ops:collections");
      if (m === "GET" && !id) {
        let q = db.from("revenue_collections").select("*").order("collection_date", { ascending: false }).limit(limit);
        if (!isMgr) q = q.eq("collected_by", uid);
        for (const k of ["machine_id", "location_id", "route_stop_id"]) { const v = url.searchParams.get(k); if (v) q = q.eq(k, v); }
        const from = url.searchParams.get("from"), to = url.searchParams.get("to");
        if (from) q = q.gte("collection_date", from); if (to) q = q.lte("collection_date", to);
        const { data, error } = await q; if (error) throw error; return json({ data });
      }
      if (m === "POST" && !id) {
        const p = parse(CollectionIn, body);
        if (p.route_stop_id) { const { data: s } = await db.from("route_stops").select("route_id").eq("id", p.route_stop_id).maybeSingle(); if (!s) throw new HttpErr(400, "invalid_route_stop"); await routeAllowed(s.route_id); }
        let locId = p.location_id ?? null;
        if (!locId) { const { data: mc } = await db.from("vendx_machines").select("location_id").eq("id", p.machine_id).maybeSingle(); if (!mc) throw new HttpErr(400, "invalid_machine"); locId = mc.location_id; }
        const row = { ...p, location_id: locId, collected_by: uid, total_amount: p.cash_amount + p.coins_amount,
          collection_date: p.collection_date ?? new Date().toISOString(), verification_status: "pending" };
        const { data, error } = await db.from("revenue_collections").insert(row).select().single(); if (error) throw error;
        await audit("create", "revenue_collection", data.id, row); return json({ data }, 201);
      }
      if (id) {
        const { data: c } = await db.from("revenue_collections").select("*").eq("id", id).maybeSingle();
        if (!c) throw new HttpErr(404, "not_found");
        if (!isMgr && c.collected_by !== uid) throw new HttpErr(403, "forbidden");
        if (m === "GET") return json({ data: c });
        if (m === "PATCH") {
          if (!isMgr && c.verification_status === "verified") throw new HttpErr(409, "already_verified");
          const p = parse(CollectionPatch, body);
          const upd: any = { ...p };
          if (p.cash_amount !== undefined || p.coins_amount !== undefined)
            upd.total_amount = (p.cash_amount ?? Number(c.cash_amount)) + (p.coins_amount ?? Number(c.coins_amount));
          const { data, error } = await db.from("revenue_collections").update(upd).eq("id", id).select().single(); if (error) throw error;
          await audit("update", "revenue_collection", id, { before: c, changes: upd }); return json({ data });
        }
        if (m === "POST" && sub === "verify") {
          if (!isMgr) throw new HttpErr(403, "forbidden");
          const { data, error } = await db.from("revenue_collections").update({ verification_status: "verified", verified_by: uid, verified_at: new Date().toISOString() }).eq("id", id).select().single(); if (error) throw error;
          await audit("verify", "revenue_collection", id, {}); return json({ data });
        }
      }
    }

    // ---------- earnings ----------
    if (res === "earnings" && m === "GET") {
      need("ops:collections");
      const from = url.searchParams.get("from") ?? new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
      const to = url.searchParams.get("to") ?? new Date().toISOString();
      let q = db.from("revenue_collections").select("location_id, total_amount, cash_amount, coins_amount, verification_status, location:locations(name)")
        .gte("collection_date", from).lte("collection_date", to).limit(10000);
      if (!isMgr) q = q.eq("collected_by", uid);
      const loc = url.searchParams.get("location_id"); if (loc) q = q.eq("location_id", loc);
      const { data, error } = await q; if (error) throw error;
      const agg: Record<string, any> = {};
      for (const r of data ?? []) {
        const k = r.location_id ?? "unassigned";
        agg[k] ??= { location_id: r.location_id, location_name: (r as any).location?.name ?? null, total: 0, cash: 0, coins: 0, verified_total: 0, collections: 0 };
        const a = agg[k]; a.total += Number(r.total_amount || 0); a.cash += Number(r.cash_amount || 0); a.coins += Number(r.coins_amount || 0);
        if (r.verification_status === "verified") a.verified_total += Number(r.total_amount || 0); a.collections++;
      }
      const rows = Object.values(agg).sort((a: any, b: any) => b.total - a.total);
      return json({ from, to, grand_total: rows.reduce((s: number, r: any) => s + r.total, 0), data: rows });
    }

    // ---------- service requests (machine/location support tickets) ----------
    if (res === "service-requests") {
      need("ops:tickets");
      if (m === "GET" && !id) {
        let q = db.from("support_tickets").select("*").order("created_at", { ascending: false }).limit(limit);
        if (!isMgr) q = q.or(`assigned_to.eq.${uid},assigned_to.is.null`);
        const st = url.searchParams.get("status"); if (st) q = q.eq("status", st);
        const { data, error } = await q; if (error) throw error; return json({ data });
      }
      if (m === "POST" && !id) {
        const p = parse(ServiceReqIn, body);
        if (!isMgr) delete (p as any).assigned_to;
        const row = { ...p, ticket_number: `SR-${Date.now().toString(36).toUpperCase()}`, status: "open", priority: p.priority ?? "medium" };
        const { data, error } = await db.from("support_tickets").insert(row).select().single(); if (error) throw error;
        await audit("create", "support_ticket", data.id, row); return json({ data }, 201);
      }
      if (id) {
        const { data: t } = await db.from("support_tickets").select("*").eq("id", id).maybeSingle();
        if (!t) throw new HttpErr(404, "not_found");
        if (!isMgr && t.assigned_to && t.assigned_to !== uid) throw new HttpErr(403, "forbidden");
        if (m === "GET" && !sub) {
          const { data: responses } = await db.from("support_ticket_responses").select("*").eq("ticket_id", id).order("created_at");
          return json({ data: { ...t, responses } });
        }
        if (m === "PATCH") {
          const p = parse(ServiceReqPatch, body);
          if (!isMgr && p.assigned_to !== undefined && p.assigned_to !== uid) throw new HttpErr(403, "only_managers_can_reassign");
          const upd: any = { ...p };
          if (p.status === "resolved" || p.status === "closed") upd.resolved_at = new Date().toISOString();
          const { data, error } = await db.from("support_tickets").update(upd).eq("id", id).select().single(); if (error) throw error;
          await audit("update", "support_ticket", id, p); return json({ data });
        }
        if (m === "POST" && sub === "responses") {
          const p = parse(NoteIn, body);
          const { data, error } = await db.from("support_ticket_responses").insert({ ticket_id: id, responder_id: uid, responder_name: name,
            responder_role: roles[0], message: p.message, is_internal_note: p.internal ?? true }).select().single(); if (error) throw error;
          await audit("comment", "support_ticket", id, {}); return json({ data }, 201);
        }
      }
    }

    // ---------- external (client-owned machine) service tickets ----------
    if (res === "service-tickets") {
      need("ops:tickets");
      if (m === "GET" && !id) {
        let q = db.from("vendx_external_service_tickets").select("*, location:vendx_external_locations(name,address), machine:vendx_external_machines(asset_label)")
          .is("merged_into_ticket_id", null).order("scheduled_date", { ascending: true, nullsFirst: false }).limit(limit);
        if (!isMgr) q = q.or(`assigned_technician_id.eq.${uid},assigned_technician_id.is.null`);
        const st = url.searchParams.get("status"); if (st) q = q.eq("status", st);
        const d = url.searchParams.get("scheduled_date"); if (d) q = q.eq("scheduled_date", d);
        const { data, error } = await q; if (error) throw error; return json({ data });
      }
      if (m === "POST" && !id) {
        const p = parse(ExtTicketIn, body);
        if (!isMgr) delete (p as any).assigned_technician_id;
        const row = { ...p, status: "new", source: "employee_app", created_by: uid };
        const { data, error } = await db.from("vendx_external_service_tickets").insert(row).select().single(); if (error) throw error;
        await audit("create", "external_service_ticket", data.id, row); return json({ data }, 201);
      }
      if (id) {
        const { data: t } = await db.from("vendx_external_service_tickets").select("*").eq("id", id).maybeSingle();
        if (!t) throw new HttpErr(404, "not_found");
        if (!isMgr && t.assigned_technician_id && t.assigned_technician_id !== uid) throw new HttpErr(403, "forbidden");
        if (m === "GET" && !sub) {
          const [{ data: updates }, { data: machines }] = await Promise.all([
            db.from("vendx_external_service_ticket_updates").select("*").eq("ticket_id", id).order("created_at"),
            db.from("vendx_external_service_ticket_machines").select("*, machine:vendx_external_machines(id,asset_label,make,model)").eq("ticket_id", id),
          ]);
          return json({ data: { ...t, updates, machines } });
        }
        if (m === "PATCH") {
          const p = parse(ExtTicketPatch, body);
          if (!isMgr && p.assigned_technician_id !== undefined && p.assigned_technician_id !== uid) throw new HttpErr(403, "only_managers_can_reassign");
          const { data, error } = await db.from("vendx_external_service_tickets").update(p).eq("id", id).select().single(); if (error) throw error;
          if (p.status && p.status !== t.status)
            await db.from("vendx_external_service_ticket_updates").insert({ ticket_id: id, author_id: uid, author_name: name, message: `Status changed via employee app`, is_internal: true, status_change: p.status });
          await audit("update", "external_service_ticket", id, p); return json({ data });
        }
        if (m === "POST" && sub === "updates") {
          const p = parse(NoteIn, body);
          const { data, error } = await db.from("vendx_external_service_ticket_updates").insert({ ticket_id: id, author_id: uid, author_name: name,
            message: p.message, is_internal: p.internal ?? true }).select().single(); if (error) throw error;
          await audit("comment", "external_service_ticket", id, {}); return json({ data }, 201);
        }
      }
    }

    return json({ error: "not_found", message: `No endpoint for ${m} /${parts.join("/")}` }, 404);
  } catch (e) {
    if (e instanceof HttpErr) return json({ error: e.code, details: e.details }, e.status);
    console.error("employee-api error", e);
    return json({ error: "server_error", message: (e as any)?.message ?? String(e) }, 500);
  }
});

class HttpErr extends Error {
  constructor(public status: number, public code: string, public details?: unknown) { super(code); }
}
