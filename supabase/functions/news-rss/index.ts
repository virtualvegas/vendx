/**
 * Public RSS 2.0 feed for VendX news. Cached at the edge for 5 minutes.
 * GET /functions/v1/news-rss
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = "https://vendxglobal.net";
const FEED_TITLE = "VendX Global — News";
const FEED_DESC = "Latest announcements, releases, and stories from the VendX ecosystem.";

const escapeXml = (input: string) =>
  input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

Deno.serve(async (req) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }
  try {
    const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await client
      .from("news_articles")
      .select("title, slug, excerpt, published_at, updated_at, featured_image, tags, news_categories(name)")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    const items = (data ?? [])
      .map((row: any) => {
        const link = `${SITE_URL}/news/${row.slug}`;
        const pubDate = new Date(row.published_at ?? row.updated_at ?? Date.now()).toUTCString();
        const category = row.news_categories?.name;
        const tagsXml = (row.tags ?? [])
          .map((t: string) => `      <category>${escapeXml(t)}</category>`)
          .join("\n");
        const enclosure = row.featured_image
          ? `      <enclosure url="${escapeXml(row.featured_image)}" type="image/jpeg" length="0"/>`
          : "";
        return [
          "    <item>",
          `      <title>${escapeXml(row.title)}</title>`,
          `      <link>${link}</link>`,
          `      <guid isPermaLink="true">${link}</guid>`,
          `      <pubDate>${pubDate}</pubDate>`,
          row.excerpt ? `      <description>${escapeXml(row.excerpt)}</description>` : "",
          category ? `      <category>${escapeXml(category)}</category>` : "",
          tagsXml,
          enclosure,
          "    </item>",
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n");

    const lastBuild = data?.[0]?.published_at
      ? new Date(data[0].published_at).toUTCString()
      : new Date().toUTCString();

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(FEED_TITLE)}</title>
    <link>${SITE_URL}/news</link>
    <description>${escapeXml(FEED_DESC)}</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <atom:link href="${SITE_URL}/functions/v1/news-rss" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

    return new Response(xml, {
      status: 200,
      headers: {
        "content-type": "application/rss+xml; charset=utf-8",
        "cache-control": "public, max-age=300",
        "access-control-allow-origin": "*",
      },
    });
  } catch (err) {
    return new Response(`Feed error: ${String((err as Error).message)}`, { status: 500 });
  }
});
