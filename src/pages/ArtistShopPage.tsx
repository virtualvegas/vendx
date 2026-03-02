import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import StarField from "@/components/StarField";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ShoppingCart, Package, Download, Disc, Disc3, Image as ImageIcon, Music, Film, Filter } from "lucide-react";
import { useState } from "react";

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

const ArtistShopPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: artist, isLoading: artistLoading } = useQuery({
    queryKey: ["artist-shop", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media_artists")
        .select("id, name, slug, profile_image_url, banner_image_url, is_legacy, legacy_background_url, artist_type")
        .eq("slug", slug!)
        .eq("is_active", true)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["artist-shop-products", artist?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media_shop_products")
        .select("*, media_release:media_releases(id, title, media_type, cover_image_url, slug)")
        .eq("artist_id", artist!.id)
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!artist?.id,
  });

  const filtered = products?.filter((p: any) => {
    if (typeFilter === "all") return true;
    return p.product_type === typeFilter;
  });

  const productTypes = ["all", ...new Set(products?.map((p: any) => p.product_type) || [])];

  const isLoading = artistLoading || productsLoading;

  if (artistLoading) {
    return (
      <div className="relative min-h-screen bg-background">
        <StarField />
        <Navigation />
        <div className="relative z-10 pt-32 pb-20 container mx-auto px-4">
          <Skeleton className="h-10 w-1/3 mb-4" />
          <Skeleton className="h-6 w-1/2" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="relative min-h-screen bg-background">
        <StarField />
        <Navigation />
        <div className="relative z-10 pt-32 pb-20 text-center container mx-auto px-4">
          <h1 className="text-3xl font-bold text-foreground mb-4">Artist Not Found</h1>
          <Link to="/media/artists">
            <Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Artists</Button>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background">
      {artist.is_legacy && artist.legacy_background_url ? (
        <div className="fixed inset-0 z-0">
          <img src={artist.legacy_background_url} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-background/80" />
        </div>
      ) : (
        <StarField />
      )}
      <Navigation />

      <div className="relative z-10 pt-32 pb-20">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-12">
            {artist.profile_image_url && (
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-border mx-auto mb-4">
                <img src={artist.profile_image_url} alt={artist.name} className="w-full h-full object-cover" />
              </div>
            )}
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-2">
              {artist.name}
            </h1>
            <p className="text-muted-foreground mb-6">Official merchandise & releases</p>

            <div className="flex items-center justify-center gap-3 mb-8">
              <Link to={`/media/artists/${artist.slug}`}>
                <Button variant="outline" className="gap-2">
                  <Music className="w-4 h-4" /> Artist Profile
                </Button>
              </Link>
              <Link to="/media/artists">
                <Button variant="outline" className="gap-2">
                  <ShoppingCart className="w-4 h-4" /> All Artists
                </Button>
              </Link>
            </div>

            {/* Type Filter */}
            {productTypes.length > 2 && (
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
                    {type === "all" ? "All" : typeLabels[type] || type}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Products Grid */}
          {productsLoading ? (
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
              {filtered.map((product: any) => (
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
                      {typeLabels[product.product_type] || product.product_type}
                    </Badge>
                    {product.is_featured && (
                      <Badge className="absolute top-3 left-3 bg-accent text-accent-foreground">Featured</Badge>
                    )}
                    {product.compare_at_price && product.compare_at_price > product.price && (
                      <Badge className="absolute bottom-3 left-3 bg-destructive text-destructive-foreground">Sale</Badge>
                    )}
                  </div>
                  <CardContent className="p-5">
                    {product.media_release && (
                      <Link to="/media" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mb-2">
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
                        {product.tags.slice(0, 3).map((t: string) => (
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
              <h3 className="text-xl font-semibold text-foreground mb-2">No products yet</h3>
              <p className="text-muted-foreground">Check back soon for merchandise from {artist.name}!</p>
            </div>
          )}

          {/* Back link */}
          <div className="text-center mt-12">
            <Link to={`/media/artists/${artist.slug}`}>
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="w-4 h-4" /> Back to {artist.name}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ArtistShopPage;
