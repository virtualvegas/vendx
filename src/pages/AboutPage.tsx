import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Globe, Users, Award, TrendingUp } from "lucide-react";

const AboutPage = () => {
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
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary flex items-center justify-center flex-shrink-0">
                    <Globe className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Global Presence</h4>
                    <p className="text-sm text-muted-foreground">Operating in 150+ countries with 50,000+ machines worldwide</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent flex items-center justify-center flex-shrink-0">
                    <Users className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Team Excellence</h4>
                    <p className="text-sm text-muted-foreground">2,500+ employees across robotics, AI, and logistics</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary flex items-center justify-center flex-shrink-0">
                    <Award className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Industry Leader</h4>
                    <p className="text-sm text-muted-foreground">Recognized as the most innovative vending company for 5 consecutive years</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Sustainable Growth</h4>
                    <p className="text-sm text-muted-foreground">100% of new machines powered by renewable energy by 2026</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

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
