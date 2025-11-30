import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

const InventoryLogistics = () => {
  const { data: divisions } = useQuery({
    queryKey: ["inventory-divisions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("divisions")
        .select("*")
        .eq("status", "active");
      
      if (error) throw error;
      return data;
    },
  });

  const warehouses = [
    { name: "Main Warehouse - USA", capacity: 85, items: 12400, region: "North America" },
    { name: "Distribution Center - EU", capacity: 72, items: 8900, region: "Europe" },
    { name: "Regional Hub - APAC", capacity: 64, items: 6200, region: "Asia Pacific" },
  ];

  const lowStockItems = [
    { sku: "VXMINI-001", name: "VendX Mini Unit", quantity: 12, reorder: 50 },
    { sku: "VXFRESH-045", name: "Fresh Cooling Module", quantity: 8, reorder: 30 },
    { sku: "VXMAX-312", name: "Max Display Panel", quantity: 15, reorder: 40 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Inventory & Logistics</h2>
        <p className="text-muted-foreground">
          Manage stock levels, shipments, and warehouse operations
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Total SKUs</h3>
          <p className="text-3xl font-bold text-foreground">2,847</p>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Active Shipments</h3>
          <p className="text-3xl font-bold text-foreground">156</p>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Low Stock Items</h3>
          <p className="text-3xl font-bold text-destructive">{lowStockItems.length}</p>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Warehouse Status</h3>
        <div className="space-y-4">
          {warehouses.map((warehouse) => (
            <div key={warehouse.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-foreground font-medium">{warehouse.name}</span>
                <span className="text-sm text-muted-foreground">{warehouse.capacity}% capacity</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    warehouse.capacity > 80 ? "bg-destructive" : "bg-primary"
                  }`}
                  style={{ width: `${warehouse.capacity}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-sm">
                <p className="text-muted-foreground">{warehouse.items.toLocaleString()} items</p>
                <p className="text-muted-foreground">{warehouse.region}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6 border-destructive/50">
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="w-5 h-5 text-destructive" />
          <h3 className="text-lg font-semibold text-foreground">Low Stock Alert</h3>
        </div>
        <div className="space-y-3">
          {lowStockItems.map((item) => (
            <div key={item.sku} className="flex items-center justify-between py-2 border-b border-border">
              <div>
                <p className="font-medium text-foreground">{item.name}</p>
                <p className="text-sm text-muted-foreground">SKU: {item.sku}</p>
              </div>
              <div className="text-right">
                <p className="text-destructive font-bold">{item.quantity} units</p>
                <p className="text-sm text-muted-foreground">Reorder at {item.reorder}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Recent Shipments</h3>
          <div className="space-y-3">
            {[
              { id: "SH-2024-001", destination: "New York", status: "In Transit", eta: "2 days" },
              { id: "SH-2024-002", destination: "London", status: "Delivered", eta: "-" },
              { id: "SH-2024-003", destination: "Tokyo", status: "Processing", eta: "5 days" },
            ].map((shipment) => (
              <div key={shipment.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-foreground">{shipment.id}</p>
                  <p className="text-muted-foreground">{shipment.destination}</p>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    shipment.status === "Delivered" 
                      ? "bg-primary/10 text-primary"
                      : shipment.status === "In Transit"
                      ? "bg-accent/10 text-accent"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {shipment.status}
                  </span>
                  {shipment.eta !== "-" && (
                    <p className="text-muted-foreground mt-1">ETA: {shipment.eta}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Division Stock Levels</h3>
          <div className="space-y-3">
            {divisions?.slice(0, 5).map((division) => {
              const stock = Math.floor(Math.random() * 100) + 20;
              return (
                <div key={division.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{division.name}</span>
                  <span className={`font-medium ${
                    stock < 40 ? "text-destructive" : "text-foreground"
                  }`}>
                    {stock}%
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default InventoryLogistics;
