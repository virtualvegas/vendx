import { Link } from "react-router-dom";
import { Smartphone, Maximize2, Apple, Monitor, Truck, Bot, Rocket } from "lucide-react";

const divisions = [
  {
    icon: Smartphone,
    name: "VendX Mini",
    slug: "mini",
    description: "Compact solutions for tight spaces",
    status: "active",
  },
  {
    icon: Maximize2,
    name: "VendX Max",
    slug: "max",
    description: "Large-scale retail automation",
    status: "active",
  },
  {
    icon: Apple,
    name: "VendX Fresh",
    slug: "fresh",
    description: "Temperature-controlled food & beverage",
    status: "active",
  },
  {
    icon: Monitor,
    name: "VendX Digital",
    slug: "digital",
    description: "Interactive touchscreen experiences",
    status: "active",
  },
  {
    icon: Truck,
    name: "VendX Logistics",
    slug: "logistics",
    description: "Supply chain & distribution network",
    status: "active",
  },
  {
    icon: Bot,
    name: "VendX Robotics",
    slug: "robotics",
    description: "Autonomous maintenance & restocking",
    status: "active",
  },
  {
    icon: Rocket,
    name: "VendX Mars Division",
    slug: "mars",
    description: "Off-world retail solutions",
    status: "coming-soon",
  },
];

const Divisions = () => {
  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-5xl lg:text-6xl font-bold">
            Our <span className="glow-blue">Divisions</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Specialized solutions for every environment and need
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {divisions.map((division, index) => (
            <Link
              key={index}
              to={`/divisions/${division.slug}`}
              className="group relative bg-card/40 backdrop-blur-sm border border-border hover:border-accent/50 rounded-2xl p-6 transition-smooth hover:shadow-[0_0_30px_rgba(57,255,136,0.2)] hover:-translate-y-2 block"
            >
              {division.status === "coming-soon" && (
                <div className="absolute top-4 right-4">
                  <span className="text-xs font-bold text-accent border border-accent px-2 py-1 rounded-full bg-accent/10 animate-glow-pulse">
                    SOON
                  </span>
                </div>
              )}
              
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-accent/10 border border-accent/30 group-hover:border-accent group-hover:shadow-[0_0_20px_rgba(57,255,136,0.4)] transition-smooth mb-4">
                <division.icon className="w-7 h-7 text-accent" />
              </div>
              
              <h3 className="text-xl font-bold mb-2">{division.name}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{division.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Divisions;
