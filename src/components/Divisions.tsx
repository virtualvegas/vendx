import { Link } from "react-router-dom";
import { Zap, Gamepad2, Monitor, Truck, Bot, Headphones, Megaphone, Wrench, PartyPopper, Smartphone } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  Zap: Zap,
  Gamepad2: Gamepad2,
  Monitor: Monitor,
  Truck: Truck,
  Bot: Bot,
  Headphones: Headphones,
  Megaphone: Megaphone,
  Wrench: Wrench,
  PartyPopper: PartyPopper,
  Smartphone: Smartphone,
};

const Divisions = () => {
  const { data: divisions, isLoading } = useQuery({
    queryKey: ["divisions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("divisions")
        .select("*")
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });
  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-5xl lg:text-6xl font-bold">
            Our <span className="glow-blue">Divisions</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Specialized solutions for every environment and need
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {isLoading ? (
            Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="bg-card/40 backdrop-blur-sm border border-border rounded-2xl p-6 animate-pulse">
                <div className="w-14 h-14 rounded-xl bg-muted mb-4" />
                <div className="h-6 bg-muted rounded w-3/4 mb-2" />
                <div className="h-4 bg-muted rounded w-full" />
              </div>
            ))
          ) : (
            divisions?.map((division, index) => {
              const Icon = iconMap[division.icon || "Zap"] || Zap;
              return (
                <Link
                  key={division.id}
                  to={`/divisions/${division.slug}`}
                  className="group relative bg-card/40 backdrop-blur-sm border border-border hover:border-accent/50 rounded-2xl p-6 transition-smooth hover:shadow-[0_0_30px_rgba(57,255,136,0.2)] hover:-translate-y-2 block"
                >
                  {division.status === "coming-soon" && (
                    <div className="absolute top-4 right-4">
                      <span className="text-xs font-bold text-accent border border-accent px-2 py-1 rounded-full bg-accent/10 animate-glow-pulse">
                        SOON
                      </span>
                    </div>
                  )}
                  
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-accent/10 border border-accent/30 group-hover:border-accent group-hover:shadow-[0_0_20px_rgba(57,255,136,0.4)] transition-smooth mb-4">
                    <Icon className="w-7 h-7 text-accent" />
                  </div>
                  
                  <h3 className="text-xl font-bold mb-2">{division.name}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{division.description}</p>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
};

export default Divisions;
