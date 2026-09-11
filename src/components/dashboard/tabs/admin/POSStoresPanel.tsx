import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Store, Plus, RefreshCw, Pencil, Trash2, Link as LinkIcon, Cloud, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface PosStore {
  id: string;
  source: string;
  pos_store_id: string;
  display_name: string;
  location_id: string | null;
  stand_id: string | null;
  deposit_account_id: string | null;
  expense_account_id: string | null;
  revenue_subcategory: string | null;
  expense_subcategory: string | null;
  payment_method: string | null;
  cogs_payment_method: string | null;
  is_active: boolean;
  notes: string | null;
}

const blank: Partial<PosStore> = {
  source: "paypal_zettle",
  pos_store_id: "",
  display_name: "",
  location_id: null,
  stand_id: null,
  deposit_account_id: null,
  expense_account_id: null,
  revenue_subcategory: "",
  expense_subcategory: "",
  payment_method: "",
  cogs_payment_method: "",
  is_active: true,
  notes: "",
};

const POSStoresPanel = () => {
  const [stores, setStores] = useState<PosStore[]>([]);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [stands, setStands] = useState<Array<{ id: string; name: string }>>([]);
  const [discovered, setDiscovered] = useState<Array<{ pos_store_id: string; receipts: number; last_seen: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<PosStore>>(blank);
  const [saving, setSaving] = useState(false);

  // Live registers pulled straight from the POS account with the API key
  const [remoteOpen, setRemoteOpen] = useState(false);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [remote, setRemote] = useState<Array<{
    kind: string; id: string; name: string; store_name: string | null;
    address: string | null; activated: boolean; linked: boolean; receipts: number;
  }>>([]);

  const fetchRemote = async () => {
    setRemoteLoading(true);
    setRemoteError(null);
    try {
      const { data, error } = await supabase.functions.invoke("pos-registers-list", { body: {} });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setRemote(((data as any)?.registers || []).map((r: any) => ({
        ...r,
        linked: r.linked || stores.some((s) => s.pos_store_id === r.id),
      })));
    } catch (e: any) {
      setRemoteError(e?.message || "Could not reach the POS account");
    } finally {
      setRemoteLoading(false);
    }
  };

  const openRemote = async () => {
    setRemoteOpen(true);
    await fetchRemote();
  };

  const linkRemote = async (r: { id: string; name: string; store_name: string | null }) => {
    try {
      const { error } = await supabase.from("vendx_pos_stores").upsert(
        {
          source: "paypal_zettle",
          pos_store_id: r.id,
          display_name: r.name || r.store_name || `Register ${r.id.slice(0, 8)}`,
          is_active: true,
        },
        { onConflict: "source,pos_store_id" }
      );
      if (error) throw error;
      toast.success(`Linked ${r.name}`);
      setRemote((prev) => prev.map((x) => (x.id === r.id ? { ...x, linked: true } : x)));
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Link failed");
    }
  };

  const load = async () => {
    setLoading(true);
    const [{ data: s }, { data: a }, { data: l }, { data: st }, { data: r }] = await Promise.all([
      supabase.from("vendx_pos_stores").select("*").order("display_name"),
      supabase.from("finance_accounts").select("id,name").eq("is_active", true).order("name"),
      supabase.from("locations").select("id,name").order("name"),
      supabase.from("stands").select("id,name").order("name"),
      supabase
        .from("vendx_pos_receipts")
        .select("pos_store_id, receipt_date")
        .not("pos_store_id", "is", null)
        .order("receipt_date", { ascending: false })
        .limit(2000),
    ]);
    setStores((s as PosStore[]) || []);
    setAccounts((a as any) || []);
    setLocations((l as any) || []);
    setStands((st as any) || []);

    const agg = new Map<string, { receipts: number; last_seen: string }>();
    (r as any[] | null)?.forEach((row) => {
      const k = String(row.pos_store_id);
      const cur = agg.get(k) || { receipts: 0, last_seen: row.receipt_date };
      cur.receipts += 1;
      if (row.receipt_date > cur.last_seen) cur.last_seen = row.receipt_date;
      agg.set(k, cur);
    });
    setDiscovered(Array.from(agg.entries()).map(([pos_store_id, v]) => ({ pos_store_id, ...v })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const assignedIds = useMemo(() => new Set(stores.map((s) => s.pos_store_id)), [stores]);
  const unassigned = discovered.filter((d) => !assignedIds.has(d.pos_store_id));

  const openNew = (presetId?: string) => {
    setEditing({ ...blank, pos_store_id: presetId || "", display_name: presetId ? `Register ${presetId}` : "" });
    setOpen(true);
  };
  const openEdit = (s: PosStore) => { setEditing({ ...s }); setOpen(true); };

  const save = async () => {
    if (!editing.display_name) {
      toast.error("Register name is required");
      return;
    }
    const registerId = (editing.pos_store_id || "").trim()
      || editing.display_name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setSaving(true);
    try {
      const payload: any = {
        source: editing.source || "paypal_zettle",
        pos_store_id: registerId,
        display_name: editing.display_name,
        location_id: editing.location_id || null,
        stand_id: editing.stand_id || null,
        deposit_account_id: editing.deposit_account_id || null,
        expense_account_id: editing.expense_account_id || null,
        revenue_subcategory: editing.revenue_subcategory || null,
        expense_subcategory: editing.expense_subcategory || null,
        payment_method: editing.payment_method || null,
        cogs_payment_method: editing.cogs_payment_method || null,
        is_active: editing.is_active !== false,
        notes: editing.notes || null,
      };
      const { error } = editing.id
        ? await supabase.from("vendx_pos_stores").update(payload).eq("id", editing.id)
        : await supabase.from("vendx_pos_stores").upsert(payload, { onConflict: "source,pos_store_id" });
      if (error) throw error;

      // Backfill existing receipts that share this register ID (any feed source)
      await supabase
        .from("vendx_pos_receipts")
        .update({ location_id: payload.location_id, stand_id: payload.stand_id })
        .eq("pos_store_id", registerId);

      toast.success("Register saved");
      setOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this register link?")) return;
    const { error } = await supabase.from("vendx_pos_stores").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Removed"); await load(); }
  };

  const nameOf = (arr: Array<{ id: string; name: string }>, id: string | null) =>
    id ? arr.find((x) => x.id === id)?.name || "—" : "—";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2"><Store className="w-5 h-5" /> PayPal Zettle Registers</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Map each PayPal Zettle register to a location and/or stand. Sales still post once as POS revenue, but
              attribution and per-register accounts follow this mapping.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
            <Button variant="secondary" size="sm" onClick={openRemote}><Cloud className="w-4 h-4 mr-2" /> Import from PayPal Zettle</Button>
            <Button size="sm" onClick={() => openNew()}><Plus className="w-4 h-4 mr-2" /> Add Register</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 overflow-x-auto">
        {unassigned.length > 0 && (
          <div className="rounded-md border border-dashed p-3">
            <div className="flex items-center gap-2 mb-2 text-sm font-medium">
              <LinkIcon className="w-4 h-4" /> Unlinked PayPal Zettle registers detected
            </div>
            <div className="flex flex-wrap gap-2">
              {unassigned.map((u) => (
                <Button key={u.pos_store_id} size="sm" variant="outline" onClick={() => openNew(u.pos_store_id)}>
                  {u.pos_store_id} <span className="ml-2 text-xs text-muted-foreground">({u.receipts} receipts)</span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {loading ? <p className="text-muted-foreground">Loading...</p> : stores.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No PayPal Zettle registers linked yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Register</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Stand</TableHead>
                <TableHead>Deposit Account</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stores.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.display_name}</TableCell>
                  <TableCell className="text-sm">{nameOf(locations, s.location_id)}</TableCell>
                  <TableCell className="text-sm">{nameOf(stands, s.stand_id)}</TableCell>
                  <TableCell className="text-sm">{nameOf(accounts, s.deposit_account_id)}</TableCell>
                  <TableCell>{s.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Off</Badge>}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="w-4 h-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing.id ? "Edit PayPal Zettle Register" : "Add PayPal Zettle Register"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              Connected to <span className="font-medium text-foreground">PayPal Zettle</span>
            </div>
            <div className="space-y-1.5">
              <Label>Register Name *</Label>
              <Input value={editing.display_name || ""} onChange={(e) => setEditing({ ...editing, display_name: e.target.value })} placeholder="e.g. Main Counter" />
            </div>
            <div className="space-y-1.5">
              <Label>PayPal Zettle Register ID</Label>
              <Input value={editing.pos_store_id || ""} onChange={(e) => setEditing({ ...editing, pos_store_id: e.target.value })} placeholder="Leave blank unless matching an existing register" />
              <p className="text-xs text-muted-foreground">
                Only needed to attach sales already coming in from a specific Zettle register. Otherwise we create it for you.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Select value={editing.location_id || "__none"} onValueChange={(v) => setEditing({ ...editing, location_id: v === "__none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— None —</SelectItem>
                    {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Stand</Label>
                <Select value={editing.stand_id || "__none"} onValueChange={(v) => setEditing({ ...editing, stand_id: v === "__none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— None —</SelectItem>
                    {stands.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Deposit Account (revenue)</Label>
                <Select value={editing.deposit_account_id || "__none"} onValueChange={(v) => setEditing({ ...editing, deposit_account_id: v === "__none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Inherit global" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— Inherit global —</SelectItem>
                    {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Expense Account (COGS)</Label>
                <Select value={editing.expense_account_id || "__none"} onValueChange={(v) => setEditing({ ...editing, expense_account_id: v === "__none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Inherit global" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— Inherit global —</SelectItem>
                    {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Revenue Subcategory</Label>
                <Input value={editing.revenue_subcategory || ""} onChange={(e) => setEditing({ ...editing, revenue_subcategory: e.target.value })} placeholder="(inherit)" />
              </div>
              <div className="space-y-1.5">
                <Label>Expense Subcategory</Label>
                <Input value={editing.expense_subcategory || ""} onChange={(e) => setEditing({ ...editing, expense_subcategory: e.target.value })} placeholder="(inherit)" />
              </div>
              <div className="space-y-1.5">
                <Label>Revenue Payment Method</Label>
                <Input value={editing.payment_method || ""} onChange={(e) => setEditing({ ...editing, payment_method: e.target.value })} placeholder="(inherit)" />
              </div>
              <div className="space-y-1.5">
                <Label>COGS Payment Method</Label>
                <Input value={editing.cogs_payment_method || ""} onChange={(e) => setEditing({ ...editing, cogs_payment_method: e.target.value })} placeholder="(inherit)" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={editing.notes || ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default POSStoresPanel;
