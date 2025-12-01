import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Mail, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Contact = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const ticketNumber = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const { error } = await supabase.from("support_tickets").insert({
        ticket_number: ticketNumber,
        machine_id: "CONTACT_FORM",
        location: formData.company || "Not specified",
        issue_type: "Contact Form Inquiry",
        priority: "medium",
        description: `Name: ${formData.name}\nEmail: ${formData.email}\nCompany: ${formData.company}\n\nMessage:\n${formData.message}`,
        status: "open",
      });

      if (error) throw error;

      toast({
        title: "Message Sent!",
        description: `We've received your inquiry. Ticket: ${ticketNumber}`,
      });

      setFormData({ name: "", email: "", company: "", message: "" });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 space-y-4">
            <h2 className="text-5xl lg:text-6xl font-bold">
              Partner with <span className="glow-blue">VendX</span>
            </h2>
            <p className="text-xl text-muted-foreground">Join the automated retail revolution</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div className="bg-card/40 backdrop-blur-sm border border-primary/30 rounded-2xl p-8 hover:border-primary/50 hover:shadow-[0_0_30px_rgba(26,124,255,0.2)] transition-smooth">
              <Building2 className="w-12 h-12 text-primary mb-4" />
              <h3 className="text-2xl font-bold mb-3">For Businesses</h3>
              <p className="text-muted-foreground mb-4">
                Place a VendX machine at your location and earn passive revenue 24/7
              </p>
              <p className="text-sm text-muted-foreground">
                Contact: <span className="text-primary">sales@vendx.space</span>
              </p>
            </div>

            <div className="bg-card/40 backdrop-blur-sm border border-accent/30 rounded-2xl p-8 hover:border-accent/50 hover:shadow-[0_0_30px_rgba(57,255,136,0.2)] transition-smooth">
              <Mail className="w-12 h-12 text-accent mb-4" />
              <h3 className="text-2xl font-bold mb-3">Global Inquiries</h3>
              <p className="text-muted-foreground mb-4">
                Reach out to our global partnerships team for large-scale deployments
              </p>
              <p className="text-sm text-muted-foreground">
                Contact: <span className="text-accent">info@vendx.space</span>
              </p>
            </div>
          </div>

          <div className="bg-card/50 backdrop-blur-sm border border-border rounded-2xl p-8 lg:p-12">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name</label>
                  <Input
                    required
                    placeholder="Your name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-background/50 border-border focus:border-primary transition-smooth"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    required
                    type="email"
                    placeholder="you@company.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="bg-background/50 border-border focus:border-primary transition-smooth"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Company</label>
                <Input
                  placeholder="Your company"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="bg-background/50 border-border focus:border-primary transition-smooth"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Message</label>
                <Textarea
                  required
                  placeholder="Tell us about your interest in VendX..."
                  rows={5}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="bg-background/50 border-border focus:border-primary transition-smooth resize-none"
                />
              </div>

              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground border-2 border-primary shadow-[0_0_20px_rgba(26,124,255,0.5)] hover:shadow-[0_0_30px_rgba(26,124,255,0.8)] transition-smooth text-lg group"
              >
                {isSubmitting ? "Sending..." : "Send Message"}
                <Send className="ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
