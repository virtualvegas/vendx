import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, ExternalLink, PartyPopper, Package, Wrench, Calendar, Sparkles } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";

type PartnerProduct = {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  price: number;
  currency: string;
  category: string | null;
  images: any;
  image_url: string | null;
  is_subscription: boolean;
  subscription_interval: string | null;
  product_url: string | null;
  partner_id: string;
};

type Partner = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  website_url: string | null;
};

const HOST_HEROZ_URL = "https://hostheroz.com";
const PARTNER_SLUGS = ["host-heroz", "hostheroz"];

const isServiceItem = (p: PartnerProduct) => {
  const cat = (p.category || "").toLowerCase();
  return (
    p.is_subscription ||
    cat.includes("service") ||
    cat.includes("rental") ||
    cat.includes("package") ||
    cat.includes("booking") ||
    cat.includes("event")
  );
};

const productImage = (p: PartnerProduct): string | null => {
  if (p.image_url) return p.image_url;
  if (Array.isArray(p.images) && p.images.length > 0) return String(p.images[0]);
  return null;
};

export default function EventRentalsPage() {
  const [partner, setPartner] = useState<Partner | null>(null);
  const [products, setProducts] = useState<PartnerProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useSEO({
    title: "Event Rentals — Host Heroz × VendX",
    description:
      "Browse party rentals, arcade machines, and event packages from Host Heroz. Book online or view the full catalog at hostheroz.com.",
  });

  useEffect(() => {
    (async () => {
      const { data: partners } = await supabase
        .from("vendx_catalog_partners")
        .select("id,name,slug,logo_url,website_url")
        .in("slug", PARTNER_SLUGS)
        .eq("is_active", true)
        .limit(1);

      const p = partners?.[0] as Partner | undefined;
      setPartner(p ?? null);

      if (p) {
        const { data: prods } = await supabase
          .from("vendx_partner_products")
          .select(
            "id,name,slug,short_description,description,price,currency,category,images,image_url,is_subscription,subscription_interval,product_url,partner_id",
          )
          .eq("partner_id", p.id)
          .eq("is_active", true)
          .order("is_subscription", { ascending: false })
          .order("price", { ascending: true })
          .limit(60);
        setProducts((prods as any) || []);
      }
      setLoading(false);
    })();
  }, []);

  const services = useMemo(() => products.filter(isServiceItem), [products]);
  const items = useMemo(() => products.filter((p) => !isServiceItem(p)), [products]);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Navigation />

      {/* Hero */}
      <section className="relative pt-32 pb-16 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.15),transparent_50%)]" />
        <div className="container mx-auto relative">
          <div className="max-w-3xl">
            <Badge variant="outline" className="mb-4 border-primary/50 text-primary">
              <Sparkles className="w-3 h-3 mr-1" /> Partner Catalog · Live API
            </Badge>
            <h1 className="font-orbitron text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Event Rentals by Host Heroz
            </h1>
            <p className="text-lg text-muted-foreground mb-6">
              Throw an unforgettable celebration. Browse rental packages, arcade machines, and party services pulled
              live from our partner Host Heroz — book directly through their hosted checkout.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="font-orbitron">
                <a href={HOST_HEROZ_URL} target="_blank" rel="noopener noreferrer">
                  View All at Host Heroz <ExternalLink className="ml-2 w-4 h-4" />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#catalog">
                  Browse Catalog <ArrowRight className="ml-2 w-4 h-4" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Catalog */}
      <section id="catalog" className="px-4 py-12">
        <div className="container mx-auto space-y-16">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-72 w-full rounded-xl" />
              ))}
            </div>
          ) : !partner ? (
            <EmptyState
              title="Partner not configured yet"
              message="Host Heroz isn't connected to the VendX partner API yet. You can still browse their full catalog on their site."
            />
          ) : products.length === 0 ? (
            <EmptyState
              title="No live products synced yet"
              message="Host Heroz hasn't pushed any catalog items through the API yet. Visit their site for the full lineup."
            />
          ) : (
            <>
              <CatalogSection
                title="Services & Packages"
                icon={Wrench}
                empty="No event packages synced yet."
                items={services}
              />
              <CatalogSection
                title="Products & Rentals"
                icon={Package}
                empty="No individual rental products synced yet."
                items={items}
              />
            </>
          )}

          <div className="text-center pt-8 border-t border-border/50">
            <PartyPopper className="w-10 h-10 mx-auto text-primary mb-3" />
            <h3 className="font-orbitron text-2xl font-bold mb-2">Want the full lineup?</h3>
            <p className="text-muted-foreground mb-5 max-w-xl mx-auto">
              See every package, custom build, and add-on Host Heroz offers — including availability and instant
              booking.
            </p>
            <Button asChild size="lg" className="font-orbitron">
              <a href={HOST_HEROZ_URL} target="_blank" rel="noopener noreferrer">
                View All at Host Heroz <ExternalLink className="ml-2 w-4 h-4" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function CatalogSection({
  title,
  icon: Icon,
  items,
  empty,
}: {
  title: string;
  icon: any;
  items: PartnerProduct[];
  empty: string;
}) {
  if (items.length === 0) {
    return (
      <div>
        <SectionHeader title={title} icon={Icon} count={0} />
        <p className="text-muted-foreground text-sm">{empty}</p>
      </div>
    );
  }
  return (
    <div>
      <SectionHeader title={title} icon={Icon} count={items.length} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}

function SectionHeader({ title, icon: Icon, count }: { title: string; icon: any; count: number }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h2 className="font-orbitron text-2xl md:text-3xl font-bold flex items-center gap-3">
        <Icon className="w-6 h-6 text-primary" />
        {title}
      </h2>
      <Badge variant="secondary">{count} item{count === 1 ? "" : "s"}</Badge>
    </div>
  );
}

function ProductCard({ product }: { product: PartnerProduct }) {
  const img = productImage(product);
  return (
    <Card className="group overflow-hidden border-border/50 bg-card/50 backdrop-blur hover:border-primary/50 transition-all hover:shadow-[0_0_30px_-10px_hsl(var(--primary))]">
      <Link to={`/store/partner/${product.id}`} className="block">
        <div className="aspect-video bg-muted relative overflow-hidden">
          {img ? (
            <img
              src={img}
              alt={product.name}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <PartyPopper className="w-12 h-12 text-muted-foreground/50" />
            </div>
          )}
          {product.is_subscription && (
            <Badge className="absolute top-2 right-2 bg-primary/90 backdrop-blur">
              <Calendar className="w-3 h-3 mr-1" />
              {product.subscription_interval || "Recurring"}
            </Badge>
          )}
        </div>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold leading-tight line-clamp-2">{product.name}</h3>
          </div>
          {product.short_description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{product.short_description}</p>
          )}
          <div className="flex items-center justify-between pt-2">
            <span className="font-orbitron text-lg font-bold text-primary">
              ${Number(product.price).toFixed(2)}
              <span className="text-xs text-muted-foreground ml-1">{product.currency}</span>
            </span>
            {product.category && (
              <Badge variant="outline" className="text-xs capitalize">
                {product.category}
              </Badge>
            )}
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="text-center py-16 border border-dashed border-border rounded-xl">
      <PartyPopper className="w-12 h-12 mx-auto text-muted-foreground/60 mb-4" />
      <h3 className="font-orbitron text-xl font-bold mb-2">{title}</h3>
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">{message}</p>
      <Button asChild>
        <a href={HOST_HEROZ_URL} target="_blank" rel="noopener noreferrer">
          Visit Host Heroz <ExternalLink className="ml-2 w-4 h-4" />
        </a>
      </Button>
    </div>
  );
}
