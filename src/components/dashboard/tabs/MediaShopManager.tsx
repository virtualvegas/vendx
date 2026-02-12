import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Package, Download, Disc, Disc3, Image as ImageIcon } from "lucide-react";

const typeLabels: Record<string, string> = {
  merch: "Merch",
  digital_download: "Digital Download",
  vinyl: "Vinyl",
  cd: "CD",
  poster: "Poster",
  other: "Other",
};

const defaultForm = {
  title: "",
  slug: "",
  description: "",
  product_type: "merch",
  price: "0",
  compare_at_price: "",
  image_url: "",
  file_url: "",
  is_active: true,
  is_featured: false,
  stock_quantity: "0",
  display_order: "0",
  tags: "",
};

const MediaShopManager = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);

  const { data: products, isLoading } = useQuery({
    queryKey: ["admin-media-shop-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media_shop_products")
        .select("*")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const payload = {
        title: values.title,
        slug: values.slug || values.title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
        description: values.description || null,
        product_type: values.product_type,
        price: parseFloat(values.price) || 0,
        compare_at_price: values.compare_at_price ? parseFloat(values.compare_at_price) : null,
        image_url: values.image_url || null,
        file_url: values.file_url || null,
        is_active: values.is_active,
        is_featured: values.is_featured,
        stock_quantity: parseInt(values.stock_quantity) || 0,
        display_order: parseInt(values.display_order) || 0,
        tags: values.tags ? values.tags.split(",").map((t) => t.trim()).filter(Boolean) : null,
      };

      if (editingId) {
        const { error } = await supabase.from("media_shop_products").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("media_shop_products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-media-shop-products"] });
      toast.success(editingId ? "Product updated" : "Product created");
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => toast.error("Failed to save", { description: err.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("media_shop_products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-media-shop-products"] });
      toast.success("Product deleted");
    },
  });

  const resetForm = () => {
    setForm(defaultForm);
    setEditingId(null);
  };

  const openEdit = (product: any) => {
    setEditingId(product.id);
    setForm({
      title: product.title,
      slug: product.slug,
      description: product.description || "",
      product_type: product.product_type,
      price: String(product.price),
      compare_at_price: product.compare_at_price ? String(product.compare_at_price) : "",
      image_url: product.image_url || "",
      file_url: product.file_url || "",
      is_active: product.is_active ?? true,
      is_featured: product.is_featured ?? false,
      stock_quantity: String(product.stock_quantity ?? 0),
      display_order: String(product.display_order ?? 0),
      tags: product.tags?.join(", ") || "",
    });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Media Shop Products</h2>
          <p className="text-muted-foreground">Manage merch, vinyl, digital downloads, and more</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Add Product</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Product" : "Add Product"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Title</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={form.product_type} onValueChange={(v) => setForm({ ...form, product_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(typeLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Price ($)</Label>
                  <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                </div>
                <div>
                  <Label>Compare Price</Label>
                  <Input type="number" step="0.01" value={form.compare_at_price} onChange={(e) => setForm({ ...form, compare_at_price: e.target.value })} />
                </div>
                <div>
                  <Label>Stock</Label>
                  <Input type="number" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Image URL</Label>
                <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
              </div>
              {form.product_type === "digital_download" && (
                <div>
                  <Label>File URL (download link)</Label>
                  <Input value={form.file_url} onChange={(e) => setForm({ ...form, file_url: e.target.value })} />
                </div>
              )}
              <div>
                <Label>Tags (comma separated)</Label>
                <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Display Order</Label>
                  <Input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: e.target.value })} />
                </div>
                <div className="space-y-3 pt-5">
                  <div className="flex items-center gap-2">
                    <Switch checked={form.is_active} onCheckedChange={(c) => setForm({ ...form, is_active: c })} />
                    <Label>Active</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={form.is_featured} onCheckedChange={(c) => setForm({ ...form, is_featured: c })} />
                    <Label>Featured</Label>
                  </div>
                </div>
              </div>
              <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} className="w-full">
                {saveMutation.isPending ? "Saving..." : editingId ? "Update Product" : "Create Product"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : products && products.length > 0 ? (
                products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.title}</TableCell>
                    <TableCell><Badge variant="outline">{typeLabels[p.product_type] || p.product_type}</Badge></TableCell>
                    <TableCell>${Number(p.price).toFixed(2)}</TableCell>
                    <TableCell>{p.stock_quantity}</TableCell>
                    <TableCell>
                      <Badge variant={p.is_active ? "default" : "secondary"}>
                        {p.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No products yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default MediaShopManager;
