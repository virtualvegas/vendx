import { Bot, Headphones, Package, Wallet, Battery, Cog } from "lucide-react";

const features = [
  {
    icon: Bot,
    title: "Smart AI-Powered",
    description: "Advanced machine learning optimizes inventory and predicts demand",
  },
  {
    icon: Headphones,
    title: "24/7 Global Support",
    description: "Round-the-clock assistance across all time zones",
  },
  {
    icon: Package,
    title: "Real-Time Tracking",
    description: "Monitor inventory levels and performance metrics instantly",
  },
  {
    icon: Wallet,
    title: "Digital & Crypto Payments",
    description: "Accept all payment methods including cryptocurrency",
  },
  {
    icon: Battery,
    title: "Solar-Powered",
    description: "Sustainable energy solutions for any environment",
  },
  {
    icon: Cog,
    title: "Modular Robotics",
    description: "Adaptable systems designed for extreme conditions",
  },
];

const Features = () => {
  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-5xl lg:text-6xl font-bold">
            Why Choose <span className="glow-green">VendX</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Next-generation technology meets unparalleled reliability
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group bg-card/30 backdrop-blur-sm border border-border hover:border-primary/50 rounded-2xl p-8 transition-smooth hover:shadow-[0_0_30px_rgba(26,124,255,0.2)] hover:-translate-y-2"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-primary/10 border border-primary/30 group-hover:border-primary group-hover:shadow-[0_0_20px_rgba(26,124,255,0.4)] transition-smooth mb-6">
                <feature.icon className="w-8 h-8 text-primary" />
              </div>
              
              <h3 className="text-2xl font-bold mb-3">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
