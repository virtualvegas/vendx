import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { logAuditEvent } from "@/hooks/useAuditLog";
import { Plus, Copy, RefreshCw, Trash2, Globe, Eye, EyeOff, Code, ExternalLink, ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";

const CATEGORIES = [
  "machine_revenue", "store_sales", "event_rental", "ad_revenue",
  "subscription", "deposit", "refund_received", "transfer_in",
  "interest", "affiliate", "service_fee",
  "vendor_booking", "venue_booking", "event_tickets",
  "other",
];

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);

interface Stream {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  source_url: string | null;
  default_category: string;
  default_subcategory: string | null;
  color: string;
  icon: string;
  is_active: boolean;
  api_key_prefix: string;
  default_payment_method: string;
  is_taxable: boolean;
  total_entries: number;
  total_amount: number;
  last_received_at: string | null;
  created_at: string;
}

export const IncomeStreamsManager = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [keyDialog, setKeyDialog] = useState<{ open: boolean; key: string; name: string }>({ open: false, key: "", name: "" });
  const [revealKey, setRevealKey] = useState(false);
  const [entriesStreamId, setEntriesStreamId] = useState<string | null>(null);
  const [docsOpen, setDocsOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", slug: "", description: "", source_url: "",
    default_category: "other", default_subcategory: "",
    color: "#10b981", default_payment_method: "external", is_taxable: true,
  });

  const { data: streams, isLoading } = useQuery({
    queryKey: ["external-income-streams"],
    queryFn: async (): Promise<Stream[]> => {
      const { data, error } = await supabase.from("external_income_streams" as any).select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any) || [];
    },
  });

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/external-income-webhook`;

  const createMut = useMutation({
    mutationFn: async () => {
      // 1. generate api key via RPC (super admin only)
      const { data: keyData, error: keyErr } = await supabase.rpc("generate_external_stream_api_key" as any);
      if (keyErr) throw keyErr;
      const k = Array.isArray(keyData) ? keyData[0] : keyData;
      if (!k?.plain_key) throw new Error("Failed to generate API key");

      const { data: { user } } = await supabase.auth.getUser();
      const slug = form.slug || slugify(form.name);

      const { data, error } = await supabase.from("external_income_streams" as any).insert({
        name: form.name,
        slug,
        description: form.description || null,
        source_url: form.source_url || null,
        default_category: form.default_category,
        default_subcategory: form.default_subcategory || null,
        color: form.color,
        default_payment_method: form.default_payment_method,
        is_taxable: form.is_taxable,
        api_key_hash: k.key_hash,
        api_key_prefix: k.key_prefix,
        created_by: user?.id,
      }).select().single();
      if (error) throw error;

      await logAuditEvent({ action: "create", entity_type: "external_income_stream", entity_id: (data as any).id, details: { name: form.name, slug } });
      return { stream: data, plainKey: k.plain_key };
    },
    onSuccess: ({ stream, plainKey }) => {
      qc.invalidateQueries({ queryKey: ["external-income-streams"] });
      toast({ title: "Stream created" });
      setOpen(false);
      setForm({ name: "", slug: "", description: "", source_url: "", default_category: "other", default_subcategory: "", color: "#10b981", default_payment_method: "external", is_taxable: true });
      setKeyDialog({ open: true, key: plainKey, name: (stream as any).name });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("external_income_streams" as any).update({ is_active }).eq("id", id);
      if (error) throw error;
      await logAuditEvent({ action: is_active ? "activate" : "deactivate", entity_type: "external_income_stream", entity_id: id });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["external-income-streams"] }),
  });

  const rotateMut = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("rotate_external_stream_api_key" as any, { p_stream_id: id });
      if (error) throw error;
      await logAuditEvent({ action: "rotate_api_key", entity_type: "external_income_stream", entity_id: id });
      return data as unknown as string;
    },
    onSuccess: (key, id) => {
      qc.invalidateQueries({ queryKey: ["external-income-streams"] });
      const stream = streams?.find(s => s.id === id);
      setKeyDialog({ open: true, key, name: stream?.name || "Stream" });
    },
    onError: (e: any) => toast({ title: "Rotate failed", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("external_income_streams" as any).delete().eq("id", id);
      if (error) throw error;
      await logAuditEvent({ action: "delete", entity_type: "external_income_stream", entity_id: id });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["external-income-streams"] }); toast({ title: "Stream deleted" }); },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const copy = (text: string, label = "Copied") => {
    navigator.clipboard.writeText(text);
    toast({ title: label });
  };

  const totals = useMemo(() => {
    const active = (streams || []).filter(s => s.is_active).length;
    const entries = (streams || []).reduce((s, x) => s + (x.total_entries || 0), 0);
    const amount = (streams || []).reduce((s, x) => s + Number(x.total_amount || 0), 0);
    return { active, entries, amount };
  }, [streams]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2"><Globe className="w-6 h-6" /> External Income Streams</h2>
        <p className="text-sm text-muted-foreground">
          Receive financial data pushed from other VendX-owned sites. Each stream has a unique API key.
          Entries appear in all finance dashboards and charts.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Active Streams</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{totals.active} / {streams?.length || 0}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Entries Received</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{totals.entries.toLocaleString()}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Amount Received</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">${totals.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle>Configured Streams</CardTitle>
            <CardDescription>Webhook endpoint: <code className="text-xs bg-muted px-2 py-0.5 rounded">{webhookUrl}</code></CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setDocsOpen(true)}><Code className="w-4 h-4 mr-2" />API Docs</Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-2" />New Stream</Button></DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Income Stream</DialogTitle>
                  <DialogDescription>Generate a new API endpoint for an external VendX site to push income data.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Stream Name *</Label>
                      <Input placeholder="e.g. VendX Music Sales" value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.slug || slugify(e.target.value) })} />
                    </div>
                    <div><Label>Slug *</Label>
                      <Input placeholder="vendx-music-sales" value={form.slug}
                        onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} />
                    </div>
                  </div>
                  <div><Label>Source URL</Label>
                    <Input placeholder="https://music.vendx.com" value={form.source_url}
                      onChange={(e) => setForm({ ...form, source_url: e.target.value })} />
                  </div>
                  <div><Label>Description</Label>
                    <Textarea rows={2} placeholder="What this stream represents" value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Default Category *</Label>
                      <Select value={form.default_category} onValueChange={(v) => setForm({ ...form, default_category: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Default Subcategory</Label>
                      <Input placeholder="optional" value={form.default_subcategory}
                        onChange={(e) => setForm({ ...form, default_subcategory: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Display Color</Label>
                      <div className="flex gap-2"><Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-16 h-10 p-1" />
                        <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="flex-1" /></div>
                    </div>
                    <div><Label>Default Payment Method</Label>
                      <Select value={form.default_payment_method} onValueChange={(v) => setForm({ ...form, default_payment_method: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{["external", "stripe", "paypal", "bank", "cash", "card", "crypto", "other"].map(p =>
                          <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={form.is_taxable} onCheckedChange={(v) => setForm({ ...form, is_taxable: v })} />
                    <Label>Income from this stream is taxable</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => createMut.mutate()} disabled={createMut.isPending || !form.name || !form.slug}>
                    {createMut.isPending ? "Creating..." : "Create Stream & Generate API Key"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <p className="text-muted-foreground text-center py-8">Loading...</p> :
            (streams || []).length === 0 ? <p className="text-muted-foreground text-center py-8">No streams configured yet. Create one to start receiving external income data.</p> :
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stream</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>API Key</TableHead>
                  <TableHead className="text-right">Entries</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Last Received</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {streams!.map(s => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: s.color }} />
                        <div>
                          <p className="font-medium">{s.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{s.slug}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{s.default_category.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell><code className="text-xs bg-muted px-2 py-0.5 rounded">{s.api_key_prefix}…</code></TableCell>
                    <TableCell className="text-right font-mono">{s.total_entries}</TableCell>
                    <TableCell className="text-right font-mono text-green-600">${Number(s.total_amount).toFixed(2)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {s.last_received_at ? format(new Date(s.last_received_at), "MMM d, h:mm a") : "—"}
                    </TableCell>
                    <TableCell>
                      <Switch checked={s.is_active} onCheckedChange={(v) => toggleMut.mutate({ id: s.id, is_active: v })} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" title="View entries" onClick={() => setEntriesStreamId(s.id)}><Eye className="w-3 h-3" /></Button>
                        <Button size="icon" variant="ghost" title="Rotate API key" onClick={() => { if (confirm(`Rotate API key for "${s.name}"? The old key will stop working immediately.`)) rotateMut.mutate(s.id); }}><RefreshCw className="w-3 h-3" /></Button>
                        <Button size="icon" variant="ghost" title="Delete stream" onClick={() => { if (confirm(`Delete "${s.name}" and all its entries? This cannot be undone.`)) deleteMut.mutate(s.id); }}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          }
        </CardContent>
      </Card>

      {/* New API Key Reveal Dialog */}
      <Dialog open={keyDialog.open} onOpenChange={(v) => { if (!v) { setKeyDialog({ open: false, key: "", name: "" }); setRevealKey(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API Key for "{keyDialog.name}"</DialogTitle>
            <DialogDescription className="text-destructive font-medium">
              ⚠️ Copy this key now. It will not be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-muted p-3 rounded font-mono text-sm break-all flex items-center gap-2">
              <span className="flex-1">{revealKey ? keyDialog.key : keyDialog.key.replace(/./g, "•")}</span>
              <Button size="icon" variant="ghost" onClick={() => setRevealKey(!revealKey)}>
                {revealKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button size="icon" variant="ghost" onClick={() => copy(keyDialog.key, "API key copied")}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <div className="text-xs space-y-1">
              <p><strong>Webhook URL:</strong></p>
              <code className="block bg-muted p-2 rounded break-all">{webhookUrl}</code>
              <p className="text-muted-foreground mt-2">Send the key in the <code>X-API-Key</code> header.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* API Docs Dialog */}
      <Dialog open={docsOpen} onOpenChange={setDocsOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>External Income Webhook — API Reference</DialogTitle>
            <DialogDescription>How other VendX-owned sites push income data into the finance system.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-semibold mb-1">Endpoint</p>
              <code className="block bg-muted p-2 rounded text-xs break-all">POST {webhookUrl}</code>
            </div>
            <div>
              <p className="font-semibold mb-1">Headers</p>
              <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">{`Content-Type: application/json
X-API-Key: vxk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`}</pre>
            </div>
            <div>
              <p className="font-semibold mb-1">Request body (JSON)</p>
              <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">{`{
  "external_reference": "order-12345",   // required, unique per stream
  "amount": 49.99,                        // required, positive number
  "source": "Customer: John Doe",         // required, descriptive string
  "entry_date": "2026-04-23",             // optional, ISO date (defaults today)
  "description": "Album purchase",        // optional
  "tax_collected": 4.50,                  // optional
  "currency": "USD",                      // optional, default USD
  "category": "store_sales",              // optional, overrides stream default
  "subcategory": "digital",               // optional
  "payment_method": "stripe",             // optional, overrides stream default
  "customer_email": "buyer@example.com",  // optional
  "customer_name": "John Doe",            // optional
  "metadata": { "anything": "you want" }  // optional, stored as raw payload
}`}</pre>
            </div>
            <div>
              <p className="font-semibold mb-1">Response</p>
              <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">{`{ "success": true, "duplicate": false, "entry_id": "uuid", "message": "Income recorded" }`}</pre>
              <p className="text-xs text-muted-foreground mt-1">
                Sending the same <code>external_reference</code> twice for the same stream returns
                <code> duplicate: true</code> and is safe to retry (idempotent).
              </p>
            </div>
            <div>
              <p className="font-semibold mb-1">Example: cURL</p>
              <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">{`curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: vxk_your_key_here" \\
  -d '{
    "external_reference": "order-12345",
    "amount": 49.99,
    "source": "VendX Music sale"
  }'`}</pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Entries Viewer Dialog */}
      <EntriesDialog streamId={entriesStreamId} onClose={() => setEntriesStreamId(null)} streams={streams || []} />
    </div>
  );
};

const EntriesDialog = ({ streamId, onClose, streams }: { streamId: string | null; onClose: () => void; streams: Stream[] }) => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const stream = streams.find(s => s.id === streamId);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; amount: number; reference: string } | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: entries } = useQuery({
    queryKey: ["external-income-entries", streamId],
    queryFn: async (): Promise<any[]> => {
      if (!streamId) return [];
      const { data, error } = await supabase.from("external_income_entries" as any)
        .select("*").eq("stream_id", streamId).order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return (data as any) || [];
    },
    enabled: !!streamId,
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number; reference: string }) => {
      // Delete the entry
      const { error: delErr } = await supabase.from("external_income_entries" as any).delete().eq("id", id);
      if (delErr) throw delErr;

      // Decrement stream rollups (best-effort; ignore if blocked by RLS)
      if (streamId && stream) {
        await supabase.from("external_income_streams" as any)
          .update({
            total_entries: Math.max(0, (stream.total_entries || 0) - 1),
            total_amount: Math.max(0, Number(stream.total_amount || 0) - Number(amount || 0)),
          } as any)
          .eq("id", streamId);
      }

      await logAuditEvent({
        action: "delete",
        entity_type: "external_income_entry",
        entity_id: id,
        details: { stream_id: streamId, stream_name: stream?.name, amount },
      });
    },
    onSuccess: () => {
      toast({ title: "Entry deleted", description: "Stream totals updated." });
      qc.invalidateQueries({ queryKey: ["external-income-entries", streamId] });
      qc.invalidateQueries({ queryKey: ["external-income-streams"] });
      qc.invalidateQueries({ queryKey: ["finance-overview-external-income"] });
      qc.invalidateQueries({ queryKey: ["unified-income"] });
      setConfirmDelete(null);
    },
    onError: (err: any) => {
      toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
    },
  });

  return (
    <>
      <Dialog open={!!streamId} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Entries — {stream?.name}</DialogTitle>
            <DialogDescription>Last 200 entries received from this stream. Deleting an entry removes it permanently and adjusts the stream totals.</DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(entries || []).map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs whitespace-nowrap">{format(new Date(e.entry_date), "MMM d, yy")}</TableCell>
                  <TableCell className="font-mono text-xs max-w-[160px] truncate" title={e.external_reference}>{e.external_reference}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{e.source}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{(e.category || "—").replace(/_/g, " ")}</Badge></TableCell>
                  <TableCell className="font-mono text-right text-green-600">+${Number(e.amount).toFixed(2)}</TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setConfirmDelete({ id: e.id, amount: Number(e.amount), reference: e.external_reference })}
                      title="Delete entry"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(entries || []).length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No entries received yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this income entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the entry{confirmDelete ? ` (${confirmDelete.reference}, $${confirmDelete.amount.toFixed(2)})` : ""} and decrement the stream totals.
              It will also disappear from the Finance overview. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete entry"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default IncomeStreamsManager;
