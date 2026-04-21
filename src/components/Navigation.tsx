import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, Facebook, Instagram, ChevronDown, ShoppingBag, Gamepad2, MapPin, Briefcase, Info, Phone, Newspaper, Users, Link2, Ticket, Wallet } from "lucide-react";
import vendxLogo from "@/assets/vendx-logo.png";
import { SiTiktok, SiX } from "react-icons/si";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isActive = (path: string) => location.pathname === path;

  const socialLinks = [
    { href: "https://www.facebook.com/VendXGlobal", icon: Facebook, label: "Facebook" },
    { href: "https://www.tiktok.com/@vendxglobal", icon: SiTiktok, label: "TikTok" },
    { href: "https://www.instagram.com/vendx_global/", icon: Instagram, label: "Instagram" },
    { href: "https://x.com/VendXglobal", icon: SiX, label: "X" },
  ];

  // Mobile navigation structure
  const mobileNavGroups = [
    {
      title: "Products & Services",
      links: [
        { name: "Store", path: "/store", icon: ShoppingBag },
        { name: "Interactive", path: "/games", icon: Gamepad2 },
        { name: "VendX Pay", path: "/wallet", icon: Wallet },
        { name: "Prize Shop", path: "/tickets/redeem", icon: Ticket },
        { name: "VendX Ecosystem", path: "/links", icon: Link2 },
      ],
    },
    {
      title: "Locations",
      links: [
        { name: "Find Locations", path: "/locations", icon: MapPin },
        { name: "Events", path: "/locations/events", icon: Gamepad2 },
        { name: "Event Rentals", path: "https://hostheroz.com", icon: Briefcase, external: true },
      ],
    },
    {
      title: "More VendX",
      links: [
        { name: "Partner With Us", path: "/business", icon: Briefcase },
        { name: "Our Divisions", path: "/divisions", icon: Briefcase },
        { name: "About VendX", path: "/about", icon: Info },
        { name: "News", path: "/news", icon: Newspaper },
        { name: "Careers", path: "/careers", icon: Users },
        { name: "Contact", path: "/contact", icon: Phone },
      ],
    },
  ];

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b border-border/50",
        scrolled ? "bg-background/95 backdrop-blur-xl shadow-lg" : "bg-background/80 backdrop-blur-xl"
      )}
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
          <div className="hidden lg:flex items-center">
            <NavigationMenu>
              <NavigationMenuList className="gap-1">
                {/* Home Link */}
                <NavigationMenuItem>
                  <Link
                    to="/"
                    className={cn(
                      "group inline-flex h-10 w-max items-center justify-center rounded-md bg-transparent px-4 py-2 text-sm font-medium transition-colors hover:bg-primary/5 hover:text-accent-foreground focus:bg-primary/5 focus:text-accent-foreground focus:outline-none",
                      location.pathname === "/" && "text-primary"
                    )}
                  >
                    Home
                  </Link>
                </NavigationMenuItem>

                {/* Products & Services Dropdown */}
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="bg-transparent hover:bg-primary/5 data-[state=open]:bg-primary/10">
                    Products
                  </NavigationMenuTrigger>
                <NavigationMenuContent>
                    <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 bg-popover">
                      <NavListItem to="/store" title="Online Store" icon={ShoppingBag}>
                        Shop vending machines and equipment
                      </NavListItem>
                      <NavListItem to="/games" title="VendX Interactive" icon={Gamepad2}>
                        Gaming, entertainment & digital experiences
                      </NavListItem>
                      <NavListItem to="/links" title="VendX Ecosystem" icon={Link2}>
                        Explore our family of brands and services
                      </NavListItem>
                      <NavListItem to="/rewards" title="Rewards Program" icon={Users}>
                        Earn points and unlock exclusive perks
                      </NavListItem>
                      <NavListItem to="/wallet" title="VendX Pay" icon={Wallet}>
                        Digital wallet for machines and arcade
                      </NavListItem>
                      <NavListItem to="/tickets/redeem" title="Prize Shop" icon={Ticket}>
                        Redeem tickets for awesome prizes
                      </NavListItem>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                {/* Locations Link */}
                <NavigationMenuItem>
                  <Link
                    to="/locations"
                    className={cn(
                      "group inline-flex h-10 w-max items-center justify-center rounded-md bg-transparent px-4 py-2 text-sm font-medium transition-colors hover:bg-primary/5 hover:text-accent-foreground focus:bg-primary/5 focus:text-accent-foreground focus:outline-none",
                      location.pathname === "/locations" && "text-primary"
                    )}
                  >
                    Locations
                  </Link>
                </NavigationMenuItem>

                <NavigationMenuItem>
                  <a
                    href="https://hostheroz.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex h-10 w-max items-center justify-center rounded-md bg-transparent px-4 py-2 text-sm font-medium transition-colors hover:bg-primary/5 hover:text-accent-foreground focus:bg-primary/5 focus:text-accent-foreground focus:outline-none"
                  >
                    Event Rentals
                  </a>
                </NavigationMenuItem>

                {/* More VendX Dropdown */}
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="bg-transparent hover:bg-primary/5 data-[state=open]:bg-primary/10">
                    More VendX
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid gap-3 p-4 w-[400px] md:w-[500px] md:grid-cols-2 bg-popover">
                      <NavListItem to="/business" title="Partner With Us" icon={Briefcase}>
                        Host VendX machines at your location
                      </NavListItem>
                      <NavListItem to="/divisions" title="Our Divisions" icon={Briefcase}>
                        Explore VendX Mini, Max, Fresh, Digital & more
                      </NavListItem>
                      <NavListItem to="/about" title="About VendX" icon={Info}>
                        Our mission to revolutionize vending
                      </NavListItem>
                      <NavListItem to="/locations/events" title="Events" icon={Gamepad2}>
                        Find VendX at local events
                      </NavListItem>
                      <NavListItem to="/news" title="News & Updates" icon={Newspaper}>
                        Latest announcements and articles
                      </NavListItem>
                      <NavListItem to="/careers" title="Careers" icon={Users}>
                        Join the VendX team
                      </NavListItem>
                      <NavListItem to="/contact" title="Contact Us" icon={Phone}>
                        Get in touch with our team
                      </NavListItem>
                      <li>
                        <NavigationMenuLink asChild>
                          <a
                            href="https://hostheroz.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent/10 hover:text-accent-foreground focus:bg-accent/10 focus:text-accent-foreground"
                          >
                            <div className="flex items-center gap-2 text-sm font-medium leading-none">
                              <Gamepad2 className="w-4 h-4 text-primary" />
                              Party & Event Rentals
                            </div>
                            <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                              Rent arcade machines for parties and events
                            </p>
                          </a>
                        </NavigationMenuLink>
                      </li>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </div>

          {/* Desktop Right Side */}
          <div className="hidden lg:flex items-center gap-3">
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
        className={cn(
          "lg:hidden overflow-hidden transition-all duration-300 ease-in-out",
          isOpen ? "max-h-[85vh] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="container mx-auto px-4 pb-6 bg-background border-t border-border/50 overflow-y-auto max-h-[calc(85vh-64px)]">
          {mobileNavGroups.map((group) => (
            <div key={group.title} className="py-3 border-b border-border/30 last:border-b-0">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
                {group.title}
              </p>
              {group.links.map((link) =>
                "external" in link && link.external ? (
                  <a
                    key={link.path}
                    href={link.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 py-3 px-3 text-base font-medium rounded-lg transition-colors text-foreground hover:text-primary hover:bg-primary/5"
                  >
                    <link.icon className="w-5 h-5" />
                    {link.name}
                  </a>
                ) : (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={cn(
                      "flex items-center gap-3 py-3 px-3 text-base font-medium rounded-lg transition-colors",
                      isActive(link.path)
                        ? "text-primary bg-primary/10"
                        : "text-foreground hover:text-primary hover:bg-primary/5"
                    )}
                  >
                    <link.icon className="w-5 h-5" />
                    {link.name}
                  </Link>
                )
              )}
            </div>
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

// Reusable nav list item component
const NavListItem = ({
  to,
  title,
  icon: Icon,
  children,
}: {
  to: string;
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <Link
          to={to}
          className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent/10 hover:text-accent-foreground focus:bg-accent/10 focus:text-accent-foreground"
        >
          <div className="flex items-center gap-2 text-sm font-medium leading-none">
            <Icon className="w-4 h-4 text-primary" />
            {title}
          </div>
          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
            {children}
          </p>
        </Link>
      </NavigationMenuLink>
    </li>
  );
};

export default Navigation;
