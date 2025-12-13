import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShoppingBag, Calendar, DollarSign, Package, Eye, Truck, Star } from "lucide-react";
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
          id,
          order_number,
          status,
          subtotal,
          shipping_cost,
          total,
          created_at,
          store_order_items (
            id,
            product_name,
            product_price,
            quantity,
            total,
            addon_details
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as StoreOrder[];
    },
  });

  // Fetch machine transactions  
  const { data: machineTransactions, isLoading: loadingMachine } = useQuery({
    queryKey: ["customer-machine-transactions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("machine_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  const totalStoreSpent = storeOrders?.reduce((sum, o) => sum + Number(o.total), 0) || 0;
  const totalMachineSpent = machineTransactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
  const totalPoints = machineTransactions?.reduce((sum, t) => sum + (t.points_earned || 0), 0) || 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid": return "bg-green-500/20 text-green-400";
      case "shipped": return "bg-blue-500/20 text-blue-400";
      case "delivered": return "bg-accent/20 text-accent";
      case "cancelled": return "bg-destructive/20 text-destructive";
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
          View your purchase history from VendX Store and machines
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              Store Orders
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
              Machine Purchases
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{machineTransactions?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-500" />
              Total Spent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${(totalStoreSpent + totalMachineSpent).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500" />
              Points Earned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{totalPoints.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="store" className="space-y-4">
        <TabsList>
          <TabsTrigger value="store">Store Orders</TabsTrigger>
          <TabsTrigger value="machine">Machine Purchases</TabsTrigger>
        </TabsList>

        <TabsContent value="store">
          <Card>
            <CardHeader>
              <CardTitle>Store Orders</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingStoreOrders ? (
                <p className="text-muted-foreground">Loading orders...</p>
              ) : storeOrders && storeOrders.length > 0 ? (
                <div className="space-y-4">
                  {storeOrders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-4 border border-border rounded-lg hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getStatusColor(order.status)}`}>
                          {getStatusIcon(order.status)}
                        </div>
                        <div>
                          <p className="font-medium text-foreground font-mono">
                            {order.order_number}
                          </p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(order.created_at), "MMM d, yyyy h:mm a")}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {order.store_order_items?.length || 0} item(s)
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold text-foreground">
                            ${Number(order.total).toFixed(2)}
                          </p>
                          <Badge className={getStatusColor(order.status)}>
                            {order.status}
                          </Badge>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => setSelectedOrder(order)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No store orders yet. Visit the VendX Store to start shopping!
                  </p>
                  <Button className="mt-4" onClick={() => window.location.href = "/store"}>
                    Browse Store
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="machine">
          <Card>
            <CardHeader>
              <CardTitle>Machine Purchases</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingMachine ? (
                <p className="text-muted-foreground">Loading transactions...</p>
              ) : machineTransactions && machineTransactions.length > 0 ? (
                <div className="space-y-4">
                  {machineTransactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-4 border border-border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <ShoppingBag className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {transaction.item_name || "Vending Purchase"}
                          </p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(transaction.created_at), "MMM d, yyyy h:mm a")}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-foreground">
                          ${Number(transaction.amount).toFixed(2)}
                        </p>
                        {transaction.points_earned > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            +{transaction.points_earned} pts
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <ShoppingBag className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No machine purchases yet. Use your VendX Pay at any machine!
                  </p>
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
                <Badge className={getStatusColor(selectedOrder.status)}>
                  {selectedOrder.status}
                </Badge>
              </div>
              
              <div className="border border-border rounded-lg divide-y divide-border">
                {selectedOrder.store_order_items?.map((item) => (
                  <div key={item.id} className="p-3 flex justify-between">
                    <div>
                      <p className="font-medium">{item.product_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Qty: {item.quantity} × ${Number(item.product_price).toFixed(2)}
                      </p>
                      {item.addon_details && Array.isArray(item.addon_details) && item.addon_details.length > 0 && (
                        <p className="text-xs text-accent">
                          + {(item.addon_details as any[]).map((a: any) => a.name).join(", ")}
                        </p>
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