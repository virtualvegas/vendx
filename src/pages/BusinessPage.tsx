import { useState } from "react";
import { Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import StarField from "@/components/StarField";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Gamepad2, 
  Package, 
  Coins, 
  Candy, 
  Smartphone, 
  CreditCard,
  TrendingUp,
  Clock,
  Shield,
  Wrench,
  Users,
  BarChart3,
  CheckCircle2,
  ArrowRight,
  Phone,
  Mail,
  MapPin,
  Star,
  Zap,
  DollarSign,
  Building2,
  Handshake
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";

const services = [
  {
    icon: Gamepad2,
    title: "Arcade Machines",
    description: "Classic and modern arcade cabinets that drive foot traffic and create memorable experiences.",
    features: ["Revenue sharing", "Full maintenance", "Game rotation"]
  },
  {
    icon: Package,
    title: "Vending Machines",
    description: "State-of-the-art snack and beverage machines with cashless payment options.",
    features: ["Smart inventory", "24/7 monitoring", "Custom stocking"]
  },
  {
    icon: Coins,
    title: "Coin Operated",
    description: "Laundry, car wash, and specialty coin-op solutions for any venue.",
    features: ["Hybrid payments", "Remote diagnostics", "Durable builds"]
  },
  {
    icon: Candy,
    title: "Gumball & Capsule",
    description: "Colorful bulk vending machines that attract families and generate steady income.",
    features: ["Low maintenance", "High margins", "Kid-friendly"]
  },
  {
    icon: CreditCard,
    title: "ATM Machines",
    description: "Generate passive income with fee-based ATM placements at your location.",
    features: ["Transaction fees", "Cash services", "Compliance handled"]
  },
  {
    icon: Smartphone,
    title: "Phone Charger Kiosks",
    description: "Keep customers connected with battery rental stations that increase dwell time.",
    features: ["App integration", "Brand exposure", "Retention boost"]
  }
];

const benefits = [
  {
    icon: DollarSign,
    title: "Zero Upfront Cost",
    description: "We handle all equipment, installation, and maintenance costs. You just provide the space."
  },
  {
    icon: TrendingUp,
    title: "Passive Revenue",
    description: "Earn consistent monthly income through our competitive profit-sharing model."
  },
  {
    icon: Wrench,
    title: "Full Service",
    description: "24/7 maintenance, restocking, and support. We keep everything running smoothly."
  },
  {
    icon: BarChart3,
    title: "Real-Time Analytics",
    description: "Track performance, revenue, and inventory through our business owner dashboard."
  },
  {
    icon: Shield,
    title: "Fully Insured",
    description: "Complete liability coverage and equipment insurance for your peace of mind."
  },
  {
    icon: Clock,
    title: "Fast Deployment",
    description: "From approval to installation in as little as 2 weeks. Quick ROI realization."
  }
];

const testimonials = [
  {
    name: "Marcus Johnson",
    role: "Restaurant Owner",
    location: "Boston, MA",
    quote: "VendX arcade machines have become a major draw for families. Our weekend revenue is up 30%.",
    rating: 5
  },
  {
    name: "Sarah Chen",
    role: "Laundromat Manager",
    location: "Cambridge, MA",
    quote: "The phone charging kiosks were a game-changer. Customers stay longer and spend more.",
    rating: 5
  },
  {
    name: "David Martinez",
    role: "Gas Station Owner",
    location: "Worcester, MA",
    quote: "Zero hassle with their ATM service. The extra foot traffic has boosted our store sales.",
    rating: 5
  }
];

const stats = [
  { value: "500+", label: "Partner Locations" },
  { value: "98%", label: "Uptime Guarantee" },
  { value: "$2.5M+", label: "Paid to Partners" },
  { value: "24/7", label: "Support Available" }
];

const BusinessPage = () => {
  const [formData, setFormData] = useState({
    businessName: "",
    contactName: "",
    email: "",
    phone: "",
    locationType: "",
    services: "",
    message: ""
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Store the lead in business_inquiries table
      const { error } = await supabase.from("business_inquiries").insert({
        business_name: formData.businessName,
        contact_name: formData.contactName,
        email: formData.email,
        phone: formData.phone || null,
        location_type: formData.locationType || null,
        interested_services: formData.services || null,
        message: formData.message || null
      });

      if (error) throw error;

      toast.success("Thank you! Our team will contact you within 24 hours.");
      setFormData({
        businessName: "",
        contactName: "",
        email: "",
        phone: "",
        locationType: "",
        services: "",
        message: ""
      });
    } catch (error) {
      toast.error("Failed to submit. Please try again or call us directly.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-background">
      <StarField />
      <Navigation />

      {/* Hero Section */}
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
                <Handshake className="w-4 h-4 mr-2" />
                Partner With VendX
              </Badge>
              
              <h1 className="text-5xl lg:text-7xl font-bold mb-6 leading-tight">
                Turn Your <span className="glow-blue">Space</span> Into a
                <br />
                <span className="glow-green">Revenue Stream</span>
              </h1>
              
              <p className="text-xl lg:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto">
                From arcade machines to ATMs, we provide turnkey vending solutions with zero upfront costs. 
                You provide the space — we handle everything else.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg"
                  className="group bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_rgba(26,124,255,0.5)] hover:shadow-[0_0_30px_rgba(26,124,255,0.8)] text-lg px-8 py-6"
                  onClick={() => document.getElementById('contact-form')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  Get Started Today
                  <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button 
                  size="lg"
                  variant="outline"
                  className="border-2 border-accent text-accent hover:bg-accent hover:text-accent-foreground text-lg px-8 py-6"
                  asChild
                >
                  <a href="tel:+18005551234">
                    <Phone className="mr-2" />
                    Call Us Now
                  </a>
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="relative py-12 border-y border-border bg-card/30 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <div className="text-4xl lg:text-5xl font-bold glow-blue mb-2">{stat.value}</div>
                <div className="text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-accent/20 text-accent border-accent/30">Our Services</Badge>
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">
              Complete <span className="glow-green">Vending Solutions</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Whatever your space needs, we have the perfect machine to maximize your revenue potential.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service, index) => (
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
                      <service.icon className="w-7 h-7 text-primary" />
                    </div>
                    <CardTitle className="text-xl">{service.title}</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      {service.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {service.features.map((feature, fIndex) => (
                        <li key={fIndex} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-accent" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 relative bg-card/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-primary/20 text-primary border-primary/30">Why Partner With Us</Badge>
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">
              The <span className="glow-blue">VendX Advantage</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              We've streamlined the vending business so you can focus on what matters most — running your business.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="flex gap-4"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center">
                  <benefit.icon className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">{benefit.title}</h3>
                  <p className="text-muted-foreground">{benefit.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-accent/20 text-accent border-accent/30">Simple Process</Badge>
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">
              How It <span className="glow-green">Works</span>
            </h2>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-4 gap-8">
              {[
                { step: "1", title: "Inquiry", desc: "Tell us about your location and goals" },
                { step: "2", title: "Assessment", desc: "We evaluate and recommend solutions" },
                { step: "3", title: "Installation", desc: "Quick, professional setup at no cost" },
                { step: "4", title: "Profit", desc: "Start earning passive income monthly" }
              ].map((item, index) => (
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

      {/* Testimonials */}
      <section className="py-24 relative bg-card/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-primary/20 text-primary border-primary/30">Success Stories</Badge>
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">
              What Our <span className="glow-blue">Partners Say</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full bg-card/50 border-border">
                  <CardContent className="pt-6">
                    <div className="flex gap-1 mb-4">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="w-5 h-5 fill-accent text-accent" />
                      ))}
                    </div>
                    <p className="text-lg mb-6 italic">"{testimonial.quote}"</p>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                        <Users className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <div className="font-bold">{testimonial.name}</div>
                        <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {testimonial.location}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Ideal Locations */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-accent/20 text-accent border-accent/30">Perfect Fit</Badge>
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">
              Ideal <span className="glow-green">Locations</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Our machines thrive in high-traffic environments across various industries.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-4 max-w-4xl mx-auto">
            {[
              "Restaurants & Bars",
              "Hotels & Resorts",
              "Laundromats",
              "Gas Stations",
              "Shopping Malls",
              "Gyms & Fitness Centers",
              "Office Buildings",
              "Hospitals & Clinics",
              "Universities & Schools",
              "Car Dealerships",
              "Auto Repair Shops",
              "Entertainment Venues",
              "Bowling Alleys",
              "Movie Theaters",
              "Apartment Complexes"
            ].map((location, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
              >
                <Badge 
                  variant="outline" 
                  className="px-4 py-2 text-base border-border hover:border-primary hover:bg-primary/10 transition-all cursor-default"
                >
                  <Building2 className="w-4 h-4 mr-2" />
                  {location}
                </Badge>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section id="contact-form" className="py-24 relative bg-card/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <Badge className="mb-4 bg-primary/20 text-primary border-primary/30">Get Started</Badge>
                <h2 className="text-4xl lg:text-5xl font-bold mb-6">
                  Ready to <span className="glow-blue">Partner</span>?
                </h2>
                <p className="text-xl text-muted-foreground mb-8">
                  Fill out the form and our team will contact you within 24 hours to discuss the best solutions for your space.
                </p>

                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center">
                      <Phone className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Call Us</div>
                      <a href="tel:+18005551234" className="text-lg font-bold hover:text-primary transition-colors">
                        1-800-555-1234
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center">
                      <Mail className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Email</div>
                      <a href="mailto:partners@vendx.space" className="text-lg font-bold hover:text-primary transition-colors">
                        partners@vendx.space
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center">
                      <Zap className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Response Time</div>
                      <div className="text-lg font-bold">Within 24 Hours</div>
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <Card className="bg-card/50 border-border">
                  <CardHeader>
                    <CardTitle>Request a Consultation</CardTitle>
                    <CardDescription>
                      Tell us about your location and we'll recommend the perfect solutions.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="businessName">Business Name *</Label>
                          <Input
                            id="businessName"
                            required
                            value={formData.businessName}
                            onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                            placeholder="Your Business"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="contactName">Contact Name *</Label>
                          <Input
                            id="contactName"
                            required
                            value={formData.contactName}
                            onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                            placeholder="John Smith"
                          />
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="email">Email *</Label>
                          <Input
                            id="email"
                            type="email"
                            required
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="john@business.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone">Phone</Label>
                          <Input
                            id="phone"
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="(555) 123-4567"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="locationType">Location Type *</Label>
                        <Input
                          id="locationType"
                          required
                          value={formData.locationType}
                          onChange={(e) => setFormData({ ...formData, locationType: e.target.value })}
                          placeholder="e.g., Restaurant, Gas Station, Mall..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="services">Interested Services</Label>
                        <Input
                          id="services"
                          value={formData.services}
                          onChange={(e) => setFormData({ ...formData, services: e.target.value })}
                          placeholder="e.g., Arcade machines, ATM, Vending..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="message">Additional Details</Label>
                        <Textarea
                          id="message"
                          value={formData.message}
                          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                          placeholder="Tell us about your space, foot traffic, or any specific needs..."
                          rows={4}
                        />
                      </div>
                      <Button 
                        type="submit" 
                        size="lg"
                        className="w-full bg-primary hover:bg-primary/90 shadow-[0_0_20px_rgba(26,124,255,0.5)]"
                        disabled={submitting}
                      >
                        {submitting ? "Submitting..." : "Submit Inquiry"}
                        <ArrowRight className="ml-2" />
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default BusinessPage;
