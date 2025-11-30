import { Button } from "@/components/ui/button";
import { Rocket, Droplet, Wind, Wrench, Box } from "lucide-react";
import marsVending from "@/assets/mars-vending.jpg";

const marsProducts = [
  { icon: Wind, name: "Oxygen Tanks" },
  { icon: Droplet, name: "Water Supplies" },
  { icon: Box, name: "Food Rations" },
  { icon: Wrench, name: "Repair Tools" },
];

const MarsSection = () => {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-red-950/10 to-background" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-12">
          <div className="inline-block mb-6">
            <span className="text-accent text-sm font-semibold tracking-wider uppercase border border-accent px-4 py-2 rounded-full bg-accent/10 animate-glow-pulse">
              <Rocket className="inline-block w-4 h-4 mr-2" />
              Coming Soon
            </span>
          </div>
          
          <h2 className="text-5xl lg:text-7xl font-bold mb-6">
            First Retailer on <span className="glow-green">Mars</span>
          </h2>
          
          <p className="text-xl lg:text-2xl text-muted-foreground max-w-3xl mx-auto">
            When humanity reaches Mars, VendX will be there — providing essential supplies 
            for the first extraterrestrial colonies.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center max-w-7xl mx-auto mt-16">
          <div className="space-y-8">
            <div className="space-y-4">
              <h3 className="text-3xl font-bold">Mars Vending Catalog</h3>
              <p className="text-muted-foreground">
                Specialized products designed for the Martian environment
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {marsProducts.map((product, index) => (
                <div
                  key={index}
                  className="bg-card/40 backdrop-blur-sm border border-accent/30 rounded-xl p-6 hover:border-accent hover:shadow-[0_0_20px_rgba(57,255,136,0.3)] transition-smooth"
                >
                  <product.icon className="w-8 h-8 text-accent mb-3" />
                  <p className="font-semibold">{product.name}</p>
                </div>
              ))}
            </div>

            <Button 
              size="lg"
              className="group bg-accent hover:bg-accent/90 text-accent-foreground border-2 border-accent shadow-[0_0_20px_rgba(57,255,136,0.5)] hover:shadow-[0_0_30px_rgba(57,255,136,0.8)] transition-smooth text-lg px-8 py-6"
            >
              Learn About Mars Division
              <Rocket className="ml-2 group-hover:-translate-y-1 transition-transform" />
            </Button>
          </div>

          <div className="relative">
            <div className="relative animate-float">
              <img 
                src={marsVending} 
                alt="VendX vending machine on Mars"
                className="w-full h-auto rounded-2xl border-2 border-accent/50 shadow-[0_0_60px_rgba(57,255,136,0.4)]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MarsSection;
