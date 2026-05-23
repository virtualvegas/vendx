import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, RefreshCw, Copy, Eye, EyeOff, Send, Globe, Key } from "lucide-react";

type Merchant = {
  id: string;
  name: string;
  slug: string;
  api_key_prefix: string;
  webhook_secret: string;
  allowed_return_domains: string[];
  logo_url: string | null;
  is_active: boolean;
  contact_email: string | null;
  created_at: string;
};

type Session = {
  id: string;
  session_token: string;
  amount: number;
  currency: string;
  order_reference: string | null;
  status: string;
  created_at: string;
  paid_at: string | null;
  webhook_url: string | null;
  customer_email: string | null;
  merchant: { name: string } | null;
};

type Delivery = {
  id: string;
  attempt: number;
  status_code: number | null;
  succeeded: boolean;
  error: string | null;
  delivered_at: string;
};

const MerchantApiManager = () => {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createSlug, setCreateSlug] = useState("");
  const [createDomains, setCreateDomains] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createLogo, setCreateLogo] = useState("");
  const [createBusy, setCreateBusy] = useState(false);

  // Credential reveal dialog
  const [revealOpen, setRevealOpen] = useState(false);
  const [revealKey, setRevealKey] = useState<{ apiKey?: string; webhookSecret?: string; merchantName?: string }>({});

  // Edit merchant
  const [editing, setEditing] = useState<Merchant | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  // Deliveries dialog
  const [deliveriesFor, setDeliveriesFor] = useState<Session | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);

  const load = async () => {
    setLoading(true);
    const [{ data: m }, { data: s }] = await Promise.all([
      supabase.from("vendx_merchants").select("*").order("created_at", { ascending: false }),
      supabase
        .from("vendx_merchant_payment_sessions")
        .select("*, merchant:vendx_merchants(name)")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    setMerchants((m as Merchant[]) || []);
    setSessions((s as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!createName.trim() || !createSlug.trim()) {
      toast.error("Name and slug are required");
      return;
    }
    setCreateBusy(true);
    const domains = createDomains.split(",").map(d => d.trim()).filter(Boolean);
    const { data, error } = await supabase.rpc("create_vendx_merchant", {
      p_name: createName.trim(),
      p_slug: createSlug.trim().toLowerCase(),
      p_allowed_return_domains: domains,
      p_logo_url: createLogo.trim() || null,
      p_contact_email: createEmail.trim() || null,
    });
    setCreateBusy(false);
    if (error) { toast.error(error.message); return; }
    const row = Array.isArray(data) ? data[0] : data;
    setRevealKey({
      apiKey: row.api_key,
      webhookSecret: row.webhook_secret,
      merchantName: createName.trim(),
    });
    setRevealOpen(true);
    setCreateOpen(false);
    setCreateName(""); setCreateSlug(""); setCreateDomains(""); setCreateEmail(""); setCreateLogo("");
    await load();
  };

  const rotateKey = async (id: string, name: string) => {
    if (!confirm(`Rotate API key for ${name}? The current key will stop working immediately.`)) return;
    const { data, error } = await supabase.rpc("rotate_vendx_merchant_api_key", { p_merchant_id: id });
    if (error) { toast.error(error.message); return; }
    setRevealKey({ apiKey: data as string, merchantName: name });
    setRevealOpen(true);
    await load();
  };

  const rotateSecret = async (id: string, name: string) => {
    if (!confirm(`Rotate webhook secret for ${name}? Existing webhook verifiers will fail until updated.`)) return;
    const { data, error } = await supabase.rpc("rotate_vendx_merchant_webhook_secret", { p_merchant_id: id });
    if (error) { toast.error(error.message); return; }
    setRevealKey({ webhookSecret: data as string, merchantName: name });
    setRevealOpen(true);
    await load();
  };

  const updateMerchant = async () => {
    if (!editing) return;
    const { error } = await supabase
      .from("vendx_merchants")
      .update({
        name: editing.name,
        allowed_return_domains: editing.allowed_return_domains,
        logo_url: editing.logo_url,
        contact_email: editing.contact_email,
        is_active: editing.is_active,
      })
      .eq("id", editing.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    setEditing(null);
    await load();
  };

  const copy = (val: string) => {
    navigator.clipboard.writeText(val);
    toast.success("Copied");
  };

  const openDeliveries = async (s: Session) => {
    setDeliveriesFor(s);
    const { data } = await supabase
      .from("vendx_merchant_webhook_deliveries")
      .select("*")
      .eq("session_id", s.id)
      .order("created_at", { ascending: false });
    setDeliveries((data as Delivery[]) || []);
  };

  const redeliver = async (s: Session) => {
    const { error } = await supabase.functions.invoke("merchant-webhook-redeliver", {
      body: { session_id: s.id },
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Redelivery sent");
      await openDeliveries(s);
    }
  };

  const statusColor = (s: string) => ({
    pending: "secondary", paid: "default", cancelled: "outline",
    expired: "outline", failed: "destructive",
  }[s] || "outline") as any;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Merchant API (Wallet Pay)</h2>
          <p className="text-sm text-muted-foreground">
            Manage external sites that accept VendX Wallet payments.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.open("/docs/wallet-pay", "_blank")}>
            <Globe className="h-4 w-4 mr-2" /> Docs
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> New Merchant
          </Button>
        </div>
      </div>

      <Tabs defaultValue="merchants">
        <TabsList>
          <TabsTrigger value="merchants">Merchants</TabsTrigger>
          <TabsTrigger value="sessions">Recent Sessions</TabsTrigger>
        </TabsList>

        <TabsContent value="merchants">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>API key</TableHead>
                    <TableHead>Allowed domains</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                  ) : merchants.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No merchants yet.</TableCell></TableRow>
                  ) : merchants.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell><code className="text-xs">{m.slug}</code></TableCell>
                      <TableCell><code className="text-xs">{m.api_key_prefix}…</code></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {(m.allowed_return_domains || []).join(", ") || <span className="italic">any</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={m.is_active ? "default" : "outline"}>
                          {m.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => setEditing(m)}>Edit</Button>
                          <Button size="sm" variant="outline" onClick={() => rotateKey(m.id, m.name)}>
                            <Key className="h-3 w-3 mr-1" /> Key
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => rotateSecret(m.id, m.name)}>
                            <RefreshCw className="h-3 w-3 mr-1" /> Secret
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Created</TableHead>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Order ref</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Webhook</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No sessions yet.</TableCell></TableRow>
                  ) : sessions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-xs">{new Date(s.created_at).toLocaleString()}</TableCell>
                      <TableCell>{s.merchant?.name || "—"}</TableCell>
                      <TableCell className="text-xs">{s.order_reference || "—"}</TableCell>
                      <TableCell>${Number(s.amount).toFixed(2)} {s.currency}</TableCell>
                      <TableCell><Badge variant={statusColor(s.status)}>{s.status}</Badge></TableCell>
                      <TableCell className="text-xs">{s.customer_email || "—"}</TableCell>
                      <TableCell>
                        {s.webhook_url ? (
                          <Button size="sm" variant="outline" onClick={() => openDeliveries(s)}>
                            <Send className="h-3 w-3 mr-1" /> Logs
                          </Button>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Merchant</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name *</Label>
              <Input value={createName} onChange={e => setCreateName(e.target.value)} placeholder="Emos R Us" />
            </div>
            <div>
              <Label>Slug *</Label>
              <Input value={createSlug} onChange={e => setCreateSlug(e.target.value)} placeholder="emosrus" />
            </div>
            <div>
              <Label>Allowed return domains (comma separated)</Label>
              <Input value={createDomains} onChange={e => setCreateDomains(e.target.value)} placeholder="emosrus.com, www.emosrus.com" />
            </div>
            <div>
              <Label>Contact email</Label>
              <Input value={createEmail} onChange={e => setCreateEmail(e.target.value)} placeholder="ops@emosrus.com" />
            </div>
            <div>
              <Label>Logo URL</Label>
              <Input value={createLogo} onChange={e => setCreateLogo(e.target.value)} placeholder="https://..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createBusy}>
              {createBusy ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reveal dialog */}
      <Dialog open={revealOpen} onOpenChange={setRevealOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{revealKey.merchantName} — credentials</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-destructive font-medium">
              Copy these now — they won't be shown again.
            </p>
            {revealKey.apiKey && (
              <div>
                <Label>API Key</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={revealKey.apiKey} readOnly className="font-mono text-xs" />
                  <Button size="icon" variant="outline" onClick={() => copy(revealKey.apiKey!)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            {revealKey.webhookSecret && (
              <div>
                <Label>Webhook Secret</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={revealKey.webhookSecret} readOnly className="font-mono text-xs" />
                  <Button size="icon" variant="outline" onClick={() => copy(revealKey.webhookSecret!)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setRevealOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit merchant</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <Label>Allowed domains (comma separated)</Label>
                <Input
                  value={editing.allowed_return_domains.join(", ")}
                  onChange={e => setEditing({
                    ...editing,
                    allowed_return_domains: e.target.value.split(",").map(d => d.trim()).filter(Boolean),
                  })}
                />
              </div>
              <div>
                <Label>Contact email</Label>
                <Input value={editing.contact_email || ""} onChange={e => setEditing({ ...editing, contact_email: e.target.value })} />
              </div>
              <div>
                <Label>Logo URL</Label>
                <Input value={editing.logo_url || ""} onChange={e => setEditing({ ...editing, logo_url: e.target.value })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
              </div>
              <div>
                <Label>Webhook secret (current)</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={showSecret ? editing.webhook_secret : "••••••••••••••••"}
                    readOnly className="font-mono text-xs"
                  />
                  <Button size="icon" variant="outline" onClick={() => setShowSecret(!showSecret)}>
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button size="icon" variant="outline" onClick={() => copy(editing.webhook_secret)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={updateMerchant}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Webhook deliveries dialog */}
      <Dialog open={!!deliveriesFor} onOpenChange={(o) => !o && setDeliveriesFor(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Webhook deliveries</DialogTitle>
          </DialogHeader>
          {deliveriesFor && (
            <>
              <p className="text-xs text-muted-foreground break-all">{deliveriesFor.webhook_url}</p>
              <div className="border border-border rounded-lg max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Attempt</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>When</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deliveries.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">No attempts yet</TableCell></TableRow>
                    ) : deliveries.map(d => (
                      <TableRow key={d.id}>
                        <TableCell>#{d.attempt}</TableCell>
                        <TableCell>
                          <Badge variant={d.succeeded ? "default" : "destructive"}>
                            {d.status_code ?? "ERR"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{new Date(d.delivered_at).toLocaleString()}</TableCell>
                        <TableCell className="text-xs text-destructive">{d.error || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter>
                {deliveriesFor.status === "paid" && (
                  <Button onClick={() => redeliver(deliveriesFor)}>
                    <Send className="h-4 w-4 mr-2" /> Redeliver now
                  </Button>
                )}
                <Button variant="outline" onClick={() => setDeliveriesFor(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MerchantApiManager;
