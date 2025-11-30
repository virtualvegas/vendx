import { Globe, Moon, Rocket } from "lucide-react";

const About = () => {
  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-5xl lg:text-6xl font-bold">
            About <span className="glow-blue">VendX</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Building the world's largest automated retail network, powered by AI robotics and sustainable energy.
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          <div className="bg-card/50 backdrop-blur-sm border border-primary/20 rounded-2xl p-8 lg:p-12 space-y-8">
            <p className="text-lg text-foreground leading-relaxed">
              VendX is revolutionizing the vending industry with cutting-edge technology, 
              AI-powered automation, and a vision that extends beyond Earth. Our global network 
              of smart vending machines provides 24/7 convenience with real-time inventory tracking, 
              digital payments, and solar-powered sustainability.
            </p>

            <div className="border-t border-border pt-8">
              <h3 className="text-2xl font-bold mb-8 text-center">
                Expansion <span className="glow-green">Roadmap</span>
              </h3>
              
              <div className="grid md:grid-cols-3 gap-8">
                <div className="text-center space-y-4 group">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 border-2 border-primary group-hover:border-primary group-hover:shadow-[0_0_30px_rgba(26,124,255,0.6)] transition-smooth">
                    <Globe className="w-10 h-10 text-primary" />
                  </div>
                  <h4 className="text-xl font-bold">Earth</h4>
                  <p className="text-muted-foreground">Global coverage across 150+ countries</p>
                </div>

                <div className="text-center space-y-4 group">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted/50 border-2 border-muted-foreground/30 group-hover:border-muted-foreground group-hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-smooth">
                    <Moon className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <h4 className="text-xl font-bold">Moon</h4>
                  <p className="text-muted-foreground">Research stations in development</p>
                </div>

                <div className="text-center space-y-4 group">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-accent/10 border-2 border-accent group-hover:border-accent group-hover:shadow-[0_0_30px_rgba(57,255,136,0.6)] transition-smooth animate-glow-pulse">
                    <Rocket className="w-10 h-10 text-accent" />
                  </div>
                  <h4 className="text-xl font-bold glow-green">Mars</h4>
                  <p className="text-muted-foreground">First retailer on the red planet</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
