import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSEO } from "@/hooks/useSEO";

const code = (lang: string, body: string) => (
  <pre className="bg-muted/40 border border-border rounded-lg p-4 text-xs overflow-x-auto">
    <code className={`language-${lang}`}>{body}</code>
  </pre>
);

const WalletPayDocsPage = () => {
  useSEO({
    title: "VendX Wallet Pay — Developer Docs",
    description: "Integrate Pay with VendX Wallet on your site. API reference, webhook payload, and signature verification examples.",
  });

  const base = "https://xbbnodpvfvxtbffziuvr.supabase.co/functions/v1";

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 pt-24 pb-16 max-w-4xl">
        <h1 className="text-4xl font-bold mb-2">VendX Wallet Pay</h1>
        <p className="text-muted-foreground mb-8">
          Let your customers pay you directly from their VendX Wallet balance. Works like PayPal:
          create a payment session, redirect the customer, receive a signed webhook on success.
        </p>

        <Card className="mb-6">
          <CardHeader><CardTitle>1. Get your credentials</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Contact the VendX team to register your site. You'll receive:</p>
            <ul className="list-disc pl-6 text-muted-foreground">
              <li><code className="text-primary">API key</code> — <code>vxm_live_…</code> (send in <code>X-VendX-Api-Key</code> header)</li>
              <li><code className="text-primary">Webhook secret</code> — <code>whsec_…</code> (used to verify webhook signatures)</li>
              <li>Allowed return-URL domains (e.g. <code>emosrus.com</code>)</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader><CardTitle>2. Create a payment session</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <code>POST {base}/merchant-create-session</code>
            </p>
            {code("bash", `curl -X POST ${base}/merchant-create-session \\
  -H "Content-Type: application/json" \\
  -H "X-VendX-Api-Key: vxm_live_xxxxx" \\
  -d '{
    "amount": 49.99,
    "currency": "USD",
    "order_reference": "ORDER-12345",
    "description": "Black hoodie + sticker pack",
    "customer_email": "buyer@example.com",
    "return_url": "https://emosrus.com/checkout/complete",
    "cancel_url": "https://emosrus.com/checkout/cancelled",
    "webhook_url": "https://emosrus.com/api/vendx-webhook",
    "metadata": { "cart_id": "abc123" }
  }'`)}
            <p className="text-sm font-semibold mt-3">Response</p>
            {code("json", `{
  "session_token": "vxs_…",
  "checkout_url": "https://vendx.space/pay/checkout/vxs_…",
  "expires_at": "2026-05-23T20:30:00Z"
}`)}
            <p className="text-sm text-muted-foreground">
              Redirect the customer to <code>checkout_url</code>. Sessions expire after 15 minutes.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader><CardTitle>3. Customer pays</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>The customer signs in to VendX, confirms the amount, and we debit their wallet.</p>
            <p>We then:</p>
            <ul className="list-disc pl-6">
              <li>Redirect them to <code>return_url?vendx_session={"{token}"}&status=paid</code></li>
              <li>Send a signed POST to your <code>webhook_url</code></li>
            </ul>
            <p>If the customer cancels or the session expires, we redirect to <code>cancel_url</code> with <code>status=cancelled</code>.</p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader><CardTitle>4. Webhook payload</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {code("json", `{
  "event": "payment.completed",
  "session_token": "vxs_…",
  "order_reference": "ORDER-12345",
  "amount": 49.99,
  "currency": "USD",
  "paid_at": "2026-05-23T20:18:42Z",
  "customer_email": "buyer@example.com",
  "merchant_slug": "emosrus",
  "metadata": { "cart_id": "abc123" }
}`)}
            <p className="text-sm">Headers we send:</p>
            {code("text", `X-VendX-Timestamp: 1748022000
X-VendX-Signature: t=1748022000,v1=<hex hmac-sha256>`)}
            <p className="text-sm text-muted-foreground">
              The signature is <code>HMAC-SHA256(webhook_secret, "{`{timestamp}.{raw body}`}")</code>.
              Reject requests where the timestamp is more than 5 minutes old.
            </p>
            <p>Respond with any 2xx status to acknowledge. We retry on failure with backoff 1m → 5m → 30m → 2h → 12h.</p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader><CardTitle>5. Verify the signature (Node.js)</CardTitle></CardHeader>
          <CardContent>
            {code("javascript", `const crypto = require("crypto");

function verifyVendxWebhook(req, secret) {
  const header = req.headers["x-vendx-signature"] || "";
  const ts = req.headers["x-vendx-timestamp"];
  const m = header.match(/t=(\\d+),v1=([a-f0-9]+)/);
  if (!m || !ts) return false;

  // Reject replays older than 5 minutes
  if (Math.abs(Date.now()/1000 - Number(ts)) > 300) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(\`\${ts}.\${req.rawBody}\`)  // raw, unparsed body
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(m[2], "hex"),
  );
}`)}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader><CardTitle>Verify the signature (PHP)</CardTitle></CardHeader>
          <CardContent>
            {code("php", `<?php
function verifyVendxWebhook(string $rawBody, array $headers, string $secret): bool {
    $sigHeader = $headers['X-VendX-Signature'] ?? '';
    $ts = $headers['X-VendX-Timestamp'] ?? '';
    if (!preg_match('/t=(\\d+),v1=([a-f0-9]+)/', $sigHeader, $m) || !$ts) return false;
    if (abs(time() - (int)$ts) > 300) return false;
    $expected = hash_hmac('sha256', $ts . '.' . $rawBody, $secret);
    return hash_equals($expected, $m[2]);
}`)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>• Currency is USD only at launch.</p>
            <p>• Always treat the webhook — not the redirect — as the source of truth for fulfillment.</p>
            <p>• If you need a refund, contact the VendX team (refund API coming soon).</p>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
};

export default WalletPayDocsPage;
