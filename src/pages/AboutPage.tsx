import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Globe, Users, Award, TrendingUp, LucideIcon, Package, Gamepad2, Coins, Candy, CreditCard, Smartphone, DollarSign, Wrench, BarChart3, Shield, Clock, Star, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusinessServices } from "@/hooks/useBusinessContent";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const iconConfig: Record<number, { icon: LucideIcon; colorClass: string }> = {
  1: { icon: Globe, colorClass: "bg-primary/10 border-primary text-primary" },
  2: { icon: Users, colorClass: "bg-accent/10 border-accent text-accent" },
  3: { icon: Award, colorClass: "bg-primary/10 border-primary text-primary" },
  4: { icon: TrendingUp, colorClass: "bg-accent/10 border-accent text-accent" },
};

const serviceIconMap: Record<string, LucideIcon> = {
  Package, Gamepad2, Coins, Candy, CreditCard, Smartphone,
  DollarSign, Wrench, BarChart3, Shield, Clock, Star, TrendingUp
};

const highlightDescriptions: Record<string, string> = {
  "Countries Operating In": "Operating in {value}+ countries with machines worldwide",
  "Machines Worldwide": "Over {value}+ machines deployed globally",
  "Team Members": "{value}+ employees across robotics, AI, and logistics",
  "Years Industry Leader": "Recognized as the most innovative vending company for {value} consecutive years",
};

const AboutPage = () => {
  const { data: highlights, isLoading } = useQuery({
    queryKey: ["about-highlights"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metrics")
        .select("*")
        .eq("metric_type", "about_highlight")
        .order("display_order", { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: services } = useBusinessServices();

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="pt-32 pb-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-16 space-y-6">
            <h1 className="text-6xl lg:text-7xl font-bold">
              About <span className="glow-blue">VendX</span>
            </h1>
            <p className="text-xl text-muted-foreground">
              Pioneering the future of automated retail across Earth and beyond
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 max-w-6xl mx-auto mb-24">
            <div className="space-y-6">
              <h2 className="text-4xl font-bold glow-green">Our Mission</h2>
              <p className="text-lg text-foreground leading-relaxed">
                VendX was founded with a singular vision: to revolutionize the vending industry 
                through cutting-edge technology, artificial intelligence, and sustainable practices. 
                We're not just building vending machines—we're creating an intelligent, interconnected 
                network that spans the globe and prepares for humanity's expansion into space.
              </p>
              <p className="text-lg text-foreground leading-relaxed">
                Our commitment to innovation drives us to constantly push boundaries, from AI-powered 
                inventory management to solar-powered operations, ensuring we provide unparalleled 
                convenience while minimizing environmental impact.
              </p>
            </div>

            <div className="bg-card/40 backdrop-blur-sm border border-primary/30 rounded-2xl p-8 space-y-6">
              <h3 className="text-2xl font-bold">Company Highlights</h3>
              <div className="space-y-4">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, idx) => (
                    <div key={idx} className="flex items-start gap-4 animate-pulse">
                      <div className="w-12 h-12 rounded-full bg-muted flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded w-1/3" />
                        <div className="h-3 bg-muted rounded w-2/3" />
                      </div>
                    </div>
                  ))
                ) : (
                  highlights?.map((highlight, idx) => {
                    const config = iconConfig[highlight.display_order || idx + 1] || iconConfig[1];
                    const Icon = config.icon;
                    const description = highlightDescriptions[highlight.metric_label]?.replace(
                      "{value}",
                      highlight.metric_value.toLocaleString()
                    ) || `${highlight.metric_value.toLocaleString()}+ ${highlight.metric_label}`;
                    
                    return (
                      <div key={highlight.id} className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-full border flex items-center justify-center flex-shrink-0 ${config.colorClass}`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-semibold mb-1">{highlight.metric_label}</h4>
                          <p className="text-sm text-muted-foreground">{description}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Services Section */}
          {services && services.length > 0 && (
            <div className="max-w-6xl mx-auto mb-24">
              <h2 className="text-4xl font-bold text-center mb-12">
                Our <span className="glow-blue">Services</span>
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {services.slice(0, 6).map((service) => {
                  const IconComponent = serviceIconMap[service.icon] || Package;
                  return (
                    <div key={service.id} className="bg-card/40 border border-border hover:border-primary/50 rounded-xl p-6 transition-all">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center mb-4">
                        <IconComponent className="w-6 h-6 text-primary" />
                      </div>
                      <h3 className="text-lg font-bold mb-2">{service.title}</h3>
                      <p className="text-muted-foreground text-sm">{service.description}</p>
                    </div>
                  );
                })}
              </div>
              <div className="text-center mt-8">
                <Link to="/business">
                  <Button className="bg-primary hover:bg-primary/90">
                    Learn More About Partnering
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          )}

          <div className="max-w-6xl mx-auto bg-gradient-space border border-primary/30 rounded-3xl p-12 text-center">
            <h2 className="text-4xl font-bold mb-6">
              Join Us on Our <span className="glow-green">Journey</span>
            </h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
              From Earth to Mars, VendX is redefining what's possible in automated retail. 
              Be part of the future of convenience.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AboutPage;
