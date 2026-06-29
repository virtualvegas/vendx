import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, RefreshCw, Copy, Send, Globe, Trash2, BookOpen } from "lucide-react";

type Partner = {
  id: string;
  name: string;
  slug: string;
  contact_email: string | null;
  website_url: string | null;
  api_key_prefix: string;
  mode: string;
  commission_pct: number;
  allowed_outbound_categories: string[];
  inbound_fulfillment_url: string | null;
  is_active: boolean;
  created_at: string;
};

type PartnerOrder = {
  id: string;
  partner_id: string;
  direction: string;
  external_order_id: string | null;
  total: number;
  currency: string;
  status: string;
  payment_status: string | null;
  fulfillment_status: string | null;
  commission_amount: number;
  created_at: string;
  partner?: { name: string };
};

type PartnerProduct = {
  id: string;
  partner_id: string;
  name: string;
  external_product_id: string;
  price: number;
  category: string | null;
  is_active: boolean;
  is_subscription: boolean;
  last_synced_at: string;
  partner?: { name: string };
};

type WebhookDelivery = {
  id: string;
  partner_id: string;
  event: string;
  url: string;
  status_code: number | null;
  delivered: boolean;
  attempt: number;
  created_at: string;
  partner_order_id: string | null;
};

export default function PartnerApiManager() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [orders, setOrders] = useState<PartnerOrder[]>([]);
  const [products, setProducts] = useState<PartnerProduct[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newSecrets, setNewSecrets] = useState<{ api_key: string; webhook_secret: string } | null>(null);

  const [form, setForm] = useState({
    name: "",
    slug: "",
    contact_email: "",
    website_url: "",
    mode: "both",
    commission_pct: 0,
    allowed_outbound_categories: "",
    inbound_fulfillment_url: "",
  });

  const loadAll = async () => {
    setLoading(true);
    const [{ data: p }, { data: o }, { data: pr }, { data: d }] = await Promise.all([
      supabase.from("vendx_catalog_partners").select("*").order("created_at", { ascending: false }),
      supabase
        .from("vendx_partner_orders")
        .select("*, partner:vendx_catalog_partners(name)")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("vendx_partner_products")
        .select("*, partner:vendx_catalog_partners(name)")
        .order("last_synced_at", { ascending: false })
        .limit(100),
      supabase
        .from("vendx_partner_webhook_deliveries")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    setPartners((p as Partner[]) || []);
    setOrders((o as PartnerOrder[]) || []);
    setProducts((pr as PartnerProduct[]) || []);
    setDeliveries((d as WebhookDelivery[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const create = async () => {
    if (!form.name || !form.slug) {
      toast.error("Name and slug required");
      return;
    }
    const { data, error } = await supabase.rpc("create_vendx_catalog_partner", {
      p_name: form.name,
      p_slug: form.slug,
      p_contact_email: form.contact_email || null,
      p_website_url: form.website_url || null,
      p_mode: form.mode,
      p_commission_pct: form.commission_pct,
      p_allowed_outbound_categories: form.allowed_outbound_categories
        ? form.allowed_outbound_categories.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      p_inbound_fulfillment_url: form.inbound_fulfillment_url || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    const row = Array.isArray(data) ? data[0] : (data as any);
    setNewSecrets({ api_key: row.api_key, webhook_secret: row.webhook_secret });
    setCreateOpen(false);
    setForm({
      name: "",
      slug: "",
      contact_email: "",
      website_url: "",
      mode: "both",
      commission_pct: 0,
      allowed_outbound_categories: "",
      inbound_fulfillment_url: "",
    });
    loadAll();
  };

  const rotate = async (id: string) => {
    if (!confirm("Rotate API key? The old key stops working immediately.")) return;
    const { data, error } = await supabase.rpc("rotate_vendx_catalog_partner_api_key", { p_partner_id: id });
    if (error) return toast.error(error.message);
    setNewSecrets({ api_key: data as string, webhook_secret: "(unchanged)" });
  };

  const toggleActive = async (p: Partner) => {
    await supabase.from("vendx_catalog_partners").update({ is_active: !p.is_active }).eq("id", p.id);
    loadAll();
  };

  const removePartner = async (id: string) => {
    if (!confirm("Delete partner and all linked products/orders?")) return;
    await supabase.from("vendx_catalog_partners").delete().eq("id", id);
    loadAll();
  };

  const redeliver = async (partnerOrderId: string) => {
    const { data, error } = await supabase.functions.invoke("partner-fulfillment-dispatch", {
      body: { partner_order_id: partnerOrderId },
    });
    if (error) return toast.error(error.message);
    toast.success(`Webhook ${(data as any)?.ok ? "delivered" : "failed"} (status ${(data as any)?.status})`);
    loadAll();
  };

  const copy = (s: string) => {
    navigator.clipboard.writeText(s);
    toast.success("Copied");
  };

  const totalOutbound = orders.filter((o) => o.direction === "outbound").reduce((s, o) => s + Number(o.total), 0);
  const totalInbound = orders.filter((o) => o.direction === "inbound").reduce((s, o) => s + Number(o.total), 0);
  const totalCommission = orders.reduce((s, o) => s + Number(o.commission_amount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="h-6 w-6" /> Partner API
          </h2>
          <p className="text-sm text-muted-foreground">
            External product/order sync with partner websites.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href="/api/partners" target="_blank" rel="noreferrer">
              <BookOpen className="h-4 w-4 mr-2" />
              View Docs
            </a>
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Partner
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Partners</div><div className="text-2xl font-bold">{partners.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Outbound Revenue</div><div className="text-2xl font-bold">${totalOutbound.toFixed(2)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Inbound Revenue</div><div className="text-2xl font-bold">${totalInbound.toFixed(2)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Commissions Owed</div><div className="text-2xl font-bold">${totalCommission.toFixed(2)}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="partners">
        <TabsList>
          <TabsTrigger value="partners">Partners</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="products">Inbound Products</TabsTrigger>
          <TabsTrigger value="webhooks">Webhook Log</TabsTrigger>
        </TabsList>

        <TabsContent value="partners">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Key prefix</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && <TableRow><TableCell colSpan={6}>Loading…</TableCell></TableRow>}
                  {!loading && partners.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No partners yet.</TableCell></TableRow>}
                  {partners.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">/{p.slug}</div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{p.mode}</Badge></TableCell>
                      <TableCell><code className="text-xs">{p.api_key_prefix}…</code></TableCell>
                      <TableCell>{Number(p.commission_pct).toFixed(2)}%</TableCell>
                      <TableCell>
                        <Badge variant={p.is_active ? "default" : "secondary"}>
                          {p.is_active ? "Active" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => rotate(p.id)} title="Rotate key">
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => toggleActive(p)}>
                          {p.is_active ? "Disable" : "Enable"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => removePartner(p.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Partner</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>External ID</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Fulfillment</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">No orders yet.</TableCell></TableRow>}
                  {orders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>{o.partner?.name}</TableCell>
                      <TableCell><Badge variant="outline">{o.direction}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{o.external_order_id || "—"}</TableCell>
                      <TableCell>${Number(o.total).toFixed(2)} {o.currency}</TableCell>
                      <TableCell>${Number(o.commission_amount || 0).toFixed(2)}</TableCell>
                      <TableCell>{o.fulfillment_status || o.status}</TableCell>
                      <TableCell className="text-xs">{new Date(o.created_at).toLocaleString()}</TableCell>
                      <TableCell>
                        {o.direction === "inbound" && (
                          <Button size="sm" variant="ghost" onClick={() => redeliver(o.id)} title="Re-dispatch">
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Partner</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>External ID</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Synced</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No partner products yet.</TableCell></TableRow>}
                  {products.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.partner?.name}</TableCell>
                      <TableCell>{p.name}{p.is_subscription && <Badge className="ml-2" variant="outline">sub</Badge>}</TableCell>
                      <TableCell className="font-mono text-xs">{p.external_product_id}</TableCell>
                      <TableCell>${Number(p.price).toFixed(2)}</TableCell>
                      <TableCell>{p.category || "—"}</TableCell>
                      <TableCell>{p.is_active ? "Yes" : "No"}</TableCell>
                      <TableCell className="text-xs">{new Date(p.last_synced_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Attempt</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No webhook deliveries yet.</TableCell></TableRow>}
                  {deliveries.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell><Badge variant="outline">{d.event}</Badge></TableCell>
                      <TableCell className="font-mono text-xs max-w-xs truncate">{d.url}</TableCell>
                      <TableCell>
                        <Badge variant={d.delivered ? "default" : "destructive"}>
                          {d.status_code || "—"} {d.delivered ? "OK" : "fail"}
                        </Badge>
                      </TableCell>
                      <TableCell>{d.attempt}</TableCell>
                      <TableCell className="text-xs">{new Date(d.created_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Partner</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Contact email</Label><Input value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></div>
              <div><Label>Website</Label><Input value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Mode</Label>
                <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outbound">Outbound (they sell ours)</SelectItem>
                    <SelectItem value="inbound">Inbound (we sell theirs)</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Commission %</Label><Input type="number" step="0.01" value={form.commission_pct} onChange={(e) => setForm({ ...form, commission_pct: Number(e.target.value) })} /></div>
            </div>
            <div>
              <Label>Allowed categories (comma-separated, blank = all)</Label>
              <Input value={form.allowed_outbound_categories} onChange={(e) => setForm({ ...form, allowed_outbound_categories: e.target.value })} placeholder="snacks, arcade, merch" />
            </div>
            <div>
              <Label>Inbound fulfillment URL (for inbound mode)</Label>
              <Input value={form.inbound_fulfillment_url} onChange={(e) => setForm({ ...form, inbound_fulfillment_url: e.target.value })} placeholder="https://partner.com/webhooks/vendx" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={create}>Create Partner</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!newSecrets} onOpenChange={() => setNewSecrets(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Save these credentials</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Shown only once. The partner needs both to integrate.</p>
          <div className="space-y-2">
            <div>
              <Label>API Key</Label>
              <div className="flex gap-2">
                <Textarea readOnly value={newSecrets?.api_key} rows={2} className="font-mono text-xs" />
                <Button size="sm" variant="outline" onClick={() => copy(newSecrets!.api_key)}><Copy className="h-4 w-4" /></Button>
              </div>
            </div>
            <div>
              <Label>Webhook Secret</Label>
              <div className="flex gap-2">
                <Textarea readOnly value={newSecrets?.webhook_secret} rows={2} className="font-mono text-xs" />
                <Button size="sm" variant="outline" onClick={() => copy(newSecrets!.webhook_secret)}><Copy className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={() => setNewSecrets(null)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
