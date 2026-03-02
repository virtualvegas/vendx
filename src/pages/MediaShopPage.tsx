import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import StarField from "@/components/StarField";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingCart, Music, Film, Disc3, Filter, Package, Download, Disc, Image as ImageIcon } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";

interface MediaShopProduct {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  product_type: string;
  price: number;
  compare_at_price: number | null;
  image_url: string | null;
  is_featured: boolean | null;
  stock_quantity: number;
  tags: string[] | null;
  media_release_id: string | null;
  media_release: {
    id: string;
    title: string;
    media_type: string;
    cover_image_url: string | null;
    slug: string;
  } | null;
}

const typeLabels: Record<string, string> = {
  merch: "Merch",
  digital_download: "Digital Download",
  vinyl: "Vinyl",
  cd: "CD",
  poster: "Poster",
  other: "Other",
};

const typeIcons: Record<string, React.ReactNode> = {
  merch: <Package className="w-4 h-4" />,
  digital_download: <Download className="w-4 h-4" />,
  vinyl: <Disc className="w-4 h-4" />,
  cd: <Disc3 className="w-4 h-4" />,
  poster: <ImageIcon className="w-4 h-4" />,
  other: <Package className="w-4 h-4" />,
};

const MediaShopPage = () => {
  const [typeFilter, setTypeFilter] = useState<string>("all");

  useSEO({
    title: "VendX Music & Film Shop",
    description: "Official merch, vinyl, digital downloads, and more from VendX Music & Film.",
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ["media-shop-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media_shop_products")
        .select("*, media_release:media_releases(id, title, media_type, cover_image_url, slug)")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as unknown as MediaShopProduct[];
    },
  });

  const filtered = products?.filter((p) => {
    if (typeFilter === "all") return true;
    return p.product_type === typeFilter;
  });

  const productTypes = ["all", "merch", "digital_download", "vinyl", "cd", "poster"];

  return (
    <div className="relative min-h-screen bg-background">
      <StarField />
      <Navigation />

      <div className="relative z-10 pt-32 pb-20">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-6">
              <ShoppingCart className="w-12 h-12 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              VendX Music & Film Shop
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
              Official merch, vinyl, digital downloads, and more from VendX Music & Film
            </p>
            <div className="flex items-center justify-center gap-3 mb-8">
              <Link to="/media">
                <Button variant="outline" className="gap-2">
                  <Film className="w-4 h-4" /> Releases
                </Button>
              </Link>
              <Link to="/media/track-shop">
                <Button variant="outline" className="gap-2">
                  <Music className="w-4 h-4" /> Track Shop
                </Button>
              </Link>
            </div>

            {/* Type Filter */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {productTypes.map((type) => (
                <Button
                  key={type}
                  variant={typeFilter === type ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTypeFilter(type)}
                  className="gap-2"
                >
                  {type === "all" ? <Filter className="w-4 h-4" /> : typeIcons[type]}
                  {type === "all" ? "All" : typeLabels[type]}
                </Button>
              ))}
            </div>
          </div>

          {/* Products Grid */}
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="bg-card/50 border-border/50">
                  <Skeleton className="h-56 rounded-t-lg" />
                  <CardContent className="p-5">
                    <Skeleton className="h-5 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filtered && filtered.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filtered.map((product) => (
                <Card
                  key={product.id}
                  className="group bg-card/50 border-border/50 hover:border-primary/50 transition-all duration-300 overflow-hidden"
                >
                  <div className="relative h-56 bg-muted overflow-hidden">
                    {product.image_url || product.media_release?.cover_image_url ? (
                      <img
                        src={product.image_url || product.media_release?.cover_image_url || ""}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-16 h-16 text-muted-foreground/30" />
                      </div>
                    )}

                    <Badge className="absolute top-3 right-3 bg-background/80 text-foreground capitalize gap-1">
                      {typeIcons[product.product_type]}
                      {typeLabels[product.product_type]}
                    </Badge>

                    {product.is_featured && (
                      <Badge className="absolute top-3 left-3 bg-accent text-accent-foreground">Featured</Badge>
                    )}

                    {product.compare_at_price && product.compare_at_price > product.price && (
                      <Badge className="absolute bottom-3 left-3 bg-destructive text-destructive-foreground">
                        Sale
                      </Badge>
                    )}
                  </div>

                  <CardContent className="p-5">
                    {product.media_release && (
                      <Link to={`/media`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline mb-2">
                        {product.media_release.media_type === "music" ? <Music className="w-3 h-3" /> : <Film className="w-3 h-3" />}
                        {product.media_release.title}
                      </Link>
                    )}
                    <h3 className="text-lg font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                      {product.title}
                    </h3>

                    {product.description && (
                      <p className="text-muted-foreground text-sm mb-3 line-clamp-2">{product.description}</p>
                    )}

                    {product.tags && product.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {product.tags.slice(0, 3).map((t) => (
                          <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-auto">
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold text-foreground">${Number(product.price).toFixed(2)}</span>
                        {product.compare_at_price && product.compare_at_price > product.price && (
                          <span className="text-sm text-muted-foreground line-through">
                            ${Number(product.compare_at_price).toFixed(2)}
                          </span>
                        )}
                      </div>
                      {product.stock_quantity <= 0 && product.product_type !== "digital_download" && (
                        <Badge variant="outline" className="text-destructive border-destructive/30">Sold Out</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <ShoppingCart className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No products found</h3>
              <p className="text-muted-foreground">Check back soon for new merchandise!</p>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default MediaShopPage;
