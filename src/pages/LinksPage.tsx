import { useEffect, useState } from "react";
import * as LucideIcons from "lucide-react";
import { ExternalLink, Sparkles, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";
import { supabase } from "@/integrations/supabase/client";
import { externalLinkProps } from "@/lib/externalLink";

type LinkItem = {
  name: string;
  url: string;
  icon: React.ElementType;
  color: string;
  description: string;
  external: boolean;
  featured?: boolean;
  badge?: string;
};

type BrandRow = {
  id: string;
  name: string;
  url: string;
  description: string;
  icon: string;
  color: string;
  badge: string | null;
  section: string;
  sort_order: number;
  is_external: boolean;
  is_featured: boolean;
};

const customerLinks: LinkItem[] = [
  { name: "Online Store", url: "/store", icon: LucideIcons.ShoppingBag, color: "from-primary to-blue-400", description: "Shop vending machines, snack boxes & equipment", external: false },
  { name: "VendX Interactive", url: "/games", icon: LucideIcons.Gamepad2, color: "from-purple-500 to-pink-500", description: "Gaming, entertainment & digital experiences", external: false },
  { name: "VendX Pay", url: "/wallet", icon: LucideIcons.Wallet, color: "from-accent to-emerald-400", description: "Digital wallet for machines and arcade", external: false },
  { name: "Prize Shop", url: "/tickets/redeem", icon: LucideIcons.Ticket, color: "from-yellow-500 to-orange-500", description: "Redeem your tickets for awesome prizes", external: false },
  { name: "Rewards Program", url: "/rewards", icon: LucideIcons.Award, color: "from-amber-500 to-yellow-400", description: "Earn points and unlock exclusive perks", external: false },
  { name: "Find Locations", url: "/locations", icon: LucideIcons.MapPin, color: "from-cyan-500 to-blue-500", description: "Find VendX machines near you", external: false },
  { name: "Events", url: "/locations/events", icon: LucideIcons.Gamepad2, color: "from-rose-500 to-pink-400", description: "Find VendX at local events and festivals", external: false },
  { name: "Quests & Challenges", url: "/quests", icon: LucideIcons.Zap, color: "from-indigo-500 to-purple-500", description: "Complete quests and earn rewards", external: false },
];

const businessLinks: LinkItem[] = [
  { name: "Partner With Us", url: "/business", icon: LucideIcons.Briefcase, color: "from-primary to-blue-400", description: "Host VendX machines at your business location", external: false },
  { name: "AdReach Advertising", url: "/adreach", icon: LucideIcons.Megaphone, color: "from-orange-500 to-red-500", description: "Advertise on VendX screens and games", external: false },
  { name: "Private Event Rentals", url: "/events", icon: LucideIcons.PartyPopper, color: "from-orange-500 to-yellow-500", description: "Rent VendX machines for parties and events", external: false },
];

const companyLinks: LinkItem[] = [
  { name: "About VendX", url: "/about", icon: LucideIcons.Info, color: "from-slate-500 to-gray-400", description: "Our mission to revolutionize vending", external: false },
  { name: "Our Divisions", url: "/divisions", icon: LucideIcons.Briefcase, color: "from-teal-500 to-cyan-500", description: "Explore VendX Mini, Max, Fresh, Digital & more", external: false },
  { name: "News & Updates", url: "/news", icon: LucideIcons.Newspaper, color: "from-blue-500 to-indigo-500", description: "Latest announcements and articles", external: false },
  { name: "Careers", url: "/careers", icon: LucideIcons.Users, color: "from-green-500 to-emerald-500", description: "Join the VendX team", external: false },
  { name: "Contact Us", url: "/contact", icon: LucideIcons.Phone, color: "from-primary to-accent", description: "Get in touch with our team", external: false },
];

const resolveIcon = (name: string): React.ElementType => {
  return (LucideIcons as any)[name] || LucideIcons.Sparkles;
};

const rowToLink = (r: BrandRow): LinkItem => ({
  name: r.name,
  url: r.url,
  icon: resolveIcon(r.icon),
  color: r.color,
  description: r.description,
  external: r.is_external,
  featured: r.is_featured,
  badge: r.badge ?? undefined,
});

const LinkCard = ({ link }: { link: LinkItem }) => {
  const content = (
    <Card className="relative bg-card/40 backdrop-blur-sm border-border/50 hover:border-primary/60 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5 overflow-hidden h-full">
      <div className={`absolute inset-0 bg-gradient-to-br ${link.color} opacity-0 group-hover:opacity-[0.07] transition-opacity duration-500`} />
      <CardContent className="p-0 relative">
        <div className="flex items-center gap-4 p-4">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${link.color} flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-lg`}>
            <link.icon className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">{link.name}</h3>
              {link.badge && (
                <Badge variant="outline" className="text-[10px] py-0 h-4 border-primary/40 text-primary/80">{link.badge}</Badge>
              )}
              {link.external && <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{link.description}</p>
          </div>
        </div>
        <div className={`h-1 bg-gradient-to-r ${link.color} transform scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500`} />
      </CardContent>
    </Card>
  );
  if (link.external) {
    return <a href={link.url} {...externalLinkProps(link.url)} className="block group">{content}</a>;
  }
  return <Link to={link.url} className="block group">{content}</Link>;
};

const FeaturedBrandCard = ({ link }: { link: LinkItem }) => {
  const inner = (
    <Card className="relative overflow-hidden border-border/50 hover:border-primary/60 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/20 h-full">
      <div className={`absolute inset-0 bg-gradient-to-br ${link.color} opacity-20 group-hover:opacity-30 transition-opacity`} />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
      <CardContent className="relative p-6 flex flex-col gap-4 min-h-[200px]">
        <div className="flex items-start justify-between">
          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${link.color} flex items-center justify-center shadow-xl group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500`}>
            <link.icon className="w-7 h-7 text-white" />
          </div>
          {link.badge && <Badge className={`bg-gradient-to-r ${link.color} text-white border-0 shadow-md`}>{link.badge}</Badge>}
        </div>
        <div className="flex-1">
          <h3 className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
            {link.name}
            <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </h3>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{link.description}</p>
        </div>
        <div className="text-xs text-primary/80 font-mono opacity-60 group-hover:opacity-100 transition-opacity">
          {link.url.replace(/^https?:\/\//, "")} →
        </div>
      </CardContent>
    </Card>
  );
  if (link.external) {
    return <a href={link.url} {...externalLinkProps(link.url)} className="block group">{inner}</a>;
  }
  return <Link to={link.url} className="block group">{inner}</Link>;
};

const LinksPage = () => {
  useSEO({
    title: "VendX Links — Explore Our Ecosystem & Brands",
    description: "Quick access to all VendX products, services, partner brands like Emos R Us and Host Heroz, and resources for customers and businesses.",
  });

  const [brandLinks, setBrandLinks] = useState<LinkItem[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("vendx_brand_links" as any)
        .select("*")
        .eq("is_active", true)
        .order("section")
        .order("sort_order");
      setBrandLinks(((data as any as BrandRow[]) || []).map(rowToLink));
      setLoadingBrands(false);
    })();
  }, []);

  const featuredBrands = brandLinks.filter((b) => b.featured);
  const otherBrands = brandLinks.filter((b) => !b.featured);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="fixed inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5 pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--primary)/10%,_transparent_50%)] pointer-events-none" />

      <div className="relative z-10 container mx-auto px-4 pt-24 pb-16">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-medium mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            The VendX Ecosystem
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            VendX Links
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
            Everything in one place — our products, partner brands, and resources for customers and businesses.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <Tabs defaultValue="customers" className="w-full">
            <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full mb-8 bg-card/40 backdrop-blur-sm h-auto p-1">
              <TabsTrigger value="customers" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary py-2.5">Customers</TabsTrigger>
              <TabsTrigger value="brands" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary py-2.5">Brands</TabsTrigger>
              <TabsTrigger value="business" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary py-2.5">Business</TabsTrigger>
              <TabsTrigger value="company" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary py-2.5">Company</TabsTrigger>
            </TabsList>

            <TabsContent value="customers" className="mt-0">
              <div className="grid sm:grid-cols-2 gap-3">
                {customerLinks.map((link) => <LinkCard key={link.name} link={link} />)}
              </div>
            </TabsContent>

            <TabsContent value="brands" className="mt-0 space-y-8">
              {loadingBrands ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : (
                <>
                  {featuredBrands.length > 0 && (
                    <div>
                      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                        <div className="w-1 h-4 bg-gradient-to-b from-primary to-accent rounded-full" />
                        Featured Partner Brands
                      </h2>
                      <div className="grid md:grid-cols-2 gap-4">
                        {featuredBrands.map((link) => <FeaturedBrandCard key={link.name} link={link} />)}
                      </div>
                    </div>
                  )}
                  {otherBrands.length > 0 && (
                    <div>
                      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                        <div className="w-1 h-4 bg-gradient-to-b from-primary to-accent rounded-full" />
                        VendX Divisions
                      </h2>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {otherBrands.map((link) => <LinkCard key={link.name} link={link} />)}
                      </div>
                    </div>
                  )}
                  {brandLinks.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No brand links available.</p>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="business" className="mt-0">
              <div className="grid sm:grid-cols-2 gap-3">
                {businessLinks.map((link) => <LinkCard key={link.name} link={link} />)}
              </div>
            </TabsContent>

            <TabsContent value="company" className="mt-0">
              <div className="grid sm:grid-cols-2 gap-3">
                {companyLinks.map((link) => <LinkCard key={link.name} link={link} />)}
              </div>
            </TabsContent>
          </Tabs>

          <div className="text-center mt-14 p-8 rounded-2xl bg-gradient-to-br from-primary/5 via-card/40 to-accent/5 border border-border/50 backdrop-blur-sm">
            <h3 className="text-xl font-semibold mb-2">Ready to get started?</h3>
            <p className="text-muted-foreground mb-5 text-sm">Join the VendX ecosystem or reach out to our team.</p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link to="/auth"><Button className="bg-accent hover:bg-accent/90 text-accent-foreground">Sign Up</Button></Link>
              <Link to="/contact"><Button variant="outline">Contact Us</Button></Link>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default LinksPage;
