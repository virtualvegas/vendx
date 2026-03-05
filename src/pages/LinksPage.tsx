import { ExternalLink, Zap, PartyPopper, Gamepad2, ArrowLeft, ShoppingBag, MapPin, Wallet, Ticket, Users, Briefcase, Newspaper, Phone, Info, Award, Megaphone, Link2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";

const customerLinks = [
  {
    name: "Online Store",
    url: "/store",
    icon: ShoppingBag,
    color: "from-primary to-blue-400",
    description: "Shop vending machines, snack boxes & equipment",
    external: false,
  },
  {
    name: "VendX Interactive",
    url: "/games",
    icon: Gamepad2,
    color: "from-purple-500 to-pink-500",
    description: "Gaming, entertainment & digital experiences",
    external: false,
  },
  {
    name: "VendX Pay",
    url: "/wallet",
    icon: Wallet,
    color: "from-accent to-emerald-400",
    description: "Digital wallet for machines and arcade",
    external: false,
  },
  {
    name: "Prize Shop",
    url: "/tickets/redeem",
    icon: Ticket,
    color: "from-yellow-500 to-orange-500",
    description: "Redeem your tickets for awesome prizes",
    external: false,
  },
  {
    name: "Rewards Program",
    url: "/rewards",
    icon: Award,
    color: "from-amber-500 to-yellow-400",
    description: "Earn points and unlock exclusive perks",
    external: false,
  },
  {
    name: "Find Locations",
    url: "/locations",
    icon: MapPin,
    color: "from-cyan-500 to-blue-500",
    description: "Find VendX machines near you",
    external: false,
  },
  {
    name: "Events",
    url: "/locations/events",
    icon: Gamepad2,
    color: "from-rose-500 to-pink-400",
    description: "Find VendX at local events and festivals",
    external: false,
  },
  {
    name: "Quests & Challenges",
    url: "/quests",
    icon: Zap,
    color: "from-indigo-500 to-purple-500",
    description: "Complete quests and earn rewards",
    external: false,
  },
];

const businessLinks = [
  {
    name: "Partner With Us",
    url: "/business",
    icon: Briefcase,
    color: "from-primary to-blue-400",
    description: "Host VendX machines at your business location",
    external: false,
  },
  {
    name: "AdReach Advertising",
    url: "/adreach",
    icon: Megaphone,
    color: "from-orange-500 to-red-500",
    description: "Advertise on VendX screens and games",
    external: false,
  },
  {
    name: "Party & Event Rentals",
    url: "https://hostheroz.com",
    icon: PartyPopper,
    color: "from-orange-500 to-yellow-500",
    description: "Rent arcade machines for parties and events",
    external: true,
  },
  {
    name: "Northeast Amusements",
    url: "https://northeastamusements.com",
    icon: Gamepad2,
    color: "from-purple-500 to-pink-500",
    description: "Event amusement equipment for fairs & festivals",
    external: true,
  },
];

const companyLinks = [
  {
    name: "About VendX",
    url: "/about",
    icon: Info,
    color: "from-slate-500 to-gray-400",
    description: "Our mission to revolutionize vending",
    external: false,
  },
  {
    name: "Our Divisions",
    url: "/divisions",
    icon: Briefcase,
    color: "from-teal-500 to-cyan-500",
    description: "Explore VendX Mini, Max, Fresh, Digital & more",
    external: false,
  },
  {
    name: "News & Updates",
    url: "/news",
    icon: Newspaper,
    color: "from-blue-500 to-indigo-500",
    description: "Latest announcements and articles",
    external: false,
  },
  {
    name: "Careers",
    url: "/careers",
    icon: Users,
    color: "from-green-500 to-emerald-500",
    description: "Join the VendX team",
    external: false,
  },
  {
    name: "Contact Us",
    url: "/contact",
    icon: Phone,
    color: "from-primary to-accent",
    description: "Get in touch with our team",
    external: false,
  },
];

type LinkItem = {
  name: string;
  url: string;
  icon: React.ElementType;
  color: string;
  description: string;
  external: boolean;
};

const LinkCard = ({ link }: { link: LinkItem }) => {
  const content = (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-center gap-4 p-4">
          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${link.color} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300`}>
            <link.icon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                {link.name}
              </h3>
              {link.external && <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
            </div>
            <p className="text-sm text-muted-foreground">{link.description}</p>
          </div>
        </div>
        <div className={`h-0.5 bg-gradient-to-r ${link.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
      </CardContent>
    </Card>
  );

  if (link.external) {
    return (
      <a href={link.url} target="_blank" rel="noopener noreferrer" className="block group">
        {content}
      </a>
    );
  }

  return (
    <Link to={link.url} className="block group">
      {content}
    </Link>
  );
};

const LinkSection = ({ title, links }: { title: string; links: LinkItem[] }) => (
  <div className="mb-10">
    <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
      <div className="w-1 h-6 bg-gradient-to-b from-primary to-accent rounded-full" />
      {title}
    </h2>
    <div className="grid sm:grid-cols-2 gap-3">
      {links.map((link) => (
        <LinkCard key={link.name} link={link} />
      ))}
    </div>
  </div>
);

const LinksPage = () => {
  useSEO({
    title: "VendX Links — Explore Our Ecosystem",
    description: "Quick access to all VendX products, services, and resources for customers and businesses.",
  });

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="fixed inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5 pointer-events-none" />

      <div className="relative z-10 container mx-auto px-4 pt-24 pb-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            VendX Links
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Quick access to everything in the VendX ecosystem
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <LinkSection title="For Customers" links={customerLinks} />
          <LinkSection title="For Businesses" links={businessLinks} />
          <LinkSection title="Company" links={companyLinks} />

          {/* Footer CTA */}
          <div className="text-center mt-12">
            <p className="text-muted-foreground mb-4">Ready to get started?</p>
            <div className="flex items-center justify-center gap-3">
              <Link to="/auth">
                <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  Sign Up
                </Button>
              </Link>
              <Link to="/contact">
                <Button variant="outline">Contact Us</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default LinksPage;
