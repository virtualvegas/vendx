import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

const RegionalReports = () => {
  const { data: metrics } = useQuery({
    queryKey: ["regional-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metrics")
        .select("*")
        .eq("metric_type", "users");
      
      if (error) throw error;
      return data;
    },
  });

  const regions = [
    { region: "North America", machines: 3200, revenue: 892000, growth: 12.3, countries: 3 },
    { region: "Europe", machines: 2800, revenue: 764000, growth: 8.7, countries: 24 },
    { region: "Asia Pacific", machines: 4100, revenue: 1124000, growth: 24.1, countries: 15 },
    { region: "Latin America", machines: 1200, revenue: 324000, growth: 15.8, countries: 18 },
    { region: "Middle East", machines: 900, revenue: 248000, growth: 19.2, countries: 12 },
  ];

  const totalRegions = regions.length;
  const topPerformer = regions.reduce((max, r) => r.growth > max.growth ? r : max, regions[0]);
  const averageGrowth = (regions.reduce((sum, r) => sum + r.growth, 0) / regions.length).toFixed(1);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Regional Reports</h2>
        <p className="text-muted-foreground">
          Performance metrics and insights by geographic region
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Total Regions</h3>
          <p className="text-3xl font-bold text-foreground">{totalRegions}</p>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Top Performer</h3>
          <p className="text-xl font-bold text-foreground">{topPerformer.region}</p>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Total Countries</h3>
          <p className="text-3xl font-bold text-foreground">
            {metrics?.[0]?.metric_value || regions.reduce((sum, r) => sum + r.countries, 0)}
          </p>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Avg Growth Rate</h3>
          <p className="text-3xl font-bold text-primary">+{averageGrowth}%</p>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Regional Performance</h3>
        <div className="space-y-4">
          {regions.map((region) => (
            <div key={region.region} className="border-b border-border pb-3">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-foreground">{region.region}</p>
                <span className="text-sm text-primary font-medium">+{region.growth}%</span>
              </div>
              <div className="flex gap-6 text-sm text-muted-foreground">
                <span>{region.machines.toLocaleString()} machines</span>
                <span>${(region.revenue / 1000).toFixed(0)}K revenue</span>
                <span>{region.countries} countries</span>
              </div>
              <div className="mt-2 w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full"
                  style={{ width: `${Math.min(region.growth * 3, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Market Penetration</h3>
          <div className="space-y-3">
            {regions.map((region) => {
              const penetration = Math.floor((region.machines / region.countries) / 100);
              return (
                <div key={`penetration-${region.region}`} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{region.region}</span>
                  <span className="text-muted-foreground">
                    {penetration} machines/country
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Revenue Distribution</h3>
          <div className="space-y-3">
            {regions.map((region) => {
              const totalRevenue = regions.reduce((sum, r) => sum + r.revenue, 0);
              const percentage = ((region.revenue / totalRevenue) * 100).toFixed(1);
              return (
                <div key={`revenue-${region.region}`} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{region.region}</span>
                    <span className="text-muted-foreground">{percentage}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default RegionalReports;
