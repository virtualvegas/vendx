import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Link } from "react-router-dom";
import { Zap, Gamepad2, Monitor, Truck, Bot, Headphones, Megaphone, Wrench, PartyPopper, Smartphone, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
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

const DivisionsPage = () => {
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
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="pt-32 pb-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-16 space-y-6">
            <h1 className="text-6xl lg:text-7xl font-bold">
              Our <span className="glow-blue">Divisions</span>
            </h1>
            <p className="text-xl text-muted-foreground">
              Specialized solutions engineered for every environment and need
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {isLoading ? (
              Array.from({ length: 7 }).map((_, index) => (
                <div key={index} className="bg-card/40 backdrop-blur-sm border border-border rounded-2xl p-8 animate-pulse">
                  <div className="w-16 h-16 rounded-xl bg-muted mb-6" />
                  <div className="h-8 bg-muted rounded w-3/4 mb-3" />
                  <div className="h-4 bg-muted rounded w-full mb-6" />
                  <div className="space-y-2 mb-6">
                    <div className="h-4 bg-muted rounded w-2/3" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                    <div className="h-4 bg-muted rounded w-3/4" />
                  </div>
                  <div className="h-10 bg-muted rounded" />
                </div>
              ))
            ) : (
              divisions?.map((division) => {
                const Icon = iconMap[division.icon || "Zap"] || Zap;
                const features = Array.isArray(division.features) ? division.features : [];
                
                return (
                  <div
                    key={division.id}
                    className="group relative bg-card/40 backdrop-blur-sm border border-border hover:border-accent/50 rounded-2xl p-8 transition-smooth hover:shadow-[0_0_30px_rgba(57,255,136,0.2)] hover:-translate-y-2"
                  >
                    {division.status === "coming-soon" && (
                      <div className="absolute top-6 right-6">
                        <span className="text-xs font-bold text-accent border border-accent px-3 py-1 rounded-full bg-accent/10 animate-glow-pulse">
                          SOON
                        </span>
                      </div>
                    )}
                    
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-accent/10 border border-accent/30 group-hover:border-accent group-hover:shadow-[0_0_20px_rgba(57,255,136,0.4)] transition-smooth mb-6">
                      <Icon className="w-8 h-8 text-accent" />
                    </div>
                    
                    <h3 className="text-2xl font-bold mb-3">{division.name}</h3>
                    <p className="text-muted-foreground mb-6 leading-relaxed">
                      {division.description}
                    </p>

                    {features.length > 0 && (
                      <ul className="space-y-2 mb-6">
                        {features.map((feature: string, idx: number) => (
                          <li key={idx} className="text-sm text-foreground flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    )}

                    <Link to={`/divisions/${division.slug}`}>
                      <Button 
                        variant="outline"
                        className="w-full border-accent/30 text-accent hover:bg-accent hover:text-accent-foreground group/btn"
                      >
                        Learn More
                        <ArrowRight className="ml-2 w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                      </Button>
                    </Link>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default DivisionsPage;
