const Finance = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Finance & Accounting</h2>
        <p className="text-muted-foreground">
          Track revenue, expenses, and financial performance
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Monthly Revenue</h3>
          <p className="text-3xl font-bold text-foreground">$847K</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Operating Costs</h3>
          <p className="text-3xl font-bold text-foreground">$324K</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Net Profit</h3>
          <p className="text-3xl font-bold text-primary">$523K</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Profit Margin</h3>
          <p className="text-3xl font-bold text-foreground">61.7%</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Revenue by Division</h3>
        <div className="space-y-4">
          {[
            { name: "VendX Mini", revenue: 245000 },
            { name: "VendX Max", revenue: 312000 },
            { name: "VendX Fresh", revenue: 178000 },
            { name: "VendX Digital", revenue: 112000 },
          ].map((division) => (
            <div key={division.name} className="flex items-center justify-between">
              <span className="text-foreground">{division.name}</span>
              <span className="text-muted-foreground font-medium">
                ${(division.revenue / 1000).toFixed(0)}K
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Finance;