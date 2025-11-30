import { Users, MapPin, TrendingUp, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const iconMap: Record<string, any> = {
  users: Users,
  map_pin: MapPin,
  trending_up: TrendingUp,
  calendar: Calendar,
};

const Stats = () => {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["metrics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metrics")
        .select("*")
        .order("display_order", { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });
  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-4">
        <div className="relative max-w-6xl mx-auto">
          <div className="absolute inset-0 bg-gradient-primary opacity-10 blur-3xl rounded-full" />
          
          <div className="relative bg-card/50 backdrop-blur-sm border-2 border-primary/30 rounded-3xl p-8 lg:p-16 shadow-[0_0_60px_rgba(26,124,255,0.3)]">
            <div className="text-center mb-12">
              <h2 className="text-5xl lg:text-6xl font-bold mb-4">
                Global <span className="glow-green">Impact</span>
              </h2>
              <p className="text-xl text-muted-foreground">
                Powering convenience across the planet
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="text-center space-y-4 animate-pulse">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted" />
                    <div className="h-12 bg-muted rounded w-24 mx-auto" />
                    <div className="h-4 bg-muted rounded w-32 mx-auto" />
                  </div>
                ))
              ) : (
                metrics?.map((metric, index) => {
                  const Icon = iconMap[metric.metric_type] || MapPin;
                  return (
                    <div
                      key={metric.id}
                      className="text-center space-y-4 group"
                    >
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border-2 border-primary group-hover:border-primary group-hover:shadow-[0_0_30px_rgba(26,124,255,0.6)] transition-smooth">
                        <Icon className="w-8 h-8 text-primary" />
                      </div>
                      
                      <div>
                        <div className="text-4xl lg:text-5xl font-bold glow-blue mb-2">
                          {metric.metric_value.toLocaleString()}
                          {metric.metric_label.includes("Countries") && "+"}
                        </div>
                        <div className="text-muted-foreground font-medium">
                          {metric.metric_label}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Stats;
