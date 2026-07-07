import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Edit3, Trash2, Package, DollarSign, Wrench } from "lucide-react";
import { logAuditEvent } from "@/hooks/useAuditLog";

const ITEM_TYPES = [
  { value: "product", label: "Restock Product" },
  { value: "machine", label: "Machine / Hardware" },
  { value: "fee", label: "Fee / Service" },
  { value: "kit", label: "Kit / Bundle" },
];

const emptyItem = {
  id: "", name: "", sku: "", category: "", item_type: "product",
  unit_price: 0, min_order_quantity: 1, stock_quantity: 0,
  description: "", image_url: "", is_active: true,
};

const FranchiseCatalogManager = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(emptyItem);
  const [filter, setFilter] = useState<string>("all");

  const items = useQuery({
    queryKey: ["fc-items"],
    queryFn: async () => (await supabase.from("vendx_franchise_catalog_items" as any).select("*").order("item_type").order("name")).data as any[] || [],
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name) throw new Error("Name required");
      const payload = {
        name: form.name, sku: form.sku || null, category: form.category || null,
        item_type: form.item_type, unit_price: Number(form.unit_price) || 0,
        min_order_quantity: Number(form.min_order_quantity) || 1,
        stock_quantity: form.stock_quantity === "" ? null : Number(form.stock_quantity),
        description: form.description || null, image_url: form.image_url || null,
        is_active: !!form.is_active,
      };
      if (form.id) {
        const { error } = await supabase.from("vendx_franchise_catalog_items" as any).update(payload).eq("id", form.id);
        if (error) throw error;
        await logAuditEvent({ action: "franchise.catalog.update", entity_type: "vendx_franchise_catalog_items", entity_id: form.id, details: payload });
      } else {
        const { data, error } = await supabase.from("vendx_franchise_catalog_items" as any).insert(payload).select("id").single();
        if (error) throw error;
        await logAuditEvent({ action: "franchise.catalog.create", entity_type: "vendx_franchise_catalog_items", entity_id: (data as any).id, details: payload });
      }
    },
    onSuccess: () => {
      toast({ title: form.id ? "Updated" : "Created" });
      setForm(emptyItem); setOpen(false);
      qc.invalidateQueries({ queryKey: ["fc-items"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vendx_franchise_catalog_items" as any).delete().eq("id", id);
      if (error) throw error;
      await logAuditEvent({ action: "franchise.catalog.delete", entity_type: "vendx_franchise_catalog_items", entity_id: id });
    },
    onSuccess: () => { toast({ title: "Deleted" }); qc.invalidateQueries({ queryKey: ["fc-items"] }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const toggleActive = async (i: any) => {
    const { error } = await supabase.from("vendx_franchise_catalog_items" as any).update({ is_active: !i.is_active }).eq("id", i.id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    await logAuditEvent({ action: "franchise.catalog.toggle_active", entity_type: "vendx_franchise_catalog_items", entity_id: i.id, details: { is_active: !i.is_active } });
    qc.invalidateQueries({ queryKey: ["fc-items"] });
  };

  const openEdit = (i: any) => { setForm({ ...i, stock_quantity: i.stock_quantity ?? "" }); setOpen(true); };
  const openNew = () => { setForm(emptyItem); setOpen(true); };

  const filtered = (items.data || []).filter((i: any) => filter === "all" || i.item_type === filter);
  const groupIcon = (t: string) => t === "machine" ? <Wrench className="h-4 w-4" /> : t === "fee" ? <DollarSign className="h-4 w-4" /> : <Package className="h-4 w-4" />;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Package className="h-6 w-6" />Franchise Catalog & Pricing</h1>
          <p className="text-sm text-muted-foreground">Manage products, machines, fees, and kits that franchisees can order from the storefront.</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />New Item</Button>
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-xs">Filter:</Label>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {ITEM_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} item(s)</div>
      </div>

      <Card>
        <CardHeader><CardTitle>Catalog Items</CardTitle><CardDescription>Franchisees see active items only.</CardDescription></CardHeader>
        <CardContent>
          {items.isLoading ? <Loader2 className="animate-spin" /> :
            !filtered.length ? <p className="text-sm text-muted-foreground">No items.</p> :
              <div className="space-y-2">
                {filtered.map((i: any) => (
                  <div key={i.id} className="border rounded p-3 flex items-center gap-3">
                    {i.image_url ? <img src={i.image_url} alt="" className="w-12 h-12 rounded object-cover" /> :
                      <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">{groupIcon(i.item_type)}</div>}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-medium truncate">{i.name}</div>
                        <Badge variant="outline" className="text-xs">{ITEM_TYPES.find(t => t.value === i.item_type)?.label || i.item_type}</Badge>
                        {!i.is_active && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {i.sku && `SKU ${i.sku} · `}{i.category && `${i.category} · `}
                        Min qty {i.min_order_quantity ?? 1}
                        {i.stock_quantity !== null && ` · Stock ${i.stock_quantity}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">${Number(i.unit_price).toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">per unit</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Switch checked={i.is_active} onCheckedChange={() => toggleActive(i)} />
                      <Button size="icon" variant="ghost" onClick={() => openEdit(i)}><Edit3 className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Delete "${i.name}"?`)) remove.mutate(i.id); }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Edit Catalog Item" : "New Catalog Item"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Type</Label>
                <Select value={form.item_type} onValueChange={(v) => setForm({ ...form, item_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ITEM_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>SKU</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
              <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Snacks, Beverages, Parts" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Unit Price ($)</Label><Input type="number" step="0.01" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} /></div>
              <div><Label>Min Order Qty</Label><Input type="number" value={form.min_order_quantity} onChange={(e) => setForm({ ...form, min_order_quantity: e.target.value })} /></div>
              <div><Label>Stock (blank = unlimited)</Label><Input type="number" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} /></div>
            </div>
            <div><Label>Image URL</Label><Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Visible to franchisees</Label>
            </div>
            <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}{form.id ? "Save Changes" : "Create Item"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FranchiseCatalogManager;
