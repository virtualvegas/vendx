// Shared helper for signing & delivering merchant webhooks
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export async function signPayload(secret: string, timestamp: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

const RETRY_BACKOFF_MIN = [1, 5, 30, 120, 720]; // 1m, 5m, 30m, 2h, 12h

export async function deliverWebhook(
  supabase: ReturnType<typeof createClient>,
  sessionId: string,
  webhookUrl: string,
  secret: string,
  payload: Record<string, unknown>,
  attempt = 1,
): Promise<void> {
  const body = JSON.stringify(payload);
  const ts = Math.floor(Date.now() / 1000).toString();
  const sig = await signPayload(secret, ts, body);

  let statusCode: number | null = null;
  let responseBody = "";
  let err: string | null = null;

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-VendX-Timestamp": ts,
        "X-VendX-Signature": `t=${ts},v1=${sig}`,
        "User-Agent": "VendX-Webhook/1.0",
      },
      body,
    });
    statusCode = res.status;
    responseBody = (await res.text()).slice(0, 2000);
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }

  const succeeded = statusCode !== null && statusCode >= 200 && statusCode < 300;
  const nextRetry = !succeeded && attempt <= RETRY_BACKOFF_MIN.length
    ? new Date(Date.now() + RETRY_BACKOFF_MIN[attempt - 1] * 60_000).toISOString()
    : null;

  await supabase.from("vendx_merchant_webhook_deliveries").insert({
    session_id: sessionId,
    attempt,
    status_code: statusCode,
    response_body: responseBody,
    error: err,
    delivered_at: new Date().toISOString(),
    next_retry_at: nextRetry,
    succeeded,
  });
}
