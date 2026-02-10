import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShoppingBag, Calendar, DollarSign, Package, Eye, Truck, Star, Gamepad2, Leaf, Zap } from "lucide-react";
import { format } from "date-fns";

interface OrderItem {
  id: string;
  product_name: string;
  product_price: number;
  quantity: number;
  total: number;
  addon_details: any;
}

interface StoreOrder {
  id: string;
  order_number: string;
  status: string;
  subtotal: number;
  shipping_cost: number;
  total: number;
  created_at: string;
  store_order_items: OrderItem[];
}

const CustomerOrders = () => {
  const [selectedOrder, setSelectedOrder] = useState<StoreOrder | null>(null);

  // Fetch store orders
  const { data: storeOrders, isLoading: loadingStoreOrders } = useQuery({
    queryKey: ["customer-store-orders"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("store_orders")
        .select(`
          id, order_number, status, subtotal, shipping_cost, total, created_at,
          store_order_items (id, product_name, product_price, quantity, total, addon_details)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as StoreOrder[];
    },
  });

  // Fetch machine transactions (vending)
  const { data: machineTransactions, isLoading: loadingMachine } = useQuery({
    queryKey: ["customer-machine-transactions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("machine_transactions")
        .select("*, vendx_machines(name, machine_code)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Fetch arcade play sessions
  const { data: arcadeSessions, isLoading: loadingArcade } = useQuery({
    queryKey: ["customer-arcade-sessions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("arcade_play_sessions")
        .select("*, vendx_machines(name, machine_code)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Fetch EcoSnack locker purchases
  const { data: ecosnackPurchases, isLoading: loadingEcosnack } = useQuery({
    queryKey: ["customer-ecosnack-purchases"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("ecosnack_locker_purchases")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Fetch recent point transactions for syncing
  const { data: pointTransactions } = useQuery({
    queryKey: ["customer-point-transactions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("point_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const totalStoreSpent = storeOrders?.reduce((sum, o) => sum + Number(o.total), 0) || 0;
  const totalMachineSpent = machineTransactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
  const totalArcadeSpent = arcadeSessions?.reduce((sum, s) => sum + Number(s.amount), 0) || 0;
  const totalEcosnackSpent = ecosnackPurchases?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  const totalSpent = totalStoreSpent + totalMachineSpent + totalArcadeSpent + totalEcosnackSpent;
  const totalPoints = machineTransactions?.reduce((sum, t) => sum + (t.points_earned || 0), 0) || 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid": case "completed": case "active": return "bg-green-500/20 text-green-400";
      case "shipped": return "bg-blue-500/20 text-blue-400";
      case "delivered": return "bg-accent/20 text-accent";
      case "cancelled": case "expired": return "bg-destructive/20 text-destructive";
      default: return "bg-yellow-500/20 text-yellow-400";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "shipped": return <Truck className="w-4 h-4" />;
      case "delivered": return <Package className="w-4 h-4" />;
      default: return <ShoppingBag className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">My Orders</h2>
        <p className="text-muted-foreground">
          All your purchases across VendX Store, machines, arcade, and EcoSnack
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-500" />
              Total Spent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${totalSpent.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              Store
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{storeOrders?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-accent" />
              Vending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{machineTransactions?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Gamepad2 className="w-4 h-4 text-purple-500" />
              Arcade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{arcadeSessions?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500" />
              Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{totalPoints.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="store" className="space-y-4">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="store">Store Orders</TabsTrigger>
          <TabsTrigger value="machine">Vending</TabsTrigger>
          <TabsTrigger value="arcade">Arcade</TabsTrigger>
          <TabsTrigger value="ecosnack">EcoSnack</TabsTrigger>
          <TabsTrigger value="points">Points Log</TabsTrigger>
        </TabsList>

        {/* Store Orders Tab */}
        <TabsContent value="store">
          <Card>
            <CardHeader><CardTitle>Store Orders</CardTitle></CardHeader>
            <CardContent>
              {loadingStoreOrders ? (
                <p className="text-muted-foreground">Loading orders...</p>
              ) : storeOrders && storeOrders.length > 0 ? (
                <div className="space-y-4">
                  {storeOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-4 border border-border rounded-lg hover:border-primary/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getStatusColor(order.status)}`}>
                          {getStatusIcon(order.status)}
                        </div>
                        <div>
                          <p className="font-medium text-foreground font-mono">{order.order_number}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(order.created_at), "MMM d, yyyy h:mm a")}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">{order.store_order_items?.length || 0} item(s)</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold text-foreground">${Number(order.total).toFixed(2)}</p>
                          <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setSelectedOrder(order)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No store orders yet.</p>
                  <Button className="mt-4" onClick={() => window.location.href = "/store"}>Browse Store</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Machine Purchases Tab */}
        <TabsContent value="machine">
          <Card>
            <CardHeader><CardTitle>Vending Machine Purchases</CardTitle></CardHeader>
            <CardContent>
              {loadingMachine ? (
                <p className="text-muted-foreground">Loading transactions...</p>
              ) : machineTransactions && machineTransactions.length > 0 ? (
                <div className="space-y-4">
                  {machineTransactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <ShoppingBag className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{tx.item_name || "Vending Purchase"}</p>
                          {tx.vendx_machines && (
                            <p className="text-xs text-muted-foreground">{(tx.vendx_machines as any).name} ({(tx.vendx_machines as any).machine_code})</p>
                          )}
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(tx.created_at), "MMM d, yyyy h:mm a")}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-foreground">${Number(tx.amount).toFixed(2)}</p>
                        {tx.points_earned > 0 && (
                          <Badge variant="secondary" className="text-xs">+{tx.points_earned} pts</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <ShoppingBag className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No machine purchases yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Arcade Sessions Tab */}
        <TabsContent value="arcade">
          <Card>
            <CardHeader><CardTitle>Arcade Play Sessions</CardTitle></CardHeader>
            <CardContent>
              {loadingArcade ? (
                <p className="text-muted-foreground">Loading sessions...</p>
              ) : arcadeSessions && arcadeSessions.length > 0 ? (
                <div className="space-y-4">
                  {arcadeSessions.map((session) => (
                    <div key={session.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-purple-500/10 rounded-full flex items-center justify-center">
                          <Gamepad2 className="w-5 h-5 text-purple-500" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {session.plays_purchased} Play{session.plays_purchased > 1 ? "s" : ""}
                            {session.pricing_type && <span className="text-muted-foreground ml-1">({session.pricing_type})</span>}
                          </p>
                          {session.vendx_machines && (
                            <p className="text-xs text-muted-foreground">{(session.vendx_machines as any).name}</p>
                          )}
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(session.created_at), "MMM d, yyyy h:mm a")}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-foreground">${Number(session.amount).toFixed(2)}</p>
                        <div className="flex items-center gap-2 justify-end mt-1">
                          <Badge className={getStatusColor(session.status)}>{session.status}</Badge>
                          {session.plays_used > 0 && (
                            <span className="text-xs text-muted-foreground">{session.plays_used}/{session.plays_purchased} used</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Gamepad2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No arcade sessions yet.</p>
                  <Button className="mt-4" onClick={() => window.location.href = "/games"}>Play Games</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* EcoSnack Tab */}
        <TabsContent value="ecosnack">
          <Card>
            <CardHeader><CardTitle>EcoSnack Locker Purchases</CardTitle></CardHeader>
            <CardContent>
              {loadingEcosnack ? (
                <p className="text-muted-foreground">Loading purchases...</p>
              ) : ecosnackPurchases && ecosnackPurchases.length > 0 ? (
                <div className="space-y-4">
                  {ecosnackPurchases.map((purchase) => {
                    const isRedeemed = !!purchase.redeemed_at;
                    const isExpired = !isRedeemed && new Date(purchase.expires_at) < new Date();
                    return (
                      <div key={purchase.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center">
                            <Leaf className="w-5 h-5 text-emerald-500" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{purchase.item_name}</p>
                            <p className="text-xs text-muted-foreground">
                              Locker #{purchase.locker_number} • Machine: {purchase.machine_code}
                            </p>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(purchase.created_at), "MMM d, yyyy h:mm a")}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-foreground">${Number(purchase.amount).toFixed(2)}</p>
                          {!isRedeemed && !isExpired && (
                            <div className="mt-1">
                              <Badge variant="outline" className="font-mono text-primary border-primary/30">
                                Code: {purchase.locker_code}
                              </Badge>
                            </div>
                          )}
                          <Badge className={isRedeemed ? "bg-green-500/20 text-green-400" : isExpired ? "bg-destructive/20 text-destructive" : "bg-yellow-500/20 text-yellow-400"}>
                            {isRedeemed ? "Redeemed" : isExpired ? "Expired" : "Active"}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Leaf className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No EcoSnack purchases yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Points Earning Log */}
        <TabsContent value="points">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                Rewards Points Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pointTransactions && pointTransactions.length > 0 ? (
                <div className="space-y-3">
                  {pointTransactions.map((pt) => (
                    <div key={pt.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${pt.points > 0 ? "bg-green-500/10" : "bg-red-500/10"}`}>
                          {pt.points > 0 ? <Star className="w-4 h-4 text-green-500" /> : <Star className="w-4 h-4 text-red-500" />}
                        </div>
                        <div>
                          <p className="font-medium text-sm text-foreground">{pt.description || pt.transaction_type}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(pt.created_at), "MMM d, yyyy h:mm a")}
                          </p>
                        </div>
                      </div>
                      <span className={`font-bold ${pt.points > 0 ? "text-green-500" : "text-red-500"}`}>
                        {pt.points > 0 ? "+" : ""}{pt.points} pts
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Star className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No points activity yet. Make purchases to earn rewards!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Order Details Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="font-mono text-sm">{selectedOrder.order_number}</span>
                <Badge className={getStatusColor(selectedOrder.status)}>{selectedOrder.status}</Badge>
              </div>
              <div className="border border-border rounded-lg divide-y divide-border">
                {selectedOrder.store_order_items?.map((item) => (
                  <div key={item.id} className="p-3 flex justify-between">
                    <div>
                      <p className="font-medium">{item.product_name}</p>
                      <p className="text-sm text-muted-foreground">Qty: {item.quantity} × ${Number(item.product_price).toFixed(2)}</p>
                      {item.addon_details && Array.isArray(item.addon_details) && item.addon_details.length > 0 && (
                        <p className="text-xs text-accent">+ {(item.addon_details as any[]).map((a: any) => a.name).join(", ")}</p>
                      )}
                    </div>
                    <p className="font-semibold">${Number(item.total).toFixed(2)}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${Number(selectedOrder.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>${Number(selectedOrder.shipping_cost || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t border-border pt-2">
                  <span>Total</span>
                  <span className="text-primary">${Number(selectedOrder.total).toFixed(2)}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Ordered on {format(new Date(selectedOrder.created_at), "MMMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerOrders;
