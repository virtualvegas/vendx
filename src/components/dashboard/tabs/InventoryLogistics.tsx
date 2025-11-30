const InventoryLogistics = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Inventory & Logistics</h2>
        <p className="text-muted-foreground">
          Manage stock levels, shipments, and warehouse operations
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Total SKUs</h3>
          <p className="text-3xl font-bold text-foreground">2,847</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Active Shipments</h3>
          <p className="text-3xl font-bold text-foreground">156</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Low Stock Items</h3>
          <p className="text-3xl font-bold text-destructive">23</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Warehouse Status</h3>
        <div className="space-y-4">
          {[
            { name: "Main Warehouse - USA", capacity: 85, items: 12400 },
            { name: "Distribution Center - EU", capacity: 72, items: 8900 },
            { name: "Regional Hub - APAC", capacity: 64, items: 6200 },
          ].map((warehouse) => (
            <div key={warehouse.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-foreground font-medium">{warehouse.name}</span>
                <span className="text-sm text-muted-foreground">{warehouse.capacity}% capacity</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full"
                  style={{ width: `${warehouse.capacity}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground">{warehouse.items.toLocaleString()} items</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default InventoryLogistics;