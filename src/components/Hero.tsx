import { Button } from "@/components/ui/button";
import { ChevronRight, Rocket } from "lucide-react";
import heroVending from "@/assets/hero-vending.jpg";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-gradient-space opacity-60" />
      
      <div className="container mx-auto px-4 z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8 animate-in fade-in slide-in-from-left duration-1000">
            <div className="inline-block">
              <span className="text-accent text-sm font-semibold tracking-wider uppercase border border-accent/30 px-4 py-2 rounded-full bg-accent/10">
                VendX.space
              </span>
            </div>
            
            <h1 className="text-6xl lg:text-7xl xl:text-8xl font-bold leading-tight">
              <span className="glow-blue">VendX</span>
              <br />
              <span className="text-foreground">The Future of</span>
              <br />
              <span className="glow-green">Vending.</span>
            </h1>
            
            <p className="text-xl lg:text-2xl text-muted-foreground max-w-2xl">
              Automating convenience across Earth… and beyond.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                size="lg" 
                className="group bg-primary hover:bg-primary/90 text-primary-foreground border-2 border-primary shadow-[0_0_20px_rgba(26,124,255,0.5)] hover:shadow-[0_0_30px_rgba(26,124,255,0.8)] transition-smooth text-lg px-8 py-6"
              >
                Explore Our Machines
                <ChevronRight className="ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              
              <Button 
                size="lg" 
                variant="outline"
                className="group border-2 border-accent text-accent hover:bg-accent hover:text-accent-foreground shadow-[0_0_20px_rgba(57,255,136,0.3)] hover:shadow-[0_0_30px_rgba(57,255,136,0.6)] transition-smooth text-lg px-8 py-6"
              >
                <Rocket className="mr-2 group-hover:-translate-y-1 transition-transform" />
                Join the VendX Network
              </Button>
            </div>
          </div>
          
          <div className="relative animate-in fade-in slide-in-from-right duration-1000 delay-300">
            <div className="relative animate-float">
              <img 
                src={heroVending} 
                alt="Futuristic VendX vending machine"
                className="w-full h-auto rounded-2xl border-2 border-primary/30 shadow-[0_0_50px_rgba(26,124,255,0.4)]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
