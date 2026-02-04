import { useState, useEffect, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import arcadeHeroImage from "@/assets/arcade-hero.png";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Search, 
  ShoppingCart, 
  Star, 
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
  DollarSign
} from "lucide-react";
import { useCart } from "@/hooks/useCart";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";


interface Product {
  id: string;
  name: string;
  slug: string;
  short_description: string;
  price: number;
  compare_at_price: number | null;
  category: string;
  images: string[];
  is_featured: boolean;
  is_subscription: boolean;
  subscription_price: number | null;
}

const categories = [
  { id: "all", label: "All Products", icon: Package },
  { id: "subscriptions", label: "Subscriptions", icon: Gift },
  { id: "apparel", label: "Apparel", icon: Shirt },
  { id: "accessories", label: "Accessories", icon: Star },
  { id: "snacks", label: "Snacks", icon: Cookie },
  { id: "tech", label: "Tech & Arcade", icon: Cpu },
  { id: "game-items", label: "Game Items", icon: Star },
];

type SortOption = "featured" | "newest" | "price-asc" | "price-desc" | "name";
type ViewMode = "grid" | "list";

const StorePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackBoxProduct, setSnackBoxProduct] = useState<{ images: string[] | null } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("featured");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const activeCategory = searchParams.get("category") || "all";
  const { cartCount, addToCart } = useCart();

  useEffect(() => {
    fetchProducts();
  }, [activeCategory]);

  useEffect(() => {
    const fetchSnackBoxProduct = async () => {
      const { data } = await supabase
        .from("store_products")
        .select("images")
        .eq("slug", "snack-in-the-box")
        .maybeSingle();
      if (data) setSnackBoxProduct(data);
    };
    fetchSnackBoxProduct();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    let query = supabase
      .from("store_products")
      .select("id, name, slug, short_description, price, compare_at_price, category, images, is_featured, is_subscription, subscription_price")
      .eq("is_active", true)
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false });

    if (activeCategory !== "all") {
      query = query.eq("category", activeCategory);
    }

    const { data, error } = await query;
    if (!error && data) {
      setProducts(data);
    }
    setLoading(false);
  };

  const filteredAndSortedProducts = useMemo(() => {
    let result = products.filter(product =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.short_description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    switch (sortBy) {
      case "newest":
        // Already sorted by created_at from query
        break;
      case "price-asc":
        result = [...result].sort((a, b) => {
          const priceA = a.is_subscription ? (a.subscription_price || 0) : a.price;
          const priceB = b.is_subscription ? (b.subscription_price || 0) : b.price;
          return priceA - priceB;
        });
        break;
      case "price-desc":
        result = [...result].sort((a, b) => {
          const priceA = a.is_subscription ? (a.subscription_price || 0) : a.price;
          const priceB = b.is_subscription ? (b.subscription_price || 0) : b.price;
          return priceB - priceA;
        });
        break;
      case "name":
        result = [...result].sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "featured":
      default:
        // Featured items first (already sorted from query)
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

      {/* Featured Arcade Subscription Banner */}
      {activeCategory === "all" && (
        <section className="py-8 px-4">
          <div className="container mx-auto">
            <Link to="/store/arcade-subscription">
              <div className="relative rounded-xl overflow-hidden bg-gradient-to-r from-purple-500/20 via-indigo-500/20 to-purple-500/20 p-8 md:p-12 border border-purple-500/30 hover:border-purple-500/50 transition-all group">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="flex-1 text-center md:text-left">
                    <div className="flex flex-wrap gap-2 mb-3 justify-center md:justify-start">
                      <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">COMING SOON</Badge>
                      <Badge variant="outline" className="border-amber-500/50 text-amber-400">MA Only</Badge>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold mb-3">
                      <span className="text-purple-400">VendX</span> Arcade Subscription
                    </h2>
                    <p className="text-muted-foreground mb-4">
                      Real arcade machines in your home. No ownership, no repairs — just play. Starting at $99/month.
                    </p>
                    <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                      Join Waitlist
                    </Button>
                  </div>
                  <div className="w-48 h-48 rounded-lg overflow-hidden">
                    <img 
                      src={arcadeHeroImage} 
                      alt="Arcade Machine"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* Featured Banner for Snack In The Box */}
      {activeCategory === "all" && (
        <section className="py-8 px-4">
          <div className="container mx-auto">
            <Link to="/store/snack-in-the-box">
              <div className="relative rounded-xl overflow-hidden bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 p-8 md:p-12 border border-primary/30 hover:border-primary/50 transition-all group">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="flex-1 text-center md:text-left">
                    <Badge className="mb-3 bg-accent text-accent-foreground">NEW SUBSCRIPTION</Badge>
                    <h2 className="text-3xl md:text-4xl font-bold mb-3">
                      <span className="text-accent glow-green">Snack</span> In The Box
                    </h2>
                    <p className="text-muted-foreground mb-4">
                      Monthly premium snack box with customizable add-ons. Starting at $29.99/month.
                    </p>
                    <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                      Subscribe Now
                    </Button>
                  </div>
                  <div className="w-48 h-48 rounded-lg overflow-hidden">
                    <img 
                      src={snackBoxProduct?.images?.[0] || "https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=800"}
                      alt="Snack Box"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* Products Grid/List */}
      <section className="py-8 px-4">
        <div className="container mx-auto">
          {loading ? (
            <div className={viewMode === "grid" 
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
              : "flex flex-col gap-4"
            }>
              {[...Array(8)].map((_, i) => (
                <Card key={i} className={`bg-card border-border animate-pulse ${viewMode === "list" ? "flex flex-row" : ""}`}>
                  <div className={viewMode === "grid" ? "aspect-square bg-muted" : "w-32 h-32 bg-muted flex-shrink-0"} />
                  <CardContent className="p-4 flex-1">
                    <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                    <div className="h-3 bg-muted rounded w-full mb-4" />
                    <div className="h-6 bg-muted rounded w-1/4" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredAndSortedProducts.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No products found</h3>
              <p className="text-muted-foreground">Try adjusting your search or category filter</p>
              {searchQuery && (
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setSearchQuery("")}
                >
                  Clear Search
                </Button>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredAndSortedProducts.map((product) => (
                <Card key={product.id} className="bg-card border-border hover:border-primary/50 transition-all group h-full flex flex-col">
                  <Link to={`/store/${product.slug}`} className="flex-1">
                    <div className="aspect-square relative overflow-hidden rounded-t-lg">
                      <img
                        src={product.images[0] || "https://via.placeholder.com/400"}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      {product.is_featured && (
                        <Badge className="absolute top-2 left-2 bg-primary">Featured</Badge>
                      )}
                      {product.is_subscription && (
                        <Badge className="absolute top-2 right-2 bg-accent text-accent-foreground">Subscription</Badge>
                      )}
                      {product.compare_at_price && product.compare_at_price > product.price && (
                        <Badge className="absolute bottom-2 left-2 bg-destructive">Sale</Badge>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-1">
                        {product.name}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {product.short_description}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-primary">
                          ${product.is_subscription ? product.subscription_price?.toFixed(2) : product.price.toFixed(2)}
                        </span>
                        {product.is_subscription && (
                          <span className="text-sm text-muted-foreground">/month</span>
                        )}
                        {product.compare_at_price && product.compare_at_price > product.price && (
                          <span className="text-sm text-muted-foreground line-through">
                            ${product.compare_at_price.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Link>
                  {!product.is_subscription && (
                    <div className="px-4 pb-4">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full gap-2"
                        onClick={(e) => {
                          e.preventDefault();
                          addToCart(product.id, 1);
                        }}
                      >
                        <ShoppingCart className="h-4 w-4" />
                        Quick Add
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            // List View
            <div className="flex flex-col gap-4">
              {filteredAndSortedProducts.map((product) => (
                <Card key={product.id} className="bg-card border-border hover:border-primary/50 transition-all group">
                  <div className="flex flex-col sm:flex-row">
                    <Link to={`/store/${product.slug}`} className="sm:w-48 sm:h-48 flex-shrink-0">
                      <div className="aspect-square sm:aspect-auto sm:h-full relative overflow-hidden rounded-t-lg sm:rounded-l-lg sm:rounded-tr-none">
                        <img
                          src={product.images[0] || "https://via.placeholder.com/400"}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        {product.is_featured && (
                          <Badge className="absolute top-2 left-2 bg-primary">Featured</Badge>
                        )}
                      </div>
                    </Link>
                    <CardContent className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-4">
                          <Link to={`/store/${product.slug}`}>
                            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                              {product.name}
                            </h3>
                          </Link>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {product.is_subscription && (
                              <Badge className="bg-accent text-accent-foreground">Subscription</Badge>
                            )}
                            {product.compare_at_price && product.compare_at_price > product.price && (
                              <Badge className="bg-destructive">Sale</Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {product.short_description}
                        </p>
                      </div>
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-bold text-primary">
                            ${product.is_subscription ? product.subscription_price?.toFixed(2) : product.price.toFixed(2)}
                          </span>
                          {product.is_subscription && (
                            <span className="text-sm text-muted-foreground">/month</span>
                          )}
                          {product.compare_at_price && product.compare_at_price > product.price && (
                            <span className="text-sm text-muted-foreground line-through">
                              ${product.compare_at_price.toFixed(2)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {!product.is_subscription && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="gap-2"
                              onClick={() => addToCart(product.id, 1)}
                            >
                              <ShoppingCart className="h-4 w-4" />
                              Quick Add
                            </Button>
                          )}
                          <Button asChild size="sm">
                            <Link to={`/store/${product.slug}`}>
                              View Details
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Cart FAB */}
      <Link 
        to="/store/cart"
        className="fixed bottom-6 right-6 z-50"
      >
        <Button size="lg" className="rounded-full h-14 w-14 shadow-lg relative">
          <ShoppingCart className="h-6 w-6" />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-accent text-accent-foreground text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
              {cartCount}
            </span>
          )}
        </Button>
      </Link>

      <Footer />
    </div>
  );
};

export default StorePage;
