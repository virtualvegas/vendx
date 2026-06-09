import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Addon {
  id: string;
  product_id: string;
  name: string;
  description: string | null;
  price: number;
  is_active: boolean;
  is_required: boolean;
}

const defaultForm = { product_id: "", name: "", description: "", price: "0", is_active: true, is_required: false };

export const StoreAddonsPanel = () => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Addon | null>(null);
  const [form, setForm] = useState(defaultForm);

  const { data: products } = useQuery({
    queryKey: ["store-products-for-addons"],
    queryFn: async () => {
      const { data, error } = await supabase.from("store_products").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: addons, isLoading } = useQuery({
    queryKey: ["store-addons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_product_addons")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Addon[];
    },
  });

  const productName = (id: string) => products?.find(p => p.id === id)?.name || id.slice(0, 8);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        product_id: form.product_id,
        name: form.name,
        description: form.description || null,
        price: parseFloat(form.price) || 0,
        is_active: form.is_active,
        is_required: form.is_required,
      };
      if (editing) {
        const { error } = await supabase.from("store_product_addons").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("store_product_addons").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store-addons"] });
      toast.success(editing ? "Add-on updated" : "Add-on created");
      reset();
    },
    onError: (e: any) => toast.error("Failed", { description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("store_product_addons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store-addons"] });
      toast.success("Deleted");
    },
  });

  const reset = () => { setOpen(false); setEditing(null); setForm(defaultForm); };

  const openEdit = (a: Addon) => {
    setEditing(a);
    setForm({
      product_id: a.product_id,
      name: a.name,
      description: a.description || "",
      price: String(a.price),
      is_active: a.is_active,
      is_required: a.is_required,
    });
    setOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row justify-between items-center">
        <CardTitle>Product Add-ons</CardTitle>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />New Add-on</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit Add-on" : "New Add-on"}</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <Label>Product</Label>
                <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select product..." /></SelectTrigger>
                  <SelectContent>{products?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div><Label>Price ($)</Label><Input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(c) => setForm({ ...form, is_active: c })} /><Label>Active</Label></div>
                <div className="flex items-center gap-2"><Switch checked={form.is_required} onCheckedChange={(c) => setForm({ ...form, is_required: c })} /><Label>Required</Label></div>
              </div>
              <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={!form.product_id || !form.name || saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (editing ? "Update" : "Create")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? <Loader2 className="animate-spin mx-auto" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Add-on</TableHead><TableHead>Price</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {addons?.length ? addons.map(a => (
                <TableRow key={a.id}>
                  <TableCell className="text-sm">{productName(a.product_id)}</TableCell>
                  <TableCell><div className="font-medium">{a.name}</div><div className="text-xs text-muted-foreground">{a.description}</div></TableCell>
                  <TableCell>${Number(a.price).toFixed(2)}</TableCell>
                  <TableCell><div className="flex gap-1">{a.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}{a.is_required && <Badge variant="outline">Required</Badge>}</div></TableCell>
                  <TableCell><div className="flex gap-1"><Button size="icon" variant="ghost" onClick={() => openEdit(a)}><Pencil className="w-4 h-4" /></Button><Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete?")) deleteMutation.mutate(a.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button></div></TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No add-ons yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
