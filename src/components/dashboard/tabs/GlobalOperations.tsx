import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

const GlobalOperations = () => {
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["operations-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metrics")
        .select("*")
        .in("metric_type", ["map_pin", "trending_up", "users"]);
      
      if (error) throw error;
      return data;
    },
  });

  const { data: divisions, isLoading: divisionsLoading } = useQuery({
    queryKey: ["divisions-performance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("divisions")
        .select("*")
        .eq("status", "active");
      
      if (error) throw error;
      return data;
    },
  });

  const regions = [
    { name: "North America", performance: 87 },
    { name: "Europe", performance: 72 },
    { name: "Asia Pacific", performance: 91 },
    { name: "Latin America", performance: 64 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Global Operations</h2>
        <p className="text-muted-foreground">
          Monitor worldwide VendX machine performance and operations
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {metricsLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-6 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/2 mb-2" />
              <div className="h-8 bg-muted rounded w-2/3" />
            </Card>
          ))
        ) : (
          <>
            <Card className="p-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Active Machines</h3>
              <p className="text-3xl font-bold text-foreground">
                {metrics?.find(m => m.metric_type === "map_pin")?.metric_value.toLocaleString() || "0"}
              </p>
            </Card>
            <Card className="p-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Daily Transactions</h3>
              <p className="text-3xl font-bold text-foreground">245,892</p>
            </Card>
            <Card className="p-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Global Revenue</h3>
              <p className="text-3xl font-bold text-foreground">$2.4M</p>
            </Card>
          </>
        )}
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Regional Performance</h3>
        <div className="space-y-3">
          {regions.map((region) => (
            <div key={region.name} className="flex items-center justify-between">
              <span className="text-foreground">{region.name}</span>
              <div className="flex items-center gap-4">
                <div className="w-32 bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full"
                    style={{ width: `${region.performance}%` }}
                  />
                </div>
                <span className="text-muted-foreground text-sm w-12 text-right">
                  {region.performance}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Active Divisions</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {divisionsLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded" />
              </div>
            ))
          ) : (
            divisions?.map((division) => (
              <div key={division.id} className="text-sm">
                <span className="font-medium text-foreground">{division.name}</span>
                <span className="text-muted-foreground ml-2">✓</span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};

export default GlobalOperations;
