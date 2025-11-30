import { Twitter, Linkedin, Youtube, Mail } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="relative border-t border-border/50">
      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div className="space-y-4">
            <h3 className="text-2xl font-bold glow-blue">VendX</h3>
            <p className="text-muted-foreground text-sm">
              The future of automated retail, expanding across Earth and beyond.
            </p>
            <p className="text-sm text-primary font-semibold">VendX.space</p>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-lg">Divisions</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/divisions/mini" className="hover:text-primary transition-smooth">VendX Mini</Link></li>
              <li><Link to="/divisions/max" className="hover:text-primary transition-smooth">VendX Max</Link></li>
              <li><Link to="/divisions/fresh" className="hover:text-primary transition-smooth">VendX Fresh</Link></li>
              <li><Link to="/divisions/digital" className="hover:text-primary transition-smooth">VendX Digital</Link></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-lg">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/about" className="hover:text-primary transition-smooth">About Us</Link></li>
              <li><Link to="/careers" className="hover:text-primary transition-smooth">Careers</Link></li>
              <li><Link to="/divisions" className="hover:text-primary transition-smooth">Press Kit</Link></li>
              <li><Link to="/divisions/mars" className="hover:text-accent transition-smooth">Mars Division</Link></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-lg">Connect</h4>
            <div className="flex gap-4">
              <a href="#" className="w-10 h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center hover:border-primary hover:shadow-[0_0_20px_rgba(26,124,255,0.5)] transition-smooth">
                <Twitter className="w-5 h-5 text-primary" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center hover:border-primary hover:shadow-[0_0_20px_rgba(26,124,255,0.5)] transition-smooth">
                <Linkedin className="w-5 h-5 text-primary" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center hover:border-primary hover:shadow-[0_0_20px_rgba(26,124,255,0.5)] transition-smooth">
                <Youtube className="w-5 h-5 text-primary" />
              </a>
              <a href="mailto:info@vendx.space" className="w-10 h-10 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center hover:border-accent hover:shadow-[0_0_20px_rgba(57,255,136,0.5)] transition-smooth">
                <Mail className="w-5 h-5 text-accent" />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-border/50 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>© 2025 VendX Corporation. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-primary transition-smooth">Privacy Policy</a>
            <a href="#" className="hover:text-primary transition-smooth">Terms of Service</a>
            <a href="#" className="hover:text-primary transition-smooth">Cookie Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
