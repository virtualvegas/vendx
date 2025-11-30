const GlobalOperations = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Global Operations</h2>
        <p className="text-muted-foreground">
          Monitor worldwide VendX machine performance and operations
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Active Machines</h3>
          <p className="text-3xl font-bold text-foreground">12,847</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Daily Transactions</h3>
          <p className="text-3xl font-bold text-foreground">245,892</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Global Revenue</h3>
          <p className="text-3xl font-bold text-foreground">$2.4M</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Regional Performance</h3>
        <div className="space-y-3">
          {["North America", "Europe", "Asia Pacific", "Latin America"].map((region) => (
            <div key={region} className="flex items-center justify-between">
              <span className="text-foreground">{region}</span>
              <div className="flex items-center gap-4">
                <div className="w-32 bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full"
                    style={{ width: `${Math.random() * 100}%` }}
                  />
                </div>
                <span className="text-muted-foreground text-sm w-12 text-right">
                  {Math.floor(Math.random() * 100)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GlobalOperations;