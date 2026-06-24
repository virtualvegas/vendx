/**
 * Notify newsletter subscribers when an article publishes.
 *
 * Body: { article_id: string }
 *
 * Loads subscribers from `vendx_email_subscribers` whose category preference
 * (from `news_category_subscriptions`) includes the article's category — or
 * any subscriber who picked "All news" (category_id IS NULL).
 *
 * The actual email send uses the Resend connector if a key is present;
 * otherwise it just records `last_notified_at` and logs the count.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM = "VendX News <news@vendx.space>";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

const Body = z.object({ article_id: z.string().uuid() });

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    const { article_id } = parsed.data;
    const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: article, error: articleErr } = await client
      .from("news_articles")
      .select("id, title, slug, excerpt, featured_image, category_id, status, notify_on_publish, last_notified_at")
      .eq("id", article_id)
      .single();
    if (articleErr || !article) throw articleErr ?? new Error("not found");

    if (article.status !== "published") {
      return new Response(JSON.stringify({ skipped: "not_published" }), {
        status: 200,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    if (!article.notify_on_publish) {
      return new Response(JSON.stringify({ skipped: "opted_out" }), {
        status: 200,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // Find matching subscribers: all-news OR same-category preference
    const { data: subs } = await client
      .from("news_category_subscriptions")
      .select("subscriber_id, category_id, vendx_email_subscribers!inner(email, unsubscribed_at)")
      .or(`category_id.is.null,category_id.eq.${article.category_id ?? "00000000-0000-0000-0000-000000000000"}`);

    const recipients = Array.from(
      new Set(
        (subs ?? [])
          .filter((row: any) => row.vendx_email_subscribers?.email && !row.vendx_email_subscribers.unsubscribed_at)
          .map((row: any) => row.vendx_email_subscribers.email.toLowerCase())
      )
    );

    const link = `https://vendxglobal.net/news/${article.slug}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
        ${article.featured_image ? `<img src="${escapeHtml(article.featured_image)}" alt="" style="width:100%;border-radius:12px;margin-bottom:24px;" />` : ""}
        <h1 style="font-size: 24px; margin: 0 0 12px;">${escapeHtml(article.title)}</h1>
        ${article.excerpt ? `<p style="font-size: 16px; color:#555; line-height:1.6; margin: 0 0 24px;">${escapeHtml(article.excerpt)}</p>` : ""}
        <p>
          <a href="${link}" style="display:inline-block;background:#1A7CFF;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Read the full story →</a>
        </p>
        <p style="font-size:12px;color:#888;margin-top:32px;">You're receiving this because you subscribed to VendX news updates.</p>
      </div>`;

    let sent = 0;
    let skipped = "no_email_provider";
    if (RESEND_API_KEY && LOVABLE_API_KEY && recipients.length > 0) {
      // Send in chunks of 50 BCC recipients per call to stay within provider limits
      const chunks: string[][] = [];
      for (let i = 0; i < recipients.length; i += 50) chunks.push(recipients.slice(i, i + 50));
      for (const chunk of chunks) {
        const r = await fetch(`${GATEWAY_URL}/emails`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": RESEND_API_KEY,
          },
          body: JSON.stringify({
            from: FROM,
            to: [FROM],
            bcc: chunk,
            subject: article.title,
            html,
          }),
        });
        if (r.ok) sent += chunk.length;
      }
      skipped = "";
    }

    await client.from("news_articles").update({ last_notified_at: new Date().toISOString() }).eq("id", article.id);

    return new Response(
      JSON.stringify({ recipients: recipients.length, sent, skipped: skipped || undefined }),
      { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String((err as Error).message) }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
