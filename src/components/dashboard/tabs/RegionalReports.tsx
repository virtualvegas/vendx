const RegionalReports = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Regional Reports</h2>
        <p className="text-muted-foreground">
          View performance metrics by geographic region
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          { region: "North America", machines: 4200, revenue: 850000, growth: 12.4 },
          { region: "Europe", machines: 3800, revenue: 720000, growth: 8.7 },
          { region: "Asia Pacific", machines: 3100, revenue: 620000, growth: 15.2 },
          { region: "Latin America", machines: 1747, revenue: 210000, growth: 9.3 },
        ].map((data) => (
          <div key={data.region} className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">{data.region}</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active Machines</span>
                <span className="font-medium text-foreground">{data.machines.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monthly Revenue</span>
                <span className="font-medium text-foreground">
                  ${(data.revenue / 1000).toFixed(0)}K
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Growth Rate</span>
                <span className="font-medium text-primary">+{data.growth}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Top Performing Locations</h3>
        <div className="space-y-3">
          {[
            { city: "New York, USA", revenue: 145000 },
            { city: "London, UK", revenue: 132000 },
            { city: "Tokyo, Japan", revenue: 128000 },
            { city: "Berlin, Germany", revenue: 118000 },
          ].map((location) => (
            <div key={location.city} className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-foreground">{location.city}</span>
              <span className="text-muted-foreground font-medium">
                ${(location.revenue / 1000).toFixed(0)}K
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RegionalReports;