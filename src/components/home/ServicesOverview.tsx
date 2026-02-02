import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  Store, 
  Gamepad2, 
  MapPin, 
  Building2, 
  Package, 
  Wallet,
  ArrowRight,
  Sparkles
} from "lucide-react";

const services = [
  {
    icon: Store,
    title: "VendX Store",
    description: "Shop exclusive merchandise, subscription boxes, and premium snacks",
    href: "/store",
    color: "primary",
  },
  {
    icon: Gamepad2,
    title: "VendX Interactive",
    description: "Play our games across Steam, mobile, Roblox, and more platforms",
    href: "/games",
    color: "purple",
  },
  {
    icon: MapPin,
    title: "Find Machines",
    description: "Locate VendX vending machines and arcades near you",
    href: "/locations",
    color: "accent",
  },
  {
    icon: Building2,
    title: "Business Solutions",
    description: "Partner with us to bring vending to your business location",
    href: "/business",
    color: "blue",
  },
  {
    icon: Package,
    title: "Snack In The Box",
    description: "Monthly curated snack boxes delivered to your door",
    href: "/store/snack-in-the-box",
    color: "orange",
  },
  {
    icon: Wallet,
    title: "VendX Pay",
    description: "Digital wallet for seamless payments across all machines",
    href: "/wallet",
    color: "green",
  },
];

const colorClasses: Record<string, { border: string; icon: string; hover: string }> = {
  primary: {
    border: "border-primary/30 hover:border-primary/60",
    icon: "bg-primary/10 text-primary",
    hover: "hover:shadow-[0_0_30px_rgba(26,124,255,0.2)]",
  },
  purple: {
    border: "border-purple-500/30 hover:border-purple-500/60",
    icon: "bg-purple-500/10 text-purple-400",
    hover: "hover:shadow-[0_0_30px_rgba(168,85,247,0.2)]",
  },
  accent: {
    border: "border-accent/30 hover:border-accent/60",
    icon: "bg-accent/10 text-accent",
    hover: "hover:shadow-[0_0_30px_rgba(57,255,136,0.2)]",
  },
  blue: {
    border: "border-blue-500/30 hover:border-blue-500/60",
    icon: "bg-blue-500/10 text-blue-400",
    hover: "hover:shadow-[0_0_30px_rgba(59,130,246,0.2)]",
  },
  orange: {
    border: "border-orange-500/30 hover:border-orange-500/60",
    icon: "bg-orange-500/10 text-orange-400",
    hover: "hover:shadow-[0_0_30px_rgba(249,115,22,0.2)]",
  },
  green: {
    border: "border-green-500/30 hover:border-green-500/60",
    icon: "bg-green-500/10 text-green-400",
    hover: "hover:shadow-[0_0_30px_rgba(34,197,94,0.2)]",
  },
};

const ServicesOverview = () => {
  return (
    <section className="py-20 relative">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 text-accent text-sm font-semibold tracking-wider uppercase border border-accent/30 px-4 py-2 rounded-full bg-accent/10 mb-6">
            <Sparkles className="w-4 h-4" />
            Everything VendX
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold mb-4">
            Explore Our <span className="text-primary glow-blue">Ecosystem</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            From smart vending to gaming, we're building the future of automated retail and entertainment
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {services.map((service) => {
            const colors = colorClasses[service.color];
            return (
              <Link
                key={service.title}
                to={service.href}
                className={`group bg-card/40 backdrop-blur-sm border ${colors.border} rounded-2xl p-6 transition-all duration-300 ${colors.hover} hover:-translate-y-1`}
              >
                <div className={`inline-flex items-center justify-center w-14 h-14 rounded-xl ${colors.icon} mb-4`}>
                  <service.icon className="w-7 h-7" />
                </div>
                
                <h3 className="text-xl font-bold mb-2 group-hover:text-foreground transition-colors">
                  {service.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                  {service.description}
                </p>
                
                <div className="flex items-center text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  Learn more
                  <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ServicesOverview;
