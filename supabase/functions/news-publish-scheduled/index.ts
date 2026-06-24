/**
 * Cron-driven publisher: promotes scheduled articles whose time has come to
 * `published`, and triggers subscriber notifications for any that opted in.
 *
 * Invoke via pg_cron every few minutes, or manually for testing.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: due, error } = await client
      .from("news_articles")
      .select("id, notify_on_publish")
      .eq("status", "scheduled")
      .lte("scheduled_publish_at", new Date().toISOString());

    if (error) throw error;

    const promoted: string[] = [];
    for (const article of due ?? []) {
      const { error: upErr } = await client
        .from("news_articles")
        .update({ status: "published", scheduled_publish_at: null })
        .eq("id", article.id);
      if (!upErr) promoted.push(article.id);
    }

    // Fire-and-forget notifications
    for (const article of due ?? []) {
      if (promoted.includes(article.id) && article.notify_on_publish) {
        client.functions.invoke("news-notify-subscribers", { body: { article_id: article.id } }).catch(() => {});
      }
    }

    return new Response(JSON.stringify({ promoted_count: promoted.length, promoted }), {
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String((err as Error).message) }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
