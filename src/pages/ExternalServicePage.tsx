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
  Wrench,
  ArrowRight,
  Phone,
  ClipboardList,
  CalendarClock,
  FileText,
  CreditCard,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Gamepad2,
  Coffee,
  CircleDollarSign,
  PinIcon,
  Pin,
} from "lucide-react";

const VENDX_PHONE_TEL = "tel:+17812141806";

const machineTypes = [
  { icon: Coffee, title: "Vending Machines", desc: "Snack, beverage, combo, and fresh-food units from any manufacturer." },
  { icon: CircleDollarSign, title: "Coin-Operated", desc: "Laundry, car wash, amusement, and specialty coin-op equipment." },
  { icon: Gamepad2, title: "Arcade & Redemption", desc: "Commercial cabinets, ticket games, claw cranes, and in-home arcades.", href: "/external-service/in-home-arcade" },
  { icon: PinIcon, title: "Pinball", desc: "Classic and modern pinball machines — boards, displays, mechs." },
  { icon: Pin, title: "Bowling Pinsetters", desc: "Pinsetter diagnostics, lane electronics, and scoring systems." },
  { icon: Zap, title: "More Equipment", desc: "Jukeboxes, pool tables, ATMs, kiosks, and custom builds." },
];

const howItWorks = [
  { step: "1", title: "Submit Request", desc: "Fill out the online form or call us with your machine details and issue." },
  { step: "2", title: "Diagnosis", desc: "Our tech reviews the ticket, confirms scope, and provides an upfront estimate." },
  { step: "3", title: "On-Site Service", desc: "A certified technician arrives on schedule with parts and tools." },
  { step: "4", title: "Invoice & Pay", desc: "You receive a detailed invoice for labor and parts — pay online or by check." },
];

const benefits = [
  { icon: Wrench, title: "Certified Techs", desc: "Experienced technicians trained across vending, arcade, and coin-op systems." },
  { icon: CalendarClock, title: "Flexible Scheduling", desc: "Book appointments that fit your business hours — including evenings and weekends." },
  { icon: ClipboardList, title: "Detailed Reporting", desc: "Every repair is documented with photos, parts used, and time logged." },
  { icon: CreditCard, title: "Transparent Pricing", desc: "Upfront estimates, no hidden fees. Labor + parts invoiced separately." },
  { icon: ShieldCheck, title: "Work Guarantee", desc: "Repairs backed by a 30-day workmanship guarantee on labor." },
  { icon: FileText, title: "Full History", desc: "Access your service history, invoices, and machine records anytime." },
];

const ExternalServicePage = () => {
  useSEO({
    title: "External Machine Service — VendX",
    description: "Professional technician service for vending machines, arcade cabinets, pinball, bowling pinsetters, coin-op, and in-home arcades. Request a repair online.",
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
                <Wrench className="w-4 h-4 mr-2" />
                External Machine Service
              </Badge>

              <h1 className="text-5xl lg:text-7xl font-bold mb-6 leading-tight">
                We Fix <span className="glow-blue">Your</span>
                <br />
                <span className="glow-green">Machines</span>
              </h1>

              <p className="text-xl lg:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto">
                VendX technicians service vending, arcade, pinball, bowling pinsetters, coin-op, and in-home arcade equipment —
                even if we didn't install them.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  className="group bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_rgba(26,124,255,0.5)] hover:shadow-[0_0_30px_rgba(26,124,255,0.8)] text-lg px-8 py-6"
                  asChild
                >
                  <Link to="/service-request">
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
                    Call Us Now
                  </a>
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Machine Types */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-accent/20 text-accent border-accent/30">What We Service</Badge>
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">
              If It Takes <span className="glow-green">Coins or Credits</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              From commercial arcades to basement pinball collections — we repair it.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {machineTypes.map((mt, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full bg-card/50 border-border hover:border-primary/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(26,124,255,0.2)] group">
                  <CardHeader>
                    <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center mb-4 group-hover:border-primary group-hover:shadow-[0_0_20px_rgba(26,124,255,0.4)] transition-all">
                      <mt.icon className="w-7 h-7 text-primary" />
                    </div>
                    <CardTitle className="text-xl">{mt.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{mt.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 relative bg-card/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-primary/20 text-primary border-primary/30">Simple Process</Badge>
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">
              How It <span className="glow-blue">Works</span>
            </h2>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-4 gap-8">
              {howItWorks.map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.15 }}
                  className="text-center relative"
                >
                  <div className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-primary">
                    {item.step}
                  </div>
                  <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                  {index < 3 && (
                    <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-primary/50 to-transparent" />
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-accent/20 text-accent border-accent/30">Why Choose VendX Service</Badge>
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">
              Service You Can <span className="glow-green">Trust</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {benefits.map((b, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="flex gap-4"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center">
                  <b.icon className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">{b.title}</h3>
                  <p className="text-muted-foreground">{b.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Note */}
      <section className="py-24 relative bg-card/30">
        <div className="container mx-auto px-4 max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Card className="bg-card/60 border-border">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Transparent Pricing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  {[
                    "No call-out fee for standard business hours within our service area",
                    "Labor billed in 15-minute increments after the first hour",
                    "Parts sourced at cost + modest markup — never marked up excessively",
                    "Detailed invoice with line-item breakdown before any chargeable work",
                    "Emergency / after-hours rates available for critical downtime",
                  ].map((line, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-muted-foreground text-center pt-4">
                  Exact rates vary by equipment type and region. We'll confirm everything before we dispatch.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
        <div className="container mx-auto px-4 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">
              Ready to Get Your Machine <span className="glow-blue">Running?</span>
            </h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Submit a service request in under 2 minutes. Our team typically responds within one business day.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="group bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_rgba(26,124,255,0.5)] hover:shadow-[0_0_30px_rgba(26,124,255,0.8)] text-lg px-8 py-6"
                asChild
              >
                <Link to="/service-request">
                  Request Service Now
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
      </section>

      <Footer />
    </div>
  );
};

export default ExternalServicePage;
