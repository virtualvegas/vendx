import { Cpu, Zap, Shield } from "lucide-react";

const About = () => {
  return (
    <section className="py-20 relative">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12 space-y-4">
          <h2 className="text-4xl lg:text-5xl font-bold">
            About <span className="text-primary glow-blue">VendX</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Building the future of automated retail with smart technology and innovation
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          <div className="bg-card/50 backdrop-blur-sm border border-primary/20 rounded-2xl p-8 lg:p-10">
            <p className="text-lg text-foreground leading-relaxed mb-8">
              VendX is revolutionizing convenience with cutting-edge smart vending technology. 
              Our network combines AI-powered inventory management, digital payments, and real-time tracking 
              to deliver a seamless experience. Beyond vending, we're expanding into gaming, retail, and 
              business solutions — creating an ecosystem that serves everyone.
            </p>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="flex items-start gap-4 p-4 rounded-xl bg-primary/5 border border-primary/20">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Cpu className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-1">Smart Technology</h4>
                  <p className="text-sm text-muted-foreground">AI-powered machines with real-time monitoring</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-xl bg-accent/5 border border-accent/20">
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-1">Instant Access</h4>
                  <p className="text-sm text-muted-foreground">24/7 availability with digital payments</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-xl bg-purple-500/5 border border-purple-500/20">
                <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-1">Reliable Service</h4>
                  <p className="text-sm text-muted-foreground">Dedicated support and quality products</p>
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
