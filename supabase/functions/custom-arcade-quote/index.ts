import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f-]{36}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { action, token, response, note } = await req.json();
    if (typeof token !== "string" || !UUID.test(token)) return json({ error: "Invalid link" }, 400);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (action === "respond") {
      if (!["accepted", "changes_requested", "declined"].includes(response)) return json({ error: "Invalid response" }, 400);
      const status = response === "accepted" ? "accepted" : response === "declined" ? "declined" : "reviewing";
      const { data, error } = await db.from("vendx_custom_arcade_requests")
        .update({ customer_response: response, customer_response_note: typeof note === "string" ? note.slice(0, 2000) : null, customer_responded_at: new Date().toISOString(), status })
        .eq("access_token", token).not("quote_sent_at", "is", null).select("id").maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "No quote to respond to yet" }, 404);
      return json({ success: true });
    }

    const { data: r, error } = await db.from("vendx_custom_arcade_requests")
      .select("request_number, full_name, status, cabinet_style, cabinet_size, created_at, quoted_price, concept_image_path, quote_message, quote_sent_at, customer_response, customer_responded_at")
      .eq("access_token", token).maybeSingle();
    if (error) throw error;
    if (!r) return json({ error: "Request not found" }, 404);
    const sent = !!r.quote_sent_at;
    let image_url: string | null = null;
    if (sent && r.concept_image_path) {
      const { data } = await db.storage.from("custom-arcade-concepts").createSignedUrl(r.concept_image_path, 60 * 60 * 24 * 7);
      image_url = data?.signedUrl ?? null;
    }
    return json({
      request: {
        request_number: r.request_number, full_name: r.full_name, status: r.status,
        cabinet_style: r.cabinet_style, cabinet_size: r.cabinet_size, created_at: r.created_at,
        quoted_price: sent ? r.quoted_price : null, quote_message: sent ? r.quote_message : null,
        quote_sent_at: r.quote_sent_at, customer_response: r.customer_response,
        customer_responded_at: r.customer_responded_at, image_url,
      },
    });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Error" }, 500);
  }
});
