import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Cpu } from "lucide-react";

const fallbackMachines = [
  { id: "f1", name: "Smart Snack & Drink Vending", category: "Vending", description: "Cashless touchscreen vending with live inventory tracking and remote pricing.", image_url: null },
  { id: "f2", name: "EcoSnack Smart Lockers", category: "Lockers", description: "Grab-and-go fresh food lockers with code-based pickup.", image_url: null },
  { id: "f3", name: "Arcade Cabinets", category: "Arcade", description: "Classic and modern upright, racing and multi-game cabinets with digital tickets.", image_url: null },
  { id: "f4", name: "Claw & Prize Machines", category: "Prize", description: "Prize merchandisers with configurable payout rates and ticket redemption.", image_url: null },
  { id: "f5", name: "Custom-Built Machines", category: "Custom", description: "Branded machines designed by our artists around your business.", image_url: null },
];

export default function MachineCatalog() {
  const { data } = useQuery({
    queryKey: ["public-machine-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendx_franchise_catalog_items")
        .select("id,name,category,description,image_url")
        .eq("is_active", true)
        .eq("item_type", "machine")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
  const machines = data && data.length ? data : fallbackMachines;

  return (
    <section id="machine-catalog" className="py-24 relative bg-card/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <Badge className="mb-4 bg-primary/20 text-primary border-primary/30">Machine Catalog</Badge>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Machines We Offer</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Every machine is installed, stocked and serviced by VendX at no cost to qualifying locations.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {machines.map((m) => (
            <Card key={m.id} className="bg-card/50 border-border hover:border-primary/50 transition-colors overflow-hidden">
              <div className="aspect-video bg-muted/40 flex items-center justify-center">
                {m.image_url ? (
                  <img src={m.image_url} alt={m.name} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <Cpu className="w-12 h-12 text-primary/60" />
                )}
              </div>
              <CardContent className="p-6">
                {m.category && <Badge variant="outline" className="mb-2">{m.category}</Badge>}
                <h3 className="text-xl font-semibold mb-2">{m.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">{m.description}</p>
                <Button variant="outline" size="sm" asChild>
                  <a href="#contact-form">Request this machine</a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
