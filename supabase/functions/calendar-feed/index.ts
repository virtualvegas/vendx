import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2.45.0/cors";
import { buildServiceCalendar } from "./ics.ts";

const STAFF_ROLES = [
  "super_admin", "global_operations_manager", "event_manager", "tech_support_lead",
  "finance_accounting", "regional_manager", "employee_operator", "support", "warehouse_logistics",
];

const response = (body: string, status = 200, calendar = false) => new Response(body, {
  status,
  headers: {
    ...corsHeaders,
    "Content-Type": calendar ? "text/calendar; charset=utf-8" : "text/plain; charset=utf-8",
    "Content-Disposition": calendar ? 'inline; filename="vendx-my-service.ics"' : "inline",
    "Cache-Control": "private, no-cache, max-age=0, must-revalidate",
    "X-Content-Type-Options": "nosniff",
  },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return response("Method not allowed", 405);

  try {
    const token = new URL(req.url).searchParams.get("token") || "";
    if (!/^[a-f0-9]{48}$/.test(token)) return response("Invalid calendar link", 401);

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: feed, error: feedError } = await db
      .from("vendx_calendar_feeds")
      .select("user_id")
      .eq("feed_token", token)
      .maybeSingle();
    if (feedError) throw feedError;
    if (!feed) return response("Calendar link is no longer active", 404);

    const userId = feed.user_id;
    const { data: roles, error: rolesError } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", STAFF_ROLES)
      .limit(1);
    if (rolesError) throw rolesError;
    if (!roles?.length) return response("Calendar access is disabled for this account", 403);

    const [routeStopsResult, ticketsResult, schedulesResult] = await Promise.all([
      db.from("route_stops")
        .select(`id, stop_name, address, notes, estimated_duration_minutes, status, priority,
          scheduled_date, updated_at, route:service_routes!inner(name, assigned_to, status),
          location:locations(address, city), machine:vendx_machines(name, machine_code)`)
        .eq("route.assigned_to", userId)
        .not("scheduled_date", "is", null)
        .limit(1000),
      db.from("vendx_external_service_tickets")
        .select(`id, ticket_number, subject, description, access_notes, priority, status,
          scheduled_date, scheduled_time, estimated_duration_minutes, assigned_technician_id,
          route_stop_id, schedule_id, merged_into_ticket_id, updated_at,
          intake_company_name, intake_contact_name, intake_address,
          client:vendx_external_clients(company_name, contact_name),
          location:vendx_external_locations(address, city, state, postal_code),
          machine:vendx_external_machines(asset_label)`)
        .eq("assigned_technician_id", userId)
        .not("scheduled_date", "is", null)
        .limit(1000),
      db.from("vendx_external_service_schedules")
        .select(`id, subject, description, access_notes, service_package, recurrence, interval_count,
          next_run_date, end_date, active, preferred_time, estimated_duration_minutes,
          assigned_technician_id, updated_at,
          client:vendx_external_clients(company_name, contact_name),
          location:vendx_external_locations(address, city, state, postal_code)`)
        .eq("assigned_technician_id", userId)
        .eq("active", true)
        .limit(500),
    ]);

    for (const result of [routeStopsResult, ticketsResult, schedulesResult]) {
      if (result.error) throw result.error;
    }

    const calendar = buildServiceCalendar(
      userId,
      routeStopsResult.data || [],
      ticketsResult.data || [],
      schedulesResult.data || [],
    );
    await db.from("vendx_calendar_feeds").update({ last_used_at: new Date().toISOString() }).eq("user_id", userId);
    return response(calendar, 200, true);
  } catch (error) {
    console.error("Calendar feed failed:", error);
    return response("Unable to generate calendar right now", 500);
  }
});
