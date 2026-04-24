// Public webhook for external VendX-owned sites to push income data into the finance system.
// Auth: each request must include header `X-API-Key: vxk_...` matching an active stream.
// Idempotency: same (stream, external_reference) returns duplicate=true without inserting.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface IncomePayload {
  external_reference: string;
  amount: number;
  source: string;
  entry_date?: string;
  description?: string;
  tax_collected?: number;
  currency?: string;
  category?: string;
  subcategory?: string;
  payment_method?: string;
  customer_email?: string;
  customer_name?: string;
  metadata?: Record<string, unknown>;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed. Use POST." }, 405);
  }

  // API key from header (preferred) or body (fallback)
  const apiKey = req.headers.get("x-api-key") || req.headers.get("X-API-Key");

  let payload: IncomePayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ success: false, error: "Invalid JSON body" }, 400);
  }

  const effectiveKey = apiKey || (payload as any).api_key;
  if (!effectiveKey) {
    return jsonResponse({ success: false, error: "Missing X-API-Key header" }, 401);
  }

  // Validate required fields
  if (!payload.external_reference || typeof payload.external_reference !== "string") {
    return jsonResponse({ success: false, error: "external_reference is required (string)" }, 400);
  }
  if (typeof payload.amount !== "number" || !isFinite(payload.amount) || payload.amount <= 0) {
    return jsonResponse({ success: false, error: "amount must be a positive number" }, 400);
  }
  if (!payload.source || typeof payload.source !== "string") {
    return jsonResponse({ success: false, error: "source is required (string)" }, 400);
  }

  // Length limits
  if (payload.external_reference.length > 255) {
    return jsonResponse({ success: false, error: "external_reference too long (max 255)" }, 400);
  }
  if (payload.source.length > 255) {
    return jsonResponse({ success: false, error: "source too long (max 255)" }, 400);
  }

  // Tax must be non-negative if provided
  if (payload.tax_collected !== undefined && payload.tax_collected !== null) {
    if (typeof payload.tax_collected !== "number" || !isFinite(payload.tax_collected) || payload.tax_collected < 0) {
      return jsonResponse({ success: false, error: "tax_collected must be a non-negative number" }, 400);
    }
  }

  // Date validation (optional)
  let entryDate: string | null = null;
  if (payload.entry_date) {
    const d = new Date(payload.entry_date);
    if (isNaN(d.getTime())) {
      return jsonResponse({ success: false, error: "entry_date must be a valid ISO date" }, 400);
    }
    entryDate = d.toISOString().slice(0, 10);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc("ingest_external_income", {
    p_api_key: effectiveKey,
    p_external_reference: payload.external_reference,
    p_entry_date: entryDate,
    p_source: payload.source,
    p_amount: payload.amount,
    p_description: payload.description ?? null,
    p_tax_collected: payload.tax_collected ?? 0,
    p_currency: payload.currency ?? "USD",
    p_category: payload.category ?? null,
    p_subcategory: payload.subcategory ?? null,
    p_payment_method: payload.payment_method ?? null,
    p_customer_email: payload.customer_email ?? null,
    p_customer_name: payload.customer_name ?? null,
    p_raw_payload: (payload.metadata ?? payload) as any,
  });

  if (error) {
    console.error("ingest_external_income error:", error);
    return jsonResponse({ success: false, error: "Ingest failed", details: error.message }, 500);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.success) {
    const msg = row?.message ?? "Unknown error";
    const status = msg.includes("Invalid or inactive API key") ? 401 : 400;
    return jsonResponse({ success: false, error: msg }, status);
  }

  return jsonResponse({
    success: true,
    duplicate: row.duplicate === true,
    entry_id: row.entry_id,
    message: row.message,
  });
});
