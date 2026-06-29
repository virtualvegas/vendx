import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ExternalLink, Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { useSEO } from "@/hooks/useSEO";

type PartnerProduct = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  price: number;
  currency: string;
  category: string | null;
  stock: number | null;
  images: string[] | null;
  image_url: string | null;
  is_subscription: boolean;
  subscription_interval: string | null;
  product_url: string | null;
  partner_id: string;
  external_product_id: string;
  vendx_catalog_partners: { name: string; slug: string; website_url: string | null; checkout_url_template: string | null } | null;
};

export default function PartnerProductPage() {
  const { id } = useParams();
  const [product, setProduct] = useState<PartnerProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", quantity: 1, notes: "" });

  useSEO({
    title: product?.name,
    description: product?.short_description || product?.description?.slice(0, 160),
    image: product?.images?.[0] || product?.image_url || undefined,
  });

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase
        .from("vendx_partner_products")
        .select("*, vendx_catalog_partners(name, slug, website_url)")
        .eq("id", id)
        .eq("is_active", true)
        .maybeSingle();
      setProduct(data as any);
      setLoading(false);
    })();
  }, [id]);

  const placeOrder = async () => {
    if (!product) return;
    if (!form.email || !form.name) {
      toast.error("Name and email required");
      return;
    }
    setSubmitting(true);
    const total = product.price * form.quantity;
    try {
      const { data: po, error: poErr } = await supabase
        .from("vendx_partner_orders")
        .insert({
          partner_id: product.partner_id,
          direction: "inbound",
          customer_email: form.email,
          customer_name: form.name,
          items: [{
            external_product_id: product.external_product_id,
            name: product.name,
            quantity: form.quantity,
            unit_price: product.price,
          }],
          subtotal: total,
          total,
          currency: product.currency || "USD",
          status: "pending",
          payload: { notes: form.notes },
        })
        .select()
        .single();
      if (poErr) throw poErr;

      const { data: dispatch } = await supabase.functions.invoke("partner-fulfillment-dispatch", {
        body: { partner_order_id: po.id },
      });
      if ((dispatch as any)?.ok) {
        toast.success(`Order placed — ${product.vendx_catalog_partners?.name} will be in touch.`);
      } else {
        toast.success("Order placed. We'll contact you shortly.");
      }
      setForm({ name: "", email: "", quantity: 1, notes: "" });
    } catch (e: any) {
      toast.error(e.message || "Failed to place order");
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 pt-24 pb-12 text-center">
          <Loader2 className="h-8 w-8 mx-auto animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 pt-24 pb-12 text-center">
          <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Product Not Found</h1>
          <Link to="/store"><Button><ArrowLeft className="h-4 w-4 mr-2" />Back to Store</Button></Link>
        </div>
        <Footer />
      </div>
    );
  }

  const partnerName = product.vendx_catalog_partners?.name || "Partner";
  const img = product.images?.[0] || product.image_url || "https://via.placeholder.com/600";

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 pt-24 pb-12 max-w-5xl">
        <Link to="/store" className="text-primary hover:underline flex items-center gap-2 mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Store
        </Link>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="aspect-square rounded-xl overflow-hidden bg-card border border-border">
            <img src={img} alt={product.name} className="w-full h-full object-cover" />
          </div>

          <div>
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge variant="outline" className="capitalize">{product.category || "Partner"}</Badge>
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                Fulfilled by {partnerName}
              </Badge>
              {product.is_subscription && <Badge className="bg-accent text-accent-foreground">Subscription</Badge>}
            </div>

            <h1 className="text-3xl font-bold mb-3">{product.name}</h1>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-3xl font-bold text-primary">${Number(product.price).toFixed(2)}</span>
              {product.is_subscription && <span className="text-muted-foreground">/{product.subscription_interval || "month"}</span>}
            </div>

            <p className="text-muted-foreground mb-6">{product.description || product.short_description}</p>

            {product.product_url && (
              <Button variant="outline" className="mb-6 w-full" asChild>
                <a href={product.product_url} target="_blank" rel="noreferrer">
                  View on {partnerName} <ExternalLink className="h-4 w-4 ml-2" />
                </a>
              </Button>
            )}

            <Card>
              <CardContent className="p-5 space-y-3">
                <h3 className="font-semibold">Order from {partnerName}</h3>
                <p className="text-xs text-muted-foreground">
                  Your order is forwarded to {partnerName} who will fulfill and contact you to complete payment & shipping.
                </p>
                <div>
                  <Label>Full name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Math.max(1, parseInt(e.target.value) || 1) })} />
                </div>
                <div>
                  <Label>Notes (optional)</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
                </div>
                <Button className="w-full" onClick={placeOrder} disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Place Order (${(product.price * form.quantity).toFixed(2)})
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
