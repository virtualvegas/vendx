import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, History, Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { formatDisplayDate } from "@/lib/dateUtils";

interface ProductRow {
  id: string;
  name: string;
  category: string;
  stock: number | null;
  low_stock_threshold: number;
  is_active: boolean;
}

export const StoreInventoryPanel = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustDelta, setAdjustDelta] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [historyProductId, setHistoryProductId] = useState<string | null>(null);

  const { data: products, isLoading } = useQuery({
    queryKey: ["store-inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_products")
        .select("id, name, category, stock, low_stock_threshold, is_active")
        .order("stock", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as ProductRow[];
    },
  });

  const { data: history } = useQuery({
    queryKey: ["store-inventory-history", historyProductId],
    enabled: !!historyProductId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_inventory_adjustments")
        .select("*")
        .eq("product_id", historyProductId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const adjustMutation = useMutation({
    mutationFn: async ({ productId, delta, reason }: { productId: string; delta: number; reason: string }) => {
      const product = products?.find(p => p.id === productId);
      const current = product?.stock ?? 0;
      const newStock = Math.max(0, current + delta);
      const { error } = await supabase
        .from("store_products")
        .update({ stock: newStock })
        .eq("id", productId);
      if (error) throw error;
      // The trigger logs an automatic system entry; also write a manual entry with reason
      if (reason) {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("store_inventory_adjustments").insert({
          product_id: productId,
          delta,
          new_stock: newStock,
          reason,
          adjustment_type: "manual",
          actor_id: user?.id || null,
        });
      }
      return newStock;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store-inventory"] });
      qc.invalidateQueries({ queryKey: ["store-inventory-history"] });
      setAdjustingId(null);
      setAdjustDelta("");
      setAdjustReason("");
      toast.success("Stock adjusted");
    },
    onError: (err: any) => toast.error("Failed", { description: err.message }),
  });

  const filtered = products?.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase())
  );

  const lowStockCount = products?.filter(p => p.stock !== null && p.stock <= p.low_stock_threshold).length || 0;
  const outOfStockCount = products?.filter(p => p.stock !== null && p.stock <= 0).length || 0;

  const stockBadge = (p: ProductRow) => {
    if (p.stock === null) return <Badge variant="outline">Unlimited</Badge>;
    if (p.stock <= 0) return <Badge variant="destructive">Out of Stock</Badge>;
    if (p.stock <= p.low_stock_threshold) return <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/40"><AlertTriangle className="w-3 h-3 mr-1" />Low ({p.stock})</Badge>;
    return <Badge variant="outline" className="text-green-400 border-green-500/40">{p.stock} in stock</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Tracked Products</p><p className="text-2xl font-bold">{products?.length || 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Low Stock</p><p className="text-2xl font-bold text-amber-400">{lowStockCount}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Out of Stock</p><p className="text-2xl font-bold text-destructive">{outOfStockCount}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center gap-4">
            <CardTitle>Inventory</CardTitle>
            <Input className="max-w-xs" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Stock Status</TableHead>
                  <TableHead>Threshold</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="capitalize text-muted-foreground">{p.category}</TableCell>
                    <TableCell>{stockBadge(p)}</TableCell>
                    <TableCell className="text-muted-foreground">{p.low_stock_threshold}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Dialog open={adjustingId === p.id} onOpenChange={(open) => { if (!open) { setAdjustingId(null); setAdjustDelta(""); setAdjustReason(""); } }}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline" onClick={() => setAdjustingId(p.id)}>Adjust</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Adjust Stock — {p.name}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-2">
                              <p className="text-sm text-muted-foreground">Current: <span className="font-mono font-bold">{p.stock ?? "unlimited"}</span></p>
                              <div>
                                <Label>Change (+/-)</Label>
                                <div className="flex items-center gap-2 mt-1">
                                  <Button size="icon" variant="outline" onClick={() => setAdjustDelta(String((parseInt(adjustDelta) || 0) - 1))}><Minus className="w-4 h-4" /></Button>
                                  <Input type="number" value={adjustDelta} onChange={e => setAdjustDelta(e.target.value)} placeholder="e.g. 10 or -5" className="text-center" />
                                  <Button size="icon" variant="outline" onClick={() => setAdjustDelta(String((parseInt(adjustDelta) || 0) + 1))}><Plus className="w-4 h-4" /></Button>
                                </div>
                              </div>
                              <div>
                                <Label>Reason</Label>
                                <Textarea value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="e.g. Restock, Damage, Audit correction" />
                              </div>
                              <Button
                                className="w-full"
                                disabled={!adjustDelta || adjustMutation.isPending}
                                onClick={() => adjustMutation.mutate({ productId: p.id, delta: parseInt(adjustDelta), reason: adjustReason })}
                              >
                                {adjustMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : `Apply ${parseInt(adjustDelta) > 0 ? "+" : ""}${adjustDelta || 0}`}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>

                        <Dialog open={historyProductId === p.id} onOpenChange={(open) => !open && setHistoryProductId(null)}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost" onClick={() => setHistoryProductId(p.id)}><History className="w-4 h-4" /></Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader><DialogTitle>Stock History — {p.name}</DialogTitle></DialogHeader>
                            <div className="max-h-[60vh] overflow-y-auto">
                              <Table>
                                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Delta</TableHead><TableHead>New Stock</TableHead><TableHead>Reason</TableHead></TableRow></TableHeader>
                                <TableBody>
                                  {history?.length ? history.map(h => (
                                    <TableRow key={h.id}>
                                      <TableCell className="text-xs">{formatDisplayDate(h.created_at)}</TableCell>
                                      <TableCell className={h.delta > 0 ? "text-green-400" : "text-destructive"}>{h.delta > 0 ? "+" : ""}{h.delta}</TableCell>
                                      <TableCell>{h.new_stock}</TableCell>
                                      <TableCell className="text-sm">{h.reason || <span className="text-muted-foreground italic">{h.adjustment_type}</span>}</TableCell>
                                    </TableRow>
                                  )) : <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No history yet</TableCell></TableRow>}
                                </TableBody>
                              </Table>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
