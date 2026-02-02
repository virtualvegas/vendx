import { Bot, Headphones, Package, Wallet, ShieldCheck, Smartphone } from "lucide-react";

const features = [
  {
    icon: Bot,
    title: "AI-Powered",
    description: "Smart inventory management and demand prediction for optimal stocking",
  },
  {
    icon: Headphones,
    title: "24/7 Support",
    description: "Round-the-clock assistance whenever you need help",
  },
  {
    icon: Package,
    title: "Real-Time Tracking",
    description: "Monitor inventory levels and machine performance instantly",
  },
  {
    icon: Wallet,
    title: "Digital Payments",
    description: "Accept cards, mobile pay, VendX Pay, and more",
  },
  {
    icon: ShieldCheck,
    title: "Secure & Reliable",
    description: "Enterprise-grade security for all transactions",
  },
  {
    icon: Smartphone,
    title: "Mobile First",
    description: "Manage everything from your phone with our app",
  },
];

const Features = () => {
  return (
    <section className="py-20 relative">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12 space-y-4">
          <h2 className="text-4xl lg:text-5xl font-bold">
            Why Choose <span className="text-accent glow-green">VendX</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Next-generation technology meets unparalleled reliability
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group bg-card/30 backdrop-blur-sm border border-border hover:border-primary/50 rounded-2xl p-6 transition-smooth hover:shadow-[0_0_30px_rgba(26,124,255,0.2)] hover:-translate-y-1"
            >
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 border border-primary/30 group-hover:border-primary group-hover:shadow-[0_0_20px_rgba(26,124,255,0.4)] transition-smooth mb-5">
                <feature.icon className="w-7 h-7 text-primary" />
              </div>
              
              <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
