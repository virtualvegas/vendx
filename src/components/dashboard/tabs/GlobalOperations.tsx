import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Activity, MapPin, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

  const { data: locations, isLoading: locationsLoading } = useQuery({
    queryKey: ["visible-locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .eq("is_visible", true)
        .eq("status", "active")
        .order("country", { ascending: true });
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

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Global Locations
          </h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {locationsLoading ? (
              <p className="text-sm text-muted-foreground">Loading locations...</p>
            ) : locations && locations.length > 0 ? (
              locations.map((location) => (
                <div key={location.id} className="flex items-start justify-between border-b border-border pb-3">
                  <div className="space-y-1">
                    <p className="font-semibold">{location.city}, {location.country}</p>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Activity className="h-3 w-3" />
                        {location.machine_count} machines
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {location.status}
                      </Badge>
                    </div>
                  </div>
                  <Check className="h-4 w-4 text-accent flex-shrink-0" />
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No locations available</p>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Active Divisions</h3>
          <div className="grid grid-cols-2 gap-4">
            {divisionsLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-muted rounded" />
                </div>
              ))
            ) : (
              divisions?.map((division) => (
                <div key={division.id} className="text-sm flex items-center gap-2">
                  <Check className="h-4 w-4 text-accent" />
                  <span className="font-medium text-foreground">{division.name}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default GlobalOperations;
