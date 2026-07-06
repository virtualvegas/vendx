import { useState } from "react";
import { useMyFranchise } from "@/hooks/useMyFranchise";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, Package } from "lucide-react";
import { format } from "date-fns";

interface Item { name: string; quantity: number; unit_price: number; notes?: string }

const FranchiseOrders = () => {
  const { data: franchise } = useMyFranchise();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [orderType, setOrderType] = useState<"machine" | "product">("machine");
  const [items, setItems] = useState<Item[]>([{ name: "", quantity: 1, unit_price: 0 }]);
  const [notes, setNotes] = useState("");
  const [shipping, setShipping] = useState("");

  const { data: orders, isLoading } = useQuery({
    queryKey: ["franchise-orders", franchise?.id],
    enabled: !!franchise?.id,
    queryFn: async () => {
      const { data } = await supabase.from("vendx_franchise_orders" as any).select("*").eq("franchise_id", franchise.id).order("created_at", { ascending: false });
      return (data || []) as any[];
    },
  });

  const subtotal = items.reduce((s, i) => s + Number(i.unit_price || 0) * Number(i.quantity || 0), 0);

  const submit = async () => {
    if (!franchise) return;
    const valid = items.filter((i) => i.name.trim() && i.quantity > 0);
    if (!valid.length) return toast({ title: "Add at least one item", variant: "destructive" });
    const { error } = await supabase.from("vendx_franchise_orders" as any).insert({
      franchise_id: franchise.id,
      order_type: orderType,
      items: valid,
      subtotal,
      total: subtotal,
      shipping_address: shipping ? { address: shipping } : null,
      notes,
    } as any);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Order placed", description: "VendX will review and confirm." });
    setOpen(false);
    setItems([{ name: "", quantity: 1, unit_price: 0 }]);
    setNotes(""); setShipping("");
    qc.invalidateQueries({ queryKey: ["franchise-orders"] });
  };

  if (!franchise) return <div className="p-6 text-muted-foreground">No franchise on file.</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Order Machines & Products</h2>
          <p className="text-sm text-muted-foreground">All machines and restock inventory must be ordered through VendX.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={franchise.status !== "active"}><Plus className="h-4 w-4 mr-1" />New Order</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Place Order</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Order Type</Label>
                <select className="w-full border rounded-md p-2 bg-background" value={orderType} onChange={(e) => setOrderType(e.target.value as any)}>
                  <option value="machine">Machines</option>
                  <option value="product">Restock Products</option>
                </select>
              </div>
              <div>
                <Label>Items</Label>
                <div className="space-y-2">
                  {items.map((it, idx) => (
                    <div key={idx} className="flex gap-2 items-end">
                      <div className="flex-1"><Input placeholder="Item name" value={it.name} onChange={(e) => { const c = [...items]; c[idx].name = e.target.value; setItems(c); }} /></div>
                      <div className="w-20"><Input type="number" placeholder="Qty" value={it.quantity} onChange={(e) => { const c = [...items]; c[idx].quantity = Number(e.target.value); setItems(c); }} /></div>
                      <div className="w-28"><Input type="number" step="0.01" placeholder="Unit $" value={it.unit_price} onChange={(e) => { const c = [...items]; c[idx].unit_price = Number(e.target.value); setItems(c); }} /></div>
                      <Button size="icon" variant="ghost" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => setItems([...items, { name: "", quantity: 1, unit_price: 0 }])}><Plus className="h-4 w-4 mr-1" />Add Item</Button>
                </div>
              </div>
              <div><Label>Ship To</Label><Input value={shipping} onChange={(e) => setShipping(e.target.value)} placeholder="Shipping address" /></div>
              <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm text-muted-foreground">Estimated total</span>
                <span className="text-xl font-bold">${subtotal.toFixed(2)}</span>
              </div>
              <Button onClick={submit} className="w-full">Submit Order</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" />Order History</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Loader2 className="animate-spin" /> :
            !orders?.length ? <p className="text-sm text-muted-foreground">No orders yet.</p> :
              <div className="space-y-2">
                {orders.map((o: any) => (
                  <div key={o.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{o.order_number} <Badge variant="outline" className="ml-2">{o.order_type}</Badge></div>
                      <div className="text-xs text-muted-foreground">{format(new Date(o.created_at), "PP")} • {(o.items as any[])?.length || 0} items • ${Number(o.total).toFixed(2)}</div>
                    </div>
                    <Badge variant={o.status === "delivered" ? "default" : o.status === "cancelled" ? "destructive" : "secondary"}>{o.status}</Badge>
                  </div>
                ))}
              </div>
          }
        </CardContent>
      </Card>
    </div>
  );
};

export default FranchiseOrders;
