import { useParams, Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Smartphone, Maximize2, Apple, Monitor, Truck, Bot, Rocket } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";

const divisionData: Record<string, any> = {
  mini: {
    icon: Smartphone,
    name: "VendX Mini",
    tagline: "Big Innovation, Compact Design",
    description: "VendX Mini brings enterprise-grade vending technology to spaces where every square foot matters. Perfect for offices, gyms, and small retail locations.",
    features: [
      "Footprint: 2ft x 2ft x 5ft",
      "50+ product capacity",
      "Energy efficient: 50W average",
      "Contactless payment enabled",
      "Cloud-managed inventory",
      "Installation in under 2 hours"
    ],
    specs: {
      dimensions: "24\" W × 24\" D × 60\" H",
      weight: "250 lbs",
      power: "110-240V, 50W",
      capacity: "50 items",
      payment: "NFC, QR, Card, Crypto",
    },
    benefits: [
      "Fits in tight spaces",
      "Low power consumption",
      "Quick ROI",
      "24/7 automated sales"
    ]
  },
  max: {
    icon: Maximize2,
    name: "VendX Max",
    tagline: "Maximum Capacity, Maximum Performance",
    description: "The flagship VendX solution for high-traffic locations. VendX Max handles large inventories with advanced security and multiple payment systems.",
    features: [
      "Footprint: 4ft x 3ft x 7ft",
      "500+ product capacity",
      "Dual temperature zones",
      "Multi-touch 32\" display",
      "Advanced AI inventory prediction",
      "Remote diagnostics & updates"
    ],
    specs: {
      dimensions: "48\" W × 36\" D × 84\" H",
      weight: "850 lbs",
      power: "220-240V, 300W",
      capacity: "500+ items",
      payment: "All digital methods + cash",
    },
    benefits: [
      "Highest revenue potential",
      "Handles peak demand",
      "Premium customer experience",
      "Enterprise management tools"
    ]
  },
  fresh: {
    icon: Apple,
    name: "VendX Fresh",
    tagline: "Keep It Fresh, Keep It Smart",
    description: "Revolutionary temperature-controlled vending for fresh food, beverages, and perishables. FDA approved and food safety certified.",
    features: [
      "Dual-zone refrigeration (33°F - 45°F)",
      "Real-time temperature monitoring",
      "Humidity control systems",
      "Automatic expiration tracking",
      "Health code compliance alerts",
      "Fresh guarantee SLA"
    ],
    specs: {
      dimensions: "42\" W × 30\" D × 72\" H",
      weight: "650 lbs",
      power: "220-240V, 450W",
      capacity: "200 fresh items",
      payment: "Digital + Card",
    },
    benefits: [
      "FDA certified",
      "Reduces food waste",
      "Premium fresh products",
      "Automated safety compliance"
    ]
  },
  digital: {
    icon: Monitor,
    name: "VendX Digital",
    tagline: "Interactive. Engaging. Intelligent.",
    description: "Transform vending into an interactive brand experience. VendX Digital combines retail automation with digital signage and customer engagement.",
    features: [
      "4K 43\" touchscreen interface",
      "Dynamic content management",
      "Customer analytics dashboard",
      "Social media integration",
      "Gamification engine",
      "Advertising revenue platform"
    ],
    specs: {
      dimensions: "40\" W × 32\" D × 75\" H",
      weight: "550 lbs",
      power: "110-240V, 250W",
      capacity: "300 items",
      payment: "Full digital suite",
    },
    benefits: [
      "Additional ad revenue",
      "Enhanced customer engagement",
      "Brand storytelling",
      "Rich analytics"
    ]
  },
  logistics: {
    icon: Truck,
    name: "VendX Logistics",
    tagline: "Supply Chain Excellence",
    description: "The backbone of VendX operations. Our logistics division ensures optimal routing, inventory management, and automated restocking across the global network.",
    features: [
      "AI-powered route optimization",
      "Real-time inventory tracking",
      "Predictive restocking algorithms",
      "Fleet management system",
      "Carbon footprint optimization",
      "Integration with all VendX systems"
    ],
    specs: {
      coverage: "150+ countries",
      vehicles: "5,000+ fleet vehicles",
      warehouses: "200+ distribution centers",
      uptime: "99.9% SLA",
      response: "<4 hour restocking",
    },
    benefits: [
      "Maximized machine uptime",
      "Reduced operational costs",
      "Sustainability focused",
      "Seamless operations"
    ]
  },
  robotics: {
    icon: Bot,
    name: "VendX Robotics",
    tagline: "Autonomous. Adaptive. Advanced.",
    description: "Our robotics division develops autonomous systems for maintenance, environmental adaptation, and next-generation vending technology.",
    features: [
      "Self-diagnostic systems",
      "Predictive maintenance AI",
      "Autonomous repair modules",
      "Environmental adaptation",
      "Machine learning optimization",
      "Swarm intelligence networks"
    ],
    specs: {
      sensors: "50+ per machine",
      processing: "Edge AI compute",
      connectivity: "5G + Satellite",
      uptime: "99.95%",
      mtbf: ">100,000 hours",
    },
    benefits: [
      "Minimal downtime",
      "Reduced maintenance costs",
      "Continuous improvement",
      "Future-proof technology"
    ]
  },
  mars: {
    icon: Rocket,
    name: "VendX Mars Division",
    tagline: "First Retailer on the Red Planet",
    description: "Pioneering automated retail for space colonization. VendX Mars Division is developing vending solutions for extreme off-world environments.",
    features: [
      "Radiation-hardened electronics",
      "Low-gravity dispensing systems",
      "Life support integration",
      "Martian dust protection",
      "Solar + battery hybrid power",
      "Extreme temperature tolerance (-125°C to 20°C)"
    ],
    specs: {
      launch: "2028 target",
      environment: "Mars surface conditions",
      power: "Solar + RTG backup",
      capacity: "Essential supplies",
      status: "Development phase",
    },
    benefits: [
      "Space colonization support",
      "Essential supply distribution",
      "Technology testbed",
      "Future of humanity"
    ]
  }
};

const DivisionDetailPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const division = slug ? divisionData[slug] : null;

  useSEO({
    title: division ? `${division.name} — ${division.tagline}` : "Division Not Found",
    description: division?.description?.slice(0, 160) || "VendX Division Details",
  });

  if (!division) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Division Not Found</h1>
          <Link to="/divisions">
            <Button>Back to Divisions</Button>
          </Link>
        </div>
      </div>
    );
  }

  const Icon = division.icon;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="pt-32 pb-24">
        <div className="container mx-auto px-4">
          <Link to="/divisions">
            <Button variant="outline" className="mb-8 border-primary/30 hover:border-primary">
              <ArrowLeft className="mr-2 w-4 h-4" />
              Back to Divisions
            </Button>
          </Link>

          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16 space-y-6">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-accent/10 border-2 border-accent shadow-[0_0_30px_rgba(57,255,136,0.4)] mb-6">
                <Icon className="w-12 h-12 text-accent" />
              </div>
              
              <h1 className="text-6xl lg:text-7xl font-bold glow-blue">
                {division.name}
              </h1>
              
              <p className="text-2xl text-accent font-semibold">
                {division.tagline}
              </p>
              
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                {division.description}
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-12 mb-16">
              <div className="bg-card/40 backdrop-blur-sm border border-primary/30 rounded-2xl p-8">
                <h2 className="text-3xl font-bold mb-6 glow-green">Key Features</h2>
                <ul className="space-y-4">
                  {division.features.map((feature: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-accent flex-shrink-0 mt-0.5" />
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-card/40 backdrop-blur-sm border border-accent/30 rounded-2xl p-8">
                <h2 className="text-3xl font-bold mb-6">Technical Specs</h2>
                <div className="space-y-4">
                  {Object.entries(division.specs).map(([key, value]) => (
                    <div key={key} className="flex justify-between items-center border-b border-border/50 pb-3">
                      <span className="text-muted-foreground capitalize">{key.replace('_', ' ')}</span>
                      <span className="font-semibold text-foreground">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-gradient-space border border-primary/30 rounded-3xl p-12">
              <h2 className="text-4xl font-bold mb-8 text-center">
                Why Choose <span className="glow-green">{division.name}</span>?
              </h2>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {division.benefits.map((benefit: string, idx: number) => (
                  <div key={idx} className="bg-card/30 backdrop-blur-sm border border-accent/20 rounded-xl p-6 text-center">
                    <CheckCircle2 className="w-8 h-8 text-accent mx-auto mb-3" />
                    <p className="font-semibold">{benefit}</p>
                  </div>
                ))}
              </div>

              <div className="text-center space-y-4">
                <Button 
                  size="lg"
                  className="bg-accent hover:bg-accent/90 text-accent-foreground border-2 border-accent shadow-[0_0_20px_rgba(57,255,136,0.5)] hover:shadow-[0_0_30px_rgba(57,255,136,0.8)] transition-smooth text-lg px-12"
                >
                  Request a Quote
                </Button>
                <p className="text-sm text-muted-foreground">
                  Contact: <span className="text-accent">sales@vendx.space</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default DivisionDetailPage;
