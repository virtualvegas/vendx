import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Mail, Send } from "lucide-react";

const Contact = () => {
  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 space-y-4">
            <h2 className="text-5xl lg:text-6xl font-bold">
              Partner with <span className="glow-blue">VendX</span>
            </h2>
            <p className="text-xl text-muted-foreground">
              Join the automated retail revolution
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div className="bg-card/40 backdrop-blur-sm border border-primary/30 rounded-2xl p-8 hover:border-primary/50 hover:shadow-[0_0_30px_rgba(26,124,255,0.2)] transition-smooth">
              <Building2 className="w-12 h-12 text-primary mb-4" />
              <h3 className="text-2xl font-bold mb-3">For Businesses</h3>
              <p className="text-muted-foreground mb-4">
                Place a VendX machine at your location and earn passive revenue 24/7
              </p>
              <p className="text-sm text-muted-foreground">
                Contact: <span className="text-primary">business@vendx.space</span>
              </p>
            </div>

            <div className="bg-card/40 backdrop-blur-sm border border-accent/30 rounded-2xl p-8 hover:border-accent/50 hover:shadow-[0_0_30px_rgba(57,255,136,0.2)] transition-smooth">
              <Mail className="w-12 h-12 text-accent mb-4" />
              <h3 className="text-2xl font-bold mb-3">Global Inquiries</h3>
              <p className="text-muted-foreground mb-4">
                Reach out to our global partnerships team for large-scale deployments
              </p>
              <p className="text-sm text-muted-foreground">
                Contact: <span className="text-accent">global@vendx.space</span>
              </p>
            </div>
          </div>

          <div className="bg-card/50 backdrop-blur-sm border border-border rounded-2xl p-8 lg:p-12">
            <form className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name</label>
                  <Input 
                    placeholder="Your name"
                    className="bg-background/50 border-border focus:border-primary transition-smooth"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input 
                    type="email"
                    placeholder="you@company.com"
                    className="bg-background/50 border-border focus:border-primary transition-smooth"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Company</label>
                <Input 
                  placeholder="Your company"
                  className="bg-background/50 border-border focus:border-primary transition-smooth"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Message</label>
                <Textarea 
                  placeholder="Tell us about your interest in VendX..."
                  rows={5}
                  className="bg-background/50 border-border focus:border-primary transition-smooth resize-none"
                />
              </div>

              <Button 
                type="submit"
                size="lg"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground border-2 border-primary shadow-[0_0_20px_rgba(26,124,255,0.5)] hover:shadow-[0_0_30px_rgba(26,124,255,0.8)] transition-smooth text-lg group"
              >
                Send Message
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
