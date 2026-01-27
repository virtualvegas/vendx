import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, Facebook, Instagram, ChevronDown } from "lucide-react";
import vendxLogo from "@/assets/vendx-logo.png";
import { SiTiktok, SiX } from "react-icons/si";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  // Close mobile menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // Add scroll effect
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const primaryLinks = [
    { name: "Home", path: "/" },
    { name: "About", path: "/about" },
    { name: "Business", path: "/business" },
    { name: "Divisions", path: "/divisions" },
  ];

  const moreLinks = [
    { name: "Interactive", path: "/games" },
    { name: "Locations", path: "/locations" },
    { name: "Store", path: "/store" },
    { name: "Careers", path: "/careers" },
    { name: "Contact", path: "/contact" },
  ];

  const allLinks = [...primaryLinks, ...moreLinks];

  const isActive = (path: string) => location.pathname === path;
  const isMoreActive = moreLinks.some((link) => isActive(link.path));

  const socialLinks = [
    { href: "https://www.facebook.com/VendXGlobal", icon: Facebook, label: "Facebook" },
    { href: "https://www.tiktok.com/@vendxglobal", icon: SiTiktok, label: "TikTok" },
    { href: "https://www.instagram.com/vendx_global/", icon: Instagram, label: "Instagram" },
    { href: "https://x.com/VendXglobal", icon: SiX, label: "X" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-background/95 backdrop-blur-xl shadow-lg" : "bg-background/80 backdrop-blur-xl"
      } border-b border-border/50`}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center group flex-shrink-0">
            <img
              src={vendxLogo}
              alt="VendX"
              className="h-8 lg:h-10 w-auto transition-transform group-hover:scale-105"
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-1">
            {primaryLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive(link.path)
                    ? "text-primary bg-primary/10"
                    : "text-foreground hover:text-primary hover:bg-primary/5"
                }`}
              >
                {link.name}
              </Link>
            ))}

            {/* More Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-1 ${
                  isMoreActive
                    ? "text-primary bg-primary/10"
                    : "text-foreground hover:text-primary hover:bg-primary/5"
                }`}
              >
                More
                <ChevronDown className="w-4 h-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {moreLinks.map((link) => (
                  <DropdownMenuItem key={link.path} asChild>
                    <Link
                      to={link.path}
                      className={`w-full ${isActive(link.path) ? "text-primary" : ""}`}
                    >
                      {link.name}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Desktop Right Side */}
          <div className="hidden lg:flex items-center gap-3">
            {/* Social Icons */}
            <div className="flex items-center gap-2">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center hover:border-primary hover:bg-primary/20 transition-colors"
                >
                  <social.icon className="w-3.5 h-3.5 text-primary" />
                </a>
              ))}
            </div>

            <Link to="/auth">
              <Button
                size="sm"
                className="bg-accent hover:bg-accent/90 text-accent-foreground shadow-[0_0_10px_rgba(57,255,136,0.2)] hover:shadow-[0_0_20px_rgba(57,255,136,0.4)] transition-all"
              >
                Get Started
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden p-2 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors"
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={`lg:hidden overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? "max-h-[80vh] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="container mx-auto px-4 pb-6 space-y-1 bg-background border-t border-border/50">
          {allLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`block py-3 px-3 text-base font-medium rounded-lg transition-colors ${
                isActive(link.path)
                  ? "text-primary bg-primary/10"
                  : "text-foreground hover:text-primary hover:bg-primary/5"
              }`}
            >
              {link.name}
            </Link>
          ))}

          {/* Mobile Social Links */}
          <div className="flex items-center gap-3 py-4 px-3">
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                className="w-10 h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center hover:border-primary transition-colors"
              >
                <social.icon className="w-4 h-4 text-primary" />
              </a>
            ))}
          </div>

          {/* Mobile CTA */}
          <div className="px-3 pt-2">
            <Link to="/auth" className="block">
              <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
