import { Cpu, Zap, Shield, Music, Film, Gamepad2 } from "lucide-react";

const About = () => {
  return (
    <section className="py-20 relative">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12 space-y-4">
          <h2 className="text-4xl lg:text-5xl font-bold">
            About <span className="text-primary glow-blue">VendX</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            More than vending — we're building an ecosystem across retail, gaming, music, and film
          </p>
        </div>

        <div className="max-w-5xl mx-auto space-y-8">
          <div className="bg-card/50 backdrop-blur-sm border border-primary/20 rounded-2xl p-8 lg:p-10">
            <p className="text-lg text-foreground leading-relaxed mb-8">
              VendX is revolutionizing convenience with cutting-edge smart vending technology. 
              Our network combines AI-powered inventory management, digital payments, and real-time tracking 
              to deliver a seamless experience. Beyond vending, we're expanding into gaming, music, film, 
              and business solutions — creating an ecosystem that serves everyone.
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

          {/* Music & Film Section */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-card/50 backdrop-blur-sm border border-purple-500/30 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
                  <Music className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="text-2xl font-bold">VendX Music</h3>
              </div>
              <p className="text-foreground leading-relaxed mb-4">
                We help artists release music and support them with merch, CDs, and more. 
                We are <span className="text-purple-400 font-semibold">not a label</span> — we're here to help 
                artists get their music out and provide the tools they need to succeed.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  Music distribution across all platforms
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  Merch & CD production support
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  Beat marketplace for producers & artists
                </li>
              </ul>
            </div>

            <div className="bg-card/50 backdrop-blur-sm border border-red-500/30 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                  <Film className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="text-2xl font-bold">VendX Film</h3>
              </div>
              <p className="text-foreground leading-relaxed mb-4">
                We produce our own films and content with a dedicated in-house team. 
                From concept to screen, VendX Film brings original stories to life.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  Original film & series production
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  In-house creative team
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  Available on major streaming platforms
                </li>
              </ul>
            </div>
          </div>

          {/* Gaming Section */}
          <div className="bg-card/50 backdrop-blur-sm border border-accent/30 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center">
                <Gamepad2 className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-2xl font-bold">VendX Interactive</h3>
            </div>
            <p className="text-foreground leading-relaxed">
              Our gaming division develops and publishes games across Steam, mobile, Roblox, and arcade platforms. 
              From casual mobile games to full arcade experiences at our vending locations, VendX Interactive 
              brings entertainment everywhere we operate.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
