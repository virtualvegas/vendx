import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, ExternalLink, PartyPopper, Package, Wrench, Sparkles, Star } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";

// Public Host Heroz Supabase (anon key — RLS protected, read-only public data)
const HH_URL = "https://lhrsktjlfyqotntacpxp.supabase.co";
const HH_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxocnNrdGpsZnlxb3RudGFjcHhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAyODg4NzksImV4cCI6MjA2NTg2NDg3OX0.85Goy1oHoKTlj31zgHsckw95EsXD7iPkrRHUfqpr-To";
const hh = createClient(HH_URL, HH_ANON, { auth: { persistSession: false } });

const HOST_HEROZ_URL = "https://hostheroz.com";
const LISTING_URL = (id: string) => `${HOST_HEROZ_URL}/listing/${id}`;

type Listing = {
  id: string;
  title: string;
  description: string | null;
  base_price: number | null;
  price_type: string | null;
  images: string[] | null;
  category_id: string | null;
  featured: boolean | null;
  tags: string[] | null;
};

type Category = { id: string; name: string };

const SERVICE_KEYWORDS = [
  "service", "dj", "band", "musician", "magician", "comedian", "performer",
  "host", "mc", "planner", "coordinator", "bartender", "caterer", "catering",
  "photograph", "videograph", "face paint", "balloon", "caricature",
  "cleaning", "security", "entertainer",
];

const isServiceCategory = (name?: string | null) => {
  if (!name) return false;
  const n = name.toLowerCase();
  return SERVICE_KEYWORDS.some((k) => n.includes(k));
};

const priceLabel = (type: string | null | undefined) => {
  if (!type) return "";
  const map: Record<string, string> = {
    daily: "/ day",
    hourly: "/ hr",
    flat: "",
    fixed: "",
    package: "/ package",
    event: "/ event",
  };
  return map[type.toLowerCase()] ?? `/ ${type}`;
};

const firstImage = (l: Listing) =>
  Array.isArray(l.images) && l.images.length > 0 ? String(l.images[0]) : null;

export default function EventRentalsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCat, setActiveCat] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useSEO({
    title: "Event Rentals — Host Heroz × VendX",
    description:
      "Live catalog of arcade rentals, party packages, DJs, photo booths, inflatables and event services from Host Heroz. Book directly at hostheroz.com.",
  });

  useEffect(() => {
    (async () => {
      try {
        const [{ data: l, error: lErr }, { data: c }] = await Promise.all([
          hh
            .from("marketplace_listings")
            .select("id,title,description,base_price,price_type,images,category_id,featured,tags")
            .eq("status", "active")
            .order("featured", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(120),
          hh.from("marketplace_categories").select("id,name").eq("active", true),
        ]);
        if (lErr) throw lErr;
        setListings((l as Listing[]) || []);
        setCategories((c as Category[]) || []);
      } catch (e: any) {
        setError(e?.message || "Failed to load catalog");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const filtered = useMemo(() => {
    if (activeCat === "all") return listings;
    if (activeCat === "services")
      return listings.filter((l) => isServiceCategory(catMap.get(l.category_id || "")));
    if (activeCat === "rentals")
      return listings.filter((l) => !isServiceCategory(catMap.get(l.category_id || "")));
    return listings.filter((l) => l.category_id === activeCat);
  }, [listings, activeCat, catMap]);

  const services = useMemo(
    () => filtered.filter((l) => isServiceCategory(catMap.get(l.category_id || ""))),
    [filtered, catMap],
  );
  const rentals = useMemo(
    () => filtered.filter((l) => !isServiceCategory(catMap.get(l.category_id || ""))),
    [filtered, catMap],
  );

  // Categories that actually have listings, for the filter bar
  const activeCategories = useMemo(() => {
    const ids = new Set(listings.map((l) => l.category_id).filter(Boolean) as string[]);
    return categories.filter((c) => ids.has(c.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [listings, categories]);

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
              <Sparkles className="w-3 h-3 mr-1" /> Live Catalog · Host Heroz
            </Badge>
            <h1 className="font-orbitron text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Event Rentals & Services
            </h1>
            <p className="text-lg text-muted-foreground mb-6">
              Throw an unforgettable celebration. Browse arcade rentals, party packages, DJs, photo booths,
              inflatables, and full event services — pulled live from our partner Host Heroz.
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
        <div className="container mx-auto space-y-12">
          {/* Filter bar */}
          {!loading && listings.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <FilterChip label={`All (${listings.length})`} active={activeCat === "all"} onClick={() => setActiveCat("all")} />
              <FilterChip label="Services" active={activeCat === "services"} onClick={() => setActiveCat("services")} />
              <FilterChip label="Rentals" active={activeCat === "rentals"} onClick={() => setActiveCat("rentals")} />
              <span className="w-px bg-border mx-1" />
              {activeCategories.map((c) => (
                <FilterChip
                  key={c.id}
                  label={c.name}
                  active={activeCat === c.id}
                  onClick={() => setActiveCat(c.id)}
                />
              ))}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-72 w-full rounded-xl" />
              ))}
            </div>
          ) : error ? (
            <EmptyState title="Couldn't reach Host Heroz" message={error} />
          ) : listings.length === 0 ? (
            <EmptyState
              title="No live listings yet"
              message="Host Heroz hasn't published anything yet. Visit their site for the full lineup."
            />
          ) : (
            <>
              {activeCat === "all" ? (
                <>
                  <CatalogSection
                    title="Services & Packages"
                    icon={Wrench}
                    empty="No event services in this view."
                    items={services}
                    catMap={catMap}
                  />
                  <CatalogSection
                    title="Rentals & Equipment"
                    icon={Package}
                    empty="No rental products in this view."
                    items={rentals}
                    catMap={catMap}
                  />
                </>
              ) : (
                <CatalogSection
                  title={
                    activeCat === "services"
                      ? "Services & Packages"
                      : activeCat === "rentals"
                        ? "Rentals & Equipment"
                        : catMap.get(activeCat) || "Catalog"
                  }
                  icon={Package}
                  empty="No listings match this filter yet."
                  items={filtered}
                  catMap={catMap}
                />
              )}
            </>
          )}

          <div className="text-center pt-8 border-t border-border/50">
            <PartyPopper className="w-10 h-10 mx-auto text-primary mb-3" />
            <h3 className="font-orbitron text-2xl font-bold mb-2">Want the full lineup?</h3>
            <p className="text-muted-foreground mb-5 max-w-xl mx-auto">
              See every package, custom build, and add-on Host Heroz offers — including real-time availability
              and instant booking.
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

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm border transition ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card/50 text-foreground border-border hover:border-primary/60"
      }`}
    >
      {label}
    </button>
  );
}

function CatalogSection({
  title,
  icon: Icon,
  items,
  empty,
  catMap,
}: {
  title: string;
  icon: any;
  items: Listing[];
  empty: string;
  catMap: Map<string, string>;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-orbitron text-2xl md:text-3xl font-bold flex items-center gap-3">
          <Icon className="w-6 h-6 text-primary" />
          {title}
        </h2>
        <Badge variant="secondary">
          {items.length} item{items.length === 1 ? "" : "s"}
        </Badge>
      </div>
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{empty}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((l) => (
            <ListingCard key={l.id} listing={l} category={catMap.get(l.category_id || "")} />
          ))}
        </div>
      )}
    </div>
  );
}

function ListingCard({ listing, category }: { listing: Listing; category?: string }) {
  const img = firstImage(listing);
  return (
    <a
      href={LISTING_URL(listing.id)}
      target="_blank"
      rel="noopener noreferrer"
      className="block group"
    >
      <Card className="overflow-hidden border-border/50 bg-card/50 backdrop-blur hover:border-primary/50 transition-all hover:shadow-[0_0_30px_-10px_hsl(var(--primary))] h-full flex flex-col">
        <div className="aspect-video bg-muted relative overflow-hidden">
          {img ? (
            <img
              src={img}
              alt={listing.title}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <PartyPopper className="w-12 h-12 text-muted-foreground/50" />
            </div>
          )}
          {listing.featured && (
            <Badge className="absolute top-2 left-2 bg-primary/90 backdrop-blur">
              <Star className="w-3 h-3 mr-1" /> Featured
            </Badge>
          )}
          <Badge className="absolute top-2 right-2 bg-background/80 text-foreground backdrop-blur">
            Host Heroz
          </Badge>
        </div>
        <CardContent className="p-4 space-y-2 flex-1 flex flex-col">
          <h3 className="font-semibold leading-tight line-clamp-2">{listing.title}</h3>
          {listing.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {listing.description.replace(/\n+/g, " ")}
            </p>
          )}
          <div className="flex items-center justify-between pt-2 mt-auto">
            <span className="font-orbitron text-lg font-bold text-primary">
              ${Number(listing.base_price ?? 0).toFixed(0)}
              <span className="text-xs text-muted-foreground ml-1 font-normal">
                {priceLabel(listing.price_type)}
              </span>
            </span>
            {category && (
              <Badge variant="outline" className="text-xs">
                {category}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </a>
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
