import { useState } from "react";
import { useMyFranchise } from "@/hooks/useMyFranchise";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, ShoppingCart, Plus, Minus, Trash2, Store } from "lucide-react";

const FranchiseStorefront = () => {
  const { data: franchise } = useMyFranchise();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [category, setCategory] = useState<"machine" | "product">("machine");
  const [shipping, setShipping] = useState("");

  const { data: catalog, isLoading } = useQuery({
    queryKey: ["franchise-catalog", category],
    queryFn: async () => {
      const { data } = await supabase.from("vendx_franchise_catalog_items" as any)
        .select("*").eq("item_type", category).eq("is_active", true).order("name");
      return (data || []) as any[];
    },
  });

  const { data: cart } = useQuery({
    queryKey: ["franchise-cart", franchise?.id],
    enabled: !!franchise?.id,
    queryFn: async () => {
      const { data } = await supabase.from("vendx_franchise_cart_items" as any)
        .select("*, vendx_franchise_catalog_items(*)").eq("franchise_id", franchise.id);
      return (data || []) as any[];
    },
  });

  const addToCart = async (item: any) => {
    if (!franchise) return;
    const existing = cart?.find((c: any) => c.catalog_item_id === item.id);
    if (existing) {
      await supabase.from("vendx_franchise_cart_items" as any)
        .update({ quantity: existing.quantity + 1 }).eq("id", existing.id);
    } else {
      await supabase.from("vendx_franchise_cart_items" as any)
        .insert({ franchise_id: franchise.id, catalog_item_id: item.id, quantity: 1 });
    }
    qc.invalidateQueries({ queryKey: ["franchise-cart"] });
  };

  const updateQty = async (id: string, qty: number) => {
    if (qty <= 0) {
      await supabase.from("vendx_franchise_cart_items" as any).delete().eq("id", id);
    } else {
      await supabase.from("vendx_franchise_cart_items" as any).update({ quantity: qty }).eq("id", id);
    }
    qc.invalidateQueries({ queryKey: ["franchise-cart"] });
  };

  const cartTotal = (cart || []).reduce((s: number, c: any) =>
    s + Number(c.vendx_franchise_catalog_items?.unit_price || 0) * c.quantity, 0);

  const checkout = async () => {
    if (!franchise || !cart?.length) return;
    const items = cart.map((c: any) => ({
      name: c.vendx_franchise_catalog_items?.name,
      quantity: c.quantity,
      unit_price: Number(c.vendx_franchise_catalog_items?.unit_price || 0),
      catalog_item_id: c.catalog_item_id,
    }));
    const orderType = cart[0].vendx_franchise_catalog_items?.item_type || "product";
    const { error } = await supabase.from("vendx_franchise_orders" as any).insert({
      franchise_id: franchise.id, order_type: orderType, items,
      subtotal: cartTotal, total: cartTotal,
      shipping_address: shipping ? { address: shipping } : null,
    } as any);
    if (error) return toast({ title: "Checkout failed", description: error.message, variant: "destructive" });
    await supabase.from("vendx_franchise_cart_items" as any).delete().eq("franchise_id", franchise.id);
    toast({ title: "Order placed!", description: "VendX will confirm shipping soon." });
    setShipping("");
    qc.invalidateQueries({ queryKey: ["franchise-cart"] });
    qc.invalidateQueries({ queryKey: ["franchise-orders"] });
  };

  if (!franchise) return <div className="p-6 text-muted-foreground">No franchise on file.</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2"><Store className="h-6 w-6" />Franchise Storefront</h2>
        <p className="text-sm text-muted-foreground">Order machines and restock inventory directly from VendX.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Tabs value={category} onValueChange={(v) => setCategory(v as any)}>
            <TabsList>
              <TabsTrigger value="machine">Machines</TabsTrigger>
              <TabsTrigger value="product">Restock Products</TabsTrigger>
            </TabsList>
            <TabsContent value={category} className="mt-4">
              {isLoading ? <Loader2 className="animate-spin" /> :
                !catalog?.length ? <p className="text-sm text-muted-foreground">No items available in this category yet.</p> :
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {catalog.map((item: any) => (
                      <Card key={item.id}>
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-medium">{item.name}</div>
                              {item.sku && <div className="text-xs text-muted-foreground">SKU: {item.sku}</div>}
                            </div>
                            <Badge variant="outline">${Number(item.unit_price).toFixed(2)}</Badge>
                          </div>
                          {item.description && <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>}
                          <Button size="sm" className="w-full" onClick={() => addToCart(item)} disabled={franchise.status !== "active"}>
                            <Plus className="h-4 w-4 mr-1" />Add to Cart
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>}
            </TabsContent>
          </Tabs>
        </div>

        <Card className="h-fit sticky top-4">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold flex items-center gap-2"><ShoppingCart className="h-4 w-4" />Cart</div>
              <Badge variant="secondary">{cart?.length || 0}</Badge>
            </div>
            {!cart?.length ? <p className="text-xs text-muted-foreground">Cart is empty.</p> :
              <div className="space-y-2">
                {cart.map((c: any) => (
                  <div key={c.id} className="flex items-center gap-2 text-sm border-b pb-2">
                    <div className="flex-1">
                      <div className="font-medium truncate">{c.vendx_franchise_catalog_items?.name}</div>
                      <div className="text-xs text-muted-foreground">${Number(c.vendx_franchise_catalog_items?.unit_price || 0).toFixed(2)} ea</div>
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateQty(c.id, c.quantity - 1)}><Minus className="h-3 w-3" /></Button>
                    <span className="w-6 text-center">{c.quantity}</span>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateQty(c.id, c.quantity + 1)}><Plus className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateQty(c.id, 0)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </div>
                ))}
                <Input placeholder="Shipping address" value={shipping} onChange={(e) => setShipping(e.target.value)} />
                <div className="flex justify-between font-bold pt-2 border-t">
                  <span>Total</span><span>${cartTotal.toFixed(2)}</span>
                </div>
                <Button className="w-full" onClick={checkout} disabled={!cart.length}>Place Order</Button>
              </div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FranchiseStorefront;
