import { Users, MapPin, TrendingUp, Calendar, Zap, Shield, Building2, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const iconMap: Record<string, any> = {
  users: Users,
  map_pin: MapPin,
  trending_up: TrendingUp,
  calendar: Calendar,
  zap: Zap,
  shield: Shield,
  building: Building2,
  clock: Clock,
};

const Stats = () => {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["homepage-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metrics")
        .select("*")
        .in("metric_type", ["users", "map_pin", "trending_up", "calendar"])
        .order("display_order", { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  const formatValue = (value: number, label: string) => {
    if (label.toLowerCase().includes("uptime")) return `${value}%`;
    if (label.toLowerCase().includes("support") || label.toLowerCase().includes("24")) return `${value}/7`;
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value.toLocaleString();
  };

  return (
    <section className="py-20 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/5 to-background" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold mb-3">
            VendX <span className="text-primary">By The Numbers</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Growing every day to serve you better
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="text-center p-6 animate-pulse">
                <div className="w-12 h-12 rounded-xl bg-muted mx-auto mb-4" />
                <div className="h-8 bg-muted rounded w-20 mx-auto mb-2" />
                <div className="h-4 bg-muted rounded w-28 mx-auto" />
              </div>
            ))
          ) : (
            metrics?.map((metric) => {
              const Icon = iconMap[metric.metric_type] || MapPin;
              return (
                <div
                  key={metric.id}
                  className="group relative p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10"
                >
                  <div className="flex flex-col items-center text-center space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    
                    <div className="text-3xl lg:text-4xl font-bold text-foreground">
                      {formatValue(metric.metric_value, metric.metric_label)}
                      {metric.metric_label.includes("Countries") && "+"}
                    </div>
                    
                    <div className="text-sm text-muted-foreground font-medium">
                      {metric.metric_label}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
};

export default Stats;
