import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const esc = (v: string) =>
  v.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug") || url.pathname.split("/").pop();
    if (!slug) {
      return new Response("Missing slug", { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase.rpc("get_business_card", { _slug: slug });
    if (error || !data) {
      return new Response("Card not found", { status: 404, headers: corsHeaders });
    }

    const c = data as Record<string, any>;
    const company = c.company_name || "VendX Global Corporation";

    const name = String(c.full_name || "").trim();
    const parts = name.split(/\s+/);
    const last = parts.length > 1 ? parts.pop()! : "";
    const first = parts.join(" ");

    // Only name, phone, email, company and title.
    const lines = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `N:${esc(last)};${esc(first)};;;`,
      `FN:${esc(name)}`,
      `ORG:${esc(company)}`,
      c.job_title ? `TITLE:${esc(String(c.job_title))}` : "",
      c.phone ? `TEL;TYPE=CELL:${c.phone}` : "",
      c.email ? `EMAIL;TYPE=INTERNET:${c.email}` : "",
      "END:VCARD",
    ].filter(Boolean);

    const fileName = `${(name || "contact").replace(/\s+/g, "_")}.vcf`;

    return new Response(lines.join("\r\n"), {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/vcard; charset=utf-8",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (e) {
    return new Response("Error generating contact card", { status: 500, headers: corsHeaders });
  }
});
