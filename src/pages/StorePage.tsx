import { useState, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import arcadeHeroImage from "@/assets/arcade-hero.png";
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
  Loader2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useShopifyProducts } from "@/hooks/useShopifyProducts";
import { ShopifyProductCard } from "@/components/store/ShopifyProductCard";
import { ShopifyCartDrawer } from "@/components/store/ShopifyCartDrawer";
import { SubscriptionsSection } from "@/components/store/SubscriptionsSection";

const categories = [
  { id: "all", label: "All Products", icon: Package },
  { id: "subscriptions", label: "Subscriptions", icon: Gift },
  { id: "apparel", label: "Apparel", icon: Shirt },
  { id: "accessories", label: "Accessories", icon: Package },
  { id: "snacks", label: "Snacks", icon: Cookie },
  { id: "tech", label: "Tech & Arcade", icon: Cpu },
];

type SortOption = "featured" | "newest" | "price-asc" | "price-desc" | "name";
type ViewMode = "grid" | "list";

const StorePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("featured");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const activeCategory = searchParams.get("category") || "all";

  // Build Shopify query based on category
  const shopifyQuery = useMemo(() => {
    if (activeCategory === "all") return undefined;
    if (activeCategory === "subscriptions") return "tag:subscription";
    return `product_type:${activeCategory}`;
  }, [activeCategory]);

  const { products, loading, error } = useShopifyProducts(shopifyQuery);

  const filteredAndSortedProducts = useMemo(() => {
    let result = products.filter(product =>
      product.node.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.node.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    switch (sortBy) {
      case "price-asc":
        result = [...result].sort((a, b) => {
          const priceA = parseFloat(a.node.priceRange.minVariantPrice.amount);
          const priceB = parseFloat(b.node.priceRange.minVariantPrice.amount);
          return priceA - priceB;
        });
        break;
      case "price-desc":
        result = [...result].sort((a, b) => {
          const priceA = parseFloat(a.node.priceRange.minVariantPrice.amount);
          const priceB = parseFloat(b.node.priceRange.minVariantPrice.amount);
          return priceB - priceA;
        });
        break;
      case "name":
        result = [...result].sort((a, b) => a.node.title.localeCompare(b.node.title));
        break;
      case "featured":
      case "newest":
      default:
        break;
    }

    return result;
  }, [products, searchQuery, sortBy]);

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

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      {/* Hero Section */}
      <section className="pt-24 pb-12 px-4 bg-gradient-space">
        <div className="container mx-auto text-center">
          <div className="flex justify-end mb-4">
            <ShopifyCartDrawer />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="text-primary glow-blue">VendX</span>{" "}
            <span className="text-foreground">Store</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
            Premium merchandise, subscription boxes, and exclusive items for vending enthusiasts
          </p>
          
          {/* Search Bar */}
          <div className="max-w-md mx-auto relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-card border-border"
            />
          </div>
        </div>
      </section>

      {/* Categories & Filters */}
      <section className="py-6 px-4 border-b border-border bg-card/50">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            {/* Category Filters */}
            <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide flex-1">
              {categories.map((cat) => {
                const Icon = cat.icon;
                return (
                  <Button
                    key={cat.id}
                    variant={activeCategory === cat.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleCategoryChange(cat.id)}
                    className="whitespace-nowrap"
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {cat.label}
                  </Button>
                );
              })}
            </div>

            {/* Sort & View Controls */}
            <div className="flex items-center gap-2">
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

              <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as ViewMode)}>
                <ToggleGroupItem value="grid" aria-label="Grid view" size="sm">
                  <Grid3X3 className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="list" aria-label="List view" size="sm">
                  <LayoutList className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          {/* Results count */}
          <div className="mt-4 text-sm text-muted-foreground">
            Showing {filteredAndSortedProducts.length} product{filteredAndSortedProducts.length !== 1 ? "s" : ""}
            {searchQuery && ` for "${searchQuery}"`}
          </div>
        </div>
      </section>

      {/* Subscriptions Section - Show on "all" or "subscriptions" category */}
      {(activeCategory === "all" || activeCategory === "subscriptions") && (
        <SubscriptionsSection />
      )}

      {/* Products Grid/List - Hide on subscriptions-only view */}
      {activeCategory !== "subscriptions" && (
      <section className="py-8 px-4">
        <div className="container mx-auto">
          {/* Section Header for Products */}
          {(activeCategory === "all" || activeCategory === "subscriptions") && filteredAndSortedProducts.length > 0 && (
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Package className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Shop Products</h2>
                <p className="text-muted-foreground text-sm">
                  {filteredAndSortedProducts.length} product{filteredAndSortedProducts.length !== 1 ? "s" : ""} available
                </p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">Error loading products</h3>
              <p className="text-muted-foreground">{error}</p>
            </div>
          ) : filteredAndSortedProducts.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No products found</h3>
              <p className="text-muted-foreground mb-4">
                {products.length === 0 
                  ? "No products have been added yet. Add products in Shopify to display them here."
                  : "Try adjusting your search or category filter"
                }
              </p>
              {searchQuery && (
                <Button 
                  variant="outline" 
                  onClick={() => setSearchQuery("")}
                >
                  Clear Search
                </Button>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredAndSortedProducts.map((product) => (
                <ShopifyProductCard key={product.node.id} product={product} viewMode="grid" />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {filteredAndSortedProducts.map((product) => (
                <ShopifyProductCard key={product.node.id} product={product} viewMode="list" />
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