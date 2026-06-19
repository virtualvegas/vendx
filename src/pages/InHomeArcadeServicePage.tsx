import { Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import StarField from "@/components/StarField";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSEO } from "@/hooks/useSEO";
import { motion } from "framer-motion";
import {
  Gamepad2,
  ArrowRight,
  Phone,
  Home,
  Wrench,
  Monitor,
  Cpu,
  Sparkles,
  Truck,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";

const VENDX_PHONE_TEL = "tel:+17812141806";

// These slugs match the SERVICE_PACKAGES options in ServiceRequestPage.tsx
const packages = [
  {
    slug: "diagnostic_visit",
    icon: Wrench,
    title: "Diagnostic Visit",
    price: "From $89",
    desc: "On-site inspection, fault diagnosis, written estimate. Fee credited toward repair if you proceed.",
    features: ["1 hour on-site", "Multi-meter / boot tests", "Written estimate", "Same-week scheduling"],
  },
  {
    slug: "monitor_repair",
    icon: Monitor,
    title: "Monitor / Display Repair",
    price: "From $149 + parts",
    desc: "CRT cap kits, flyback issues, LCD backlight, scaler/converter swaps for modern panels.",
    features: ["CRT chassis recap", "LCD backlight & inverter", "Scaler / GBS / OSSC install", "Geometry calibration"],
  },
  {
    slug: "board_repair",
    icon: Cpu,
    title: "PCB / Board Repair",
    price: "From $179 + parts",
    desc: "JAMMA & MultiJAMMA boards, JVS, pinball MPUs, redemption logic boards.",
    features: ["Cap & battery replacement", "Trace repair", "ROM / EEPROM service", "Bench test before reinstall"],
  },
  {
    slug: "full_restoration",
    icon: Sparkles,
    title: "Full Restoration",
    price: "Quoted",
    desc: "End-to-end cabinet restoration — artwork, t-molding, controls, monitor, harness, and electronics.",
    features: ["Cabinet repaint / artwork", "New controls & t-molding", "Harness rebuild", "Electronics overhaul"],
  },
  {
    slug: "delivery_setup",
    icon: Truck,
    title: "Delivery & Setup",
    price: "From $199",
    desc: "We move, deliver, and set up your in-home arcade — stairs, tight doorways, basement installs included.",
    features: ["2-person crew", "Stair & basement service", "Level, test, and tune", "Haul-away available"],
  },
  {
    slug: "tune_up",
    icon: Gamepad2,
    title: "Annual Tune-Up",
    price: "From $129",
    desc: "Yearly preventative service so your cabinet keeps playing like new — controls, monitor, and electronics.",
    features: ["Control deep clean", "Button & switch test", "Monitor brightness check", "Internal dusting"],
  },
];

const cabinetTypes = [
  "Classic upright arcades (Pac-Man, Galaga, Donkey Kong)",
  "Fightsticks & candy cabinets (Vewlix, Astro, Sega Naomi)",
  "Multicades & MAME builds",
  "Pinball machines (EM, SS, DMD, LCD)",
  "Driving / shooter cabinets",
  "Cocktail tables & bartops",
  "Redemption & ticket games",
  "Home pool tables, foosball, air hockey",
];

const InHomeArcadeServicePage = () => {
  useSEO({
    title: "In-Home Arcade Repair & Restoration — VendX",
    description:
      "Professional in-home arcade service: diagnostic visits, monitor and PCB repair, full restorations, delivery, setup, and annual tune-ups for home arcades and pinball.",
  });

  return (
    <div className="relative min-h-screen bg-background">
      <StarField />
      <Navigation />

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-space opacity-60" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Badge className="mb-6 bg-primary/20 text-primary border-primary/30 px-4 py-2">
                <Home className="w-4 h-4 mr-2" />
                In-Home Arcade Service
              </Badge>

              <h1 className="text-5xl lg:text-7xl font-bold mb-6 leading-tight">
                Your <span className="glow-blue">Home Arcade</span>
                <br />
                <span className="glow-green">Done Right</span>
              </h1>

              <p className="text-xl lg:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto">
                We come to your house. We fix your cabinet. From a single dead joystick to
                a full ground-up restoration — VendX techs handle in-home arcade and pinball machines.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  className="group bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_rgba(26,124,255,0.5)] hover:shadow-[0_0_30px_rgba(26,124,255,0.8)] text-lg px-8 py-6"
                  asChild
                >
                  <Link to="/service-request?machine=arcade_home">
                    Book a Visit
                    <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-2 border-accent text-accent hover:bg-accent hover:text-accent-foreground text-lg px-8 py-6"
                  asChild
                >
                  <a href={VENDX_PHONE_TEL}>
                    <Phone className="mr-2" />
                    Call (781) 214-1806
                  </a>
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Service Packages */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-accent/20 text-accent border-accent/30">Service Packages</Badge>
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">
              Pick a <span className="glow-green">Package</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Choose a preset to get started — we'll firm up scope and pricing after we see the machine.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {packages.map((pkg, i) => (
              <motion.div
                key={pkg.slug}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="h-full bg-card/50 border-border hover:border-primary/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(26,124,255,0.2)] group flex flex-col">
                  <CardHeader>
                    <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center mb-4 group-hover:border-primary transition-all">
                      <pkg.icon className="w-7 h-7 text-primary" />
                    </div>
                    <CardTitle className="text-xl flex items-center justify-between gap-2">
                      <span>{pkg.title}</span>
                      <span className="text-sm font-medium text-accent">{pkg.price}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <p className="text-muted-foreground mb-4">{pkg.desc}</p>
                    <ul className="space-y-2 mb-6 flex-1">
                      {pkg.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Button asChild variant="outline" className="w-full">
                      <Link to={`/service-request?machine=arcade_home&package=${pkg.slug}`}>
                        Book {pkg.title}
                        <ArrowRight className="ml-2 w-4 h-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* What we work on */}
      <section className="py-24 relative bg-card/30">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-primary/20 text-primary border-primary/30">What We Service</Badge>
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">
              Almost <span className="glow-blue">Every Cabinet</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {cabinetTypes.map((t) => (
              <div key={t} className="flex items-start gap-3 p-4 rounded-lg bg-card/50 border border-border">
                <Gamepad2 className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                <span>{t}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground mt-8">
            Don't see your cabinet? <Link to="/service-request?machine=arcade_home" className="text-primary underline">Tell us about it</Link> — chances are we've seen one.
          </p>
        </div>
      </section>

      {/* Guarantee */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4 max-w-3xl">
          <Card className="bg-card/60 border-border">
            <CardHeader className="text-center">
              <div className="w-14 h-14 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="w-7 h-7 text-accent" />
              </div>
              <CardTitle className="text-2xl">Our In-Home Promise</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                "Shoe covers and floor protection — every visit, no exceptions.",
                "Up-front estimate before any chargeable work begins.",
                "30-day workmanship guarantee on every labor item.",
                "Bench work pickup & return available if a part needs the shop.",
                "Insured techs — fully covered for in-home work.",
              ].map((line) => (
                <div key={line} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                  <span>{line}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
        <div className="container mx-auto px-4 relative z-10 text-center">
          <h2 className="text-4xl lg:text-5xl font-bold mb-4">
            Let's Get Your Cabinet <span className="glow-green">Playing Again</span>
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Book an in-home visit in under 2 minutes. We respond within one business day.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="group bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_rgba(26,124,255,0.5)] hover:shadow-[0_0_30px_rgba(26,124,255,0.8)] text-lg px-8 py-6"
              asChild
            >
              <Link to="/service-request?machine=arcade_home">
                Request Service
                <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-2 border-accent text-accent hover:bg-accent hover:text-accent-foreground text-lg px-8 py-6"
              asChild
            >
              <a href={VENDX_PHONE_TEL}>
                <Phone className="mr-2" />
                Call Now
              </a>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default InHomeArcadeServicePage;
