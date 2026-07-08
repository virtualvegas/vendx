import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Package,
  Shirt,
  Cpu,
  Cookie,
  Gift,
  SlidersHorizontal,
  ArrowUpDown,
  Grid3X3,
  LayoutList,
  TrendingUp,
  Clock,
  DollarSign,
  Loader2,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SubscriptionsSection } from "@/components/store/SubscriptionsSection";
import { StoreProductCard } from "@/components/store/StoreProductCard";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

interface StoreProduct {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  description: string;
  price: number;
  compare_at_price: number | null;
  category: string;
  images: string[];
  stock: number | null;
  low_stock_threshold?: number | null;
  is_subscription: boolean;
  subscription_price: number | null;
  retail_status: string | null;
  retail_links: Json | null;
  shopify_handle: string | null;
  created_at: string;
}

const categories = [
  { id: "all", label: "All", icon: Package },
  { id: "subscriptions", label: "Subscriptions", icon: Gift },
  { id: "arcade_sales", label: "Arcade", icon: Cpu },
  { id: "arcade_refurbished", label: "Refurbished", icon: Cpu },
  { id: "apparel", label: "Apparel", icon: Shirt },
  { id: "accessories", label: "Accessories", icon: Package },
  { id: "snacks", label: "Snacks", icon: Cookie },
  { id: "tech", label: "Tech", icon: Cpu },
];

type SortOption = "featured" | "newest" | "price-asc" | "price-desc" | "name";
type ViewMode = "grid" | "list";
type QuickFilter = "none" | "sale" | "new" | "in_stock";

const StorePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("featured");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("none");
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const activeCategory = searchParams.get("category") || "all";

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const [{ data, error }, { data: partnerData }] = await Promise.all([
      supabase
        .from("store_products")
        .select("id, name, slug, short_description, description, price, compare_at_price, category, images, stock, is_subscription, subscription_price, retail_status, retail_links, shopify_handle, created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("vendx_partner_products")
        .select("id, name, slug, short_description, description, price, category, images, image_url, stock, is_subscription, subscription_interval, last_synced_at, partner_id, external_product_id, vendx_catalog_partners(name, slug)")
        .eq("is_active", true)
        .order("last_synced_at", { ascending: false }),
    ]);

    const combined: StoreProduct[] = [];
    if (!error && data) combined.push(...(data as StoreProduct[]));
    if (partnerData) {
      for (const p of partnerData as any[]) {
        const imgs = Array.isArray(p.images) && p.images.length ? p.images : (p.image_url ? [p.image_url] : []);
        combined.push({
          id: `partner:${p.id}`,
          name: p.name,
          slug: `partner/${p.id}`,
          short_description: p.short_description || `via ${p.vendx_catalog_partners?.name || "partner"}`,
          description: p.description || "",
          price: Number(p.price),
          compare_at_price: null,
          category: p.category || "partner",
          images: imgs,
          stock: p.stock,
          is_subscription: !!p.is_subscription,
          subscription_price: p.is_subscription ? Number(p.price) : null,
          retail_status: "online_only",
          retail_links: null,
          shopify_handle: null,
          created_at: p.last_synced_at,
        });
      }
    }
    setProducts(combined);
    setLoading(false);
  };

  const nonSubProducts = useMemo(() => products.filter((p) => !p.is_subscription), [products]);

  const featuredProducts = useMemo(
    () => nonSubProducts.filter((p) => p.compare_at_price && p.compare_at_price > p.price).slice(0, 4),
    [nonSubProducts]
  );

  const newestProducts = useMemo(
    () =>
      [...nonSubProducts]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 4),
    [nonSubProducts]
  );

  const filteredAndSortedProducts = useMemo(() => {
    let result = products;

    if (activeCategory !== "all" && activeCategory !== "subscriptions") {
      result = result.filter((p) => p.category === activeCategory);
    }
    if (activeCategory === "subscriptions") {
      result = result.filter((p) => p.is_subscription);
    }
    if (activeCategory === "all") {
      result = result.filter((p) => !p.is_subscription);
    }

    if (quickFilter === "sale") {
      result = result.filter((p) => p.compare_at_price !== null && p.compare_at_price > p.price);
    } else if (quickFilter === "new") {
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      result = result.filter((p) => new Date(p.created_at).getTime() > twoWeeksAgo);
    } else if (quickFilter === "in_stock") {
      result = result.filter((p) => p.stock === null || p.stock > 0);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.short_description?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
      );
    }

    switch (sortBy) {
      case "price-asc":
        result = [...result].sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        result = [...result].sort((a, b) => b.price - a.price);
        break;
      case "name":
        result = [...result].sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "newest":
        result = [...result].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      default:
        break;
    }

    return result;
  }, [products, searchQuery, sortBy, activeCategory, quickFilter]);

  const sortOptions = [
    { value: "featured", label: "Featured", icon: TrendingUp },
    { value: "newest", label: "Newest", icon: Clock },
    { value: "price-asc", label: "Price: Low to High", icon: DollarSign },
    { value: "price-desc", label: "Price: High to Low", icon: DollarSign },
    { value: "name", label: "Name A-Z", icon: ArrowUpDown },
  ];

  const handleCategoryChange = (categoryId: string) => {
    if (categoryId === "all") {
      searchParams.delete("category");
    } else {
      searchParams.set("category", categoryId);
    }
    setSearchParams(searchParams);
  };

  const isBrowsing = activeCategory !== "all" || !!searchQuery || quickFilter !== "none";
  const activeCategoryLabel = categories.find((c) => c.id === activeCategory)?.label || "All";

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Compact Hero */}
      <section className="pt-24 pb-8 px-4 bg-gradient-space border-b border-border/50">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className="border-primary/40 text-primary bg-primary/5">
                  <Sparkles className="w-3 h-3 mr-1" /> VendX Store
                </Badge>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">
                <span className="text-foreground">Shop the </span>
                <span className="text-primary glow-blue">ecosystem</span>
              </h1>
              <p className="text-muted-foreground text-base max-w-xl">
                Merch, arcade gear, snack subscriptions, and partner goods — one checkout, everywhere.
              </p>
            </div>

            <div className="w-full md:w-80 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search products…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-9 bg-card/80 backdrop-blur border-border h-11"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Sticky Category + Filter Bar */}
      <section className="sticky top-16 z-30 py-3 px-4 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="container mx-auto space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide flex-1 -mx-1 px-1">
              {categories.map((cat) => {
                const Icon = cat.icon;
                const active = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryChange(cat.id)}
                    className={`whitespace-nowrap inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm border transition-all ${
                      active
                        ? "bg-primary text-primary-foreground border-primary shadow-[0_0_20px_hsl(var(--primary)/0.35)]"
                        : "bg-card/60 text-foreground border-border hover:border-primary/40 hover:text-primary"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {cat.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <SlidersHorizontal className="h-4 w-4" />
                    <span className="hidden sm:inline">Sort</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {sortOptions.map((option) => {
                    const Icon = option.icon;
                    return (
                      <DropdownMenuItem
                        key={option.value}
                        onClick={() => setSortBy(option.value as SortOption)}
                        className={sortBy === option.value ? "bg-accent" : ""}
                      >
                        <Icon className="h-4 w-4 mr-2" />
                        {option.label}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={(v) => v && setViewMode(v as ViewMode)}
                className="hidden sm:flex"
              >
                <ToggleGroupItem value="grid" aria-label="Grid view" size="sm">
                  <Grid3X3 className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="list" aria-label="List view" size="sm">
                  <LayoutList className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          {/* Quick filter chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground uppercase tracking-wider mr-1">Quick</span>
            {[
              { id: "none", label: "All", icon: null },
              { id: "sale", label: "On Sale", icon: Tag },
              { id: "new", label: "New", icon: Sparkles },
              { id: "in_stock", label: "In Stock", icon: Package },
            ].map((f) => {
              const active = quickFilter === f.id;
              const Icon = f.icon;
              return (
                <button
                  key={f.id}
                  onClick={() => setQuickFilter(f.id as QuickFilter)}
                  className={`text-xs px-2.5 py-1 rounded-md border transition-colors inline-flex items-center gap-1 ${
                    active
                      ? "bg-accent/30 border-accent text-accent-foreground"
                      : "bg-transparent border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {Icon && <Icon className="h-3 w-3" />}
                  {f.label}
                </button>
              );
            })}
            <span className="ml-auto text-xs text-muted-foreground">
              {filteredAndSortedProducts.length} result{filteredAndSortedProducts.length !== 1 ? "s" : ""}
              {searchQuery && ` · "${searchQuery}"`}
            </span>
          </div>
        </div>
      </section>

      {/* Featured strips only on default landing */}
      {!isBrowsing && !loading && (
        <>
          {featuredProducts.length > 0 && (
            <section className="pt-10 pb-4 px-4">
              <div className="container mx-auto">
                <div className="flex items-end justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-destructive/15 flex items-center justify-center">
                      <Tag className="w-5 h-5 text-destructive" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">On Sale</h2>
                      <p className="text-muted-foreground text-sm">Limited-time markdowns</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setQuickFilter("sale")}>
                    View all →
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {featuredProducts.map((product) => (
                    <StoreProductCard key={product.id} product={product} viewMode="grid" />
                  ))}
                </div>
              </div>
            </section>
          )}

          {newestProducts.length > 0 && (
            <section className="pt-6 pb-4 px-4">
              <div className="container mx-auto">
                <div className="flex items-end justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">Just Landed</h2>
                      <p className="text-muted-foreground text-sm">Fresh drops from across the ecosystem</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSortBy("newest")}>
                    Sort by newest →
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {newestProducts.map((product) => (
                    <StoreProductCard key={product.id} product={product} viewMode="grid" />
                  ))}
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {/* Subscriptions */}
      {(activeCategory === "all" || activeCategory === "subscriptions") && <SubscriptionsSection />}

      {/* Main Products Grid/List */}
      {activeCategory !== "subscriptions" && (
        <section className="py-10 px-4">
          <div className="container mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Package className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">
                  {isBrowsing ? activeCategoryLabel : "Browse Everything"}
                </h2>
                <p className="text-muted-foreground text-sm">
                  {filteredAndSortedProducts.length} product{filteredAndSortedProducts.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredAndSortedProducts.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-border rounded-xl">
                <Package className="h-14 w-14 mx-auto text-muted-foreground/60 mb-4" />
                <h3 className="text-lg font-semibold mb-1">No products found</h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  {searchQuery ? "Try a different search term or clear filters." : "Nothing here yet — check back soon."}
                </p>
                {(searchQuery || quickFilter !== "none" || activeCategory !== "all") && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchQuery("");
                      setQuickFilter("none");
                      handleCategoryChange("all");
                    }}
                  >
                    Reset filters
                  </Button>
                )}
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredAndSortedProducts.map((product) => (
                  <StoreProductCard key={product.id} product={product} viewMode="grid" />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {filteredAndSortedProducts.map((product) => (
                  <StoreProductCard key={product.id} product={product} viewMode="list" />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
};

export default StorePage;
