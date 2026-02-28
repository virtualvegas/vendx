import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSEO } from "@/hooks/useSEO";
import {
  Monitor, Gamepad2, Eye, BarChart3, Calendar, Shield,
  Megaphone, TrendingUp, Palette, DollarSign, Users, Zap,
} from "lucide-react";

const features = [
  {
    icon: Monitor,
    title: "Machine Screen Ads",
    description: "Display dynamic ads on VendX machine screens across all locations. Reach customers at the point of purchase.",
  },
  {
    icon: Palette,
    title: "Machine Wraps",
    description: "Full-body branded wraps on VendX machines for maximum physical visibility and brand presence.",
  },
  {
    icon: Gamepad2,
    title: "In-Game Advertising",
    description: "Place banners and interstitials inside VendX Interactive games for immersive brand engagement.",
  },
  {
    icon: Eye,
    title: "Real-Time View Tracking",
    description: "Monitor estimated and actual impressions, clicks, and CTR with detailed performance analytics.",
  },
  {
    icon: Calendar,
    title: "Flexible Booking",
    description: "Book ad placements weekly or monthly. Schedule campaigns ahead of time to lock in your preferred slots.",
  },
  {
    icon: BarChart3,
    title: "Performance Dashboard",
    description: "Track campaign performance with period-by-period breakdowns of views, engagement, and ROI.",
  },
  {
    icon: Shield,
    title: "Admin-Approved Placements",
    description: "All ad bookings go through an approval process to ensure quality and brand safety standards.",
  },
  {
    icon: Palette,
    title: "Branded Game Seasons",
    description: "Request a custom branded game season — reskin existing titles or commission a fully custom experience.",
  },
  {
    icon: DollarSign,
    title: "Transparent Pricing",
    description: "Clear weekly and monthly rates per ad location with upfront cost calculations before booking.",
  },
];

const stats = [
  { value: "500K+", label: "Weekly Impressions" },
  { value: "200+", label: "Ad Locations" },
  { value: "95%", label: "Approval Rate" },
  { value: "3.2x", label: "Avg. ROI" },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const AdReachPage = () => {
  useSEO({
    title: "VendX AdReach — Advertise on Machines & Games",
    description: "Reach customers at the point of purchase with VendX AdReach. Place ads on machine screens, wraps, and inside games with real-time analytics.",
  });

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--neon-blue)/0.15),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(var(--neon-green)/0.08),transparent_50%)]" />

        <div className="container mx-auto px-4 relative z-10 text-center max-w-4xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 mb-6">
              <Megaphone className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-medium">VendX AdReach</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Advertise Where{" "}
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>
                Customers Buy
              </span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Place your brand on VendX machine screens, physical wraps, and inside interactive games. 
              Reach customers at the point of purchase with measurable, high-impact ad placements.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auth">
                <Button size="lg" className="text-lg px-8 py-6">
                  <Users className="w-5 h-5 mr-2" />
                  Get Started
                </Button>
              </Link>
              <Link to="/business">
                <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                  Learn About Partnerships
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-border bg-card/50">
        <div className="container mx-auto px-4 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                className="text-center"
              >
                <p className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>
                  {stat.value}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything You Need to Advertise</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              From machine screens to branded game seasons, VendX AdReach gives business owners powerful tools to reach customers.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <motion.div key={feature.title} variants={itemVariants}>
                  <Card className="h-full border-border/50 bg-card/50 hover:border-primary/40 transition-colors group">
                    <CardContent className="pt-6 space-y-3">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <Icon className="w-6 h-6 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-card/30 border-y border-border">
        <div className="container mx-auto px-4 max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground">Get your ads running in four simple steps.</p>
          </motion.div>

          <div className="space-y-8">
            {[
              { step: "01", title: "Browse the Marketplace", desc: "Explore available ad locations across machines and games with transparent pricing and estimated reach." },
              { step: "02", title: "Book Your Spot", desc: "Select your dates, upload your creative, and submit your booking for admin approval." },
              { step: "03", title: "Get Approved & Go Live", desc: "Once approved, your ad goes live on the scheduled date across all selected placements." },
              { step: "04", title: "Track Performance", desc: "Monitor views, clicks, and CTR in real-time through your AdReach dashboard." },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="flex gap-6 items-start"
              >
                <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <span className="text-lg font-bold text-primary">{item.step}</span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-1">{item.title}</h3>
                  <p className="text-muted-foreground">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Branded Games CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-accent/30 bg-accent/10 mb-6">
              <Gamepad2 className="w-4 h-4 text-accent" />
              <span className="text-sm text-accent font-medium">Branded Game Seasons</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Go Beyond Ads — Own the Game
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-2xl mx-auto">
              Request a custom branded game season. Reskin an existing VendX Interactive title with your brand colors and logo, 
              or commission a fully custom game experience that puts your brand at the center of the action.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auth">
                <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 text-lg px-8 py-6">
                  <Zap className="w-5 h-5 mr-2" />
                  Request a Branded Game
                </Button>
              </Link>
              <Link to="/games">
                <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                  Explore VendX Games
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 border-t border-border">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Reach More Customers?</h2>
            <p className="text-muted-foreground max-w-xl mx-auto mb-8">
              Sign up as a VendX Business Owner to access the AdReach marketplace and start booking ad placements today.
            </p>
            <Link to="/auth">
              <Button size="lg" className="text-lg px-10 py-6">
                <TrendingUp className="w-5 h-5 mr-2" />
                Start Advertising
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default AdReachPage;
