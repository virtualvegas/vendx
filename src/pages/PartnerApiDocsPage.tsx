import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSEO } from "@/hooks/useSEO";

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="bg-card border border-border rounded-lg p-4 overflow-x-auto text-xs font-mono whitespace-pre">
      <code>{children}</code>
    </pre>
  );
}

function Endpoint({
  method,
  path,
  title,
  desc,
  example,
}: {
  method: string;
  path: string;
  title: string;
  desc: string;
  example: string;
}) {
  const color =
    method === "GET" ? "bg-emerald-500/20 text-emerald-400" :
    method === "DELETE" ? "bg-destructive/20 text-destructive" :
    "bg-blue-500/20 text-blue-400";
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-base">
          <Badge className={color}>{method}</Badge>
          <code className="text-sm">{path}</code>
        </CardTitle>
        <div className="text-sm font-medium pt-1">{title}</div>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </CardHeader>
      <CardContent><Code>{example}</Code></CardContent>
    </Card>
  );
}

export default function PartnerApiDocsPage() {
  useSEO({
    title: "VendX Partner API Documentation",
    description: "Integrate your site with VendX: sell our products on yours, or push your catalog to VendX.",
  });

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 pt-24 pb-16 max-w-4xl">
        <h1 className="text-4xl font-bold mb-2">Partner API</h1>
        <p className="text-muted-foreground mb-8">
          Bidirectional product, service & subscription integration between VendX Global and partner sites.
        </p>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-3">How it works</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <Card><CardContent className="p-5">
              <Badge className="mb-2 bg-emerald-500/20 text-emerald-400">Outbound</Badge>
              <h3 className="font-semibold mb-1">Sell VendX products on your site</h3>
              <p className="text-sm text-muted-foreground">
                Pull our products from the catalog API, display & price them on your site,
                collect payment on your side, then POST the completed order to VendX.
                We fulfill it. You earn the configured commission.
              </p>
            </CardContent></Card>
            <Card><CardContent className="p-5">
              <Badge className="mb-2 bg-blue-500/20 text-blue-400">Inbound</Badge>
              <h3 className="font-semibold mb-1">Sell your products on VendX</h3>
              <p className="text-sm text-muted-foreground">
                Push your products into our store via the product API. When a VendX
                customer orders, we collect payment, send you a signed webhook with the
                order, and your system fulfills.
              </p>
            </CardContent></Card>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-3">Authentication</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Every request includes your API key:
          </p>
          <Code>{`X-VendX-Partner-Key: vxp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`}</Code>
          <p className="text-sm text-muted-foreground mt-3">
            Keys are issued by VendX. Rotate from your account contact or the admin panel.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-3">Webhook signatures</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Outgoing webhooks include an HMAC-SHA256 signature in <code>X-VendX-Signature</code>,
            computed over the raw JSON body using your webhook secret. Verify it like this:
          </p>
          <Code>{`import crypto from "crypto";
const expected = crypto
  .createHmac("sha256", process.env.VENDX_WEBHOOK_SECRET)
  .update(rawBody)
  .digest("hex");
if (expected !== req.headers["x-vendx-signature"]) {
  return res.status(401).end();
}`}</Code>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-3">Outbound endpoints</h2>

          <Endpoint
            method="GET"
            path={`${BASE}/partner-catalog-list?limit=50&offset=0`}
            title="List VendX products"
            desc="Returns active products restricted to your allowed categories. Supports pagination + category and subscription filters."
            example={`curl "${BASE}/partner-catalog-list?limit=20" \\
  -H "X-VendX-Partner-Key: $VENDX_KEY"`}
          />

          <Endpoint
            method="GET"
            path={`${BASE}/partner-catalog-product?slug=snack-box`}
            title="Get a single product"
            desc="Fetch by id or slug."
            example={`curl "${BASE}/partner-catalog-product?slug=snack-box" \\
  -H "X-VendX-Partner-Key: $VENDX_KEY"`}
          />

          <Endpoint
            method="POST"
            path={`${BASE}/partner-order-create`}
            title="Forward a paid order to VendX"
            desc="Call this after the customer has paid on your site. Idempotent on external_order_id."
            example={`curl -X POST "${BASE}/partner-order-create" \\
  -H "X-VendX-Partner-Key: $VENDX_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "external_order_id": "ORD-9821",
    "customer_email": "buyer@example.com",
    "customer_name": "Jane Buyer",
    "items": [
      { "product_id": "uuid-from-catalog", "name": "Snack Box", "quantity": 1, "unit_price": 24.99 }
    ],
    "subtotal": 24.99,
    "total": 24.99,
    "currency": "USD",
    "payment_status": "paid",
    "payment_reference": "stripe_pi_xxx",
    "shipping_address": { "name": "Jane", "street": "...", "city": "...", "zip": "..." }
  }'`}
          />

          <Endpoint
            method="GET"
            path={`${BASE}/partner-order-status?external_order_id=ORD-9821`}
            title="Check fulfillment status"
            desc="Lookup an order you forwarded to us."
            example={`curl "${BASE}/partner-order-status?external_order_id=ORD-9821" \\
  -H "X-VendX-Partner-Key: $VENDX_KEY"`}
          />
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-3">Inbound endpoints</h2>

          <Endpoint
            method="POST"
            path={`${BASE}/partner-product-push`}
            title="Push (upsert) one or many products"
            desc="Send a single product object or { products: [...] }. Upserts by external_product_id."
            example={`curl -X POST "${BASE}/partner-product-push" \\
  -H "X-VendX-Partner-Key: $VENDX_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "products": [
      {
        "external_product_id": "SKU-001",
        "name": "Cool T-Shirt",
        "description": "100% cotton",
        "price": 29.99,
        "currency": "USD",
        "images": ["https://partner.com/tee.jpg"],
        "category": "merch",
        "stock": 50,
        "is_subscription": false,
        "product_url": "https://partner.com/p/SKU-001"
      }
    ]
  }'`}
          />

          <Endpoint
            method="DELETE"
            path={`${BASE}/partner-product-delete?external_product_id=SKU-001`}
            title="Remove a product from VendX"
            desc="Removes the listing on our storefront."
            example={`curl -X DELETE "${BASE}/partner-product-delete?external_product_id=SKU-001" \\
  -H "X-VendX-Partner-Key: $VENDX_KEY"`}
          />
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-3">Inbound order webhook</h2>
          <p className="text-sm text-muted-foreground mb-3">
            When a VendX customer buys one of your products, we POST to your{" "}
            <code>inbound_fulfillment_url</code> with the signed payload:
          </p>
          <Code>{`POST https://your-site.com/webhooks/vendx
Headers:
  Content-Type: application/json
  X-VendX-Signature: <hmac-sha256 hex>
  X-VendX-Event: order.created

Body:
{
  "event": "order.created",
  "partner_order_id": "uuid",
  "vendx_order_id": "uuid",
  "external_order_id": null,
  "customer_email": "shopper@example.com",
  "customer_name": "Sam Shopper",
  "items": [
    { "external_product_id": "SKU-001", "quantity": 1, "unit_price": 29.99 }
  ],
  "total": 29.99,
  "currency": "USD",
  "created_at": "2026-06-29T16:30:00Z"
}`}</Code>
          <p className="text-sm text-muted-foreground mt-3">
            Respond with 2xx to acknowledge. Non-2xx responses are retried with backoff.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-3">Need a key?</h2>
          <p className="text-sm text-muted-foreground">
            Email <a className="text-primary underline" href="mailto:partners@vendx.space">partners@vendx.space</a>{" "}
            with your company name, site URL, and intended integration mode.
          </p>
        </section>
      </div>
      <Footer />
    </div>
  );
}
