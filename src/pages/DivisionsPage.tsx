import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Link } from "react-router-dom";
import { Smartphone, Maximize2, Apple, Monitor, Truck, Bot, Rocket, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const divisions = [
  {
    icon: Smartphone,
    name: "VendX Mini",
    slug: "mini",
    description: "Compact solutions designed for tight spaces without compromising functionality",
    features: ["Space-efficient design", "Perfect for offices", "Quick installation"],
    status: "active",
  },
  {
    icon: Maximize2,
    name: "VendX Max",
    slug: "max",
    description: "Large-scale retail automation for high-traffic locations and diverse inventory",
    features: ["High capacity", "Multiple payment methods", "Advanced security"],
    status: "active",
  },
  {
    icon: Apple,
    name: "VendX Fresh",
    slug: "fresh",
    description: "Temperature-controlled systems for food, beverages, and perishable items",
    features: ["Climate control", "Food safety certified", "Fresh guarantee"],
    status: "active",
  },
  {
    icon: Monitor,
    name: "VendX Digital",
    slug: "digital",
    description: "Interactive touchscreen experiences with digital content and advertising",
    features: ["Interactive displays", "Dynamic content", "Analytics dashboard"],
    status: "active",
  },
  {
    icon: Truck,
    name: "VendX Logistics",
    slug: "logistics",
    description: "Comprehensive supply chain and distribution network management",
    features: ["Real-time tracking", "Route optimization", "Automated restocking"],
    status: "active",
  },
  {
    icon: Bot,
    name: "VendX Robotics",
    slug: "robotics",
    description: "Autonomous maintenance, restocking, and environmental adaptation systems",
    features: ["AI-powered", "Self-maintaining", "Predictive analytics"],
    status: "active",
  },
  {
    icon: Rocket,
    name: "VendX Mars Division",
    slug: "mars",
    description: "Off-world retail solutions for space colonization and extreme environments",
    features: ["Radiation shielded", "Low gravity adapted", "Life support integration"],
    status: "coming-soon",
  },
];

const DivisionsPage = () => {
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
            {divisions.map((division) => (
              <div
                key={division.slug}
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
                  <division.icon className="w-8 h-8 text-accent" />
                </div>
                
                <h3 className="text-2xl font-bold mb-3">{division.name}</h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  {division.description}
                </p>

                <ul className="space-y-2 mb-6">
                  {division.features.map((feature, idx) => (
                    <li key={idx} className="text-sm text-foreground flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                      {feature}
                    </li>
                  ))}
                </ul>

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
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default DivisionsPage;
