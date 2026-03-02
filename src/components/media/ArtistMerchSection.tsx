import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Package, Download, Disc, Disc3, Image as ImageIcon, Music, Film, ShoppingCart } from "lucide-react";

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

interface ArtistMerchSectionProps {
  artistId: string;
  artistName: string;
  /** If provided, only show products linked to this release */
  releaseId?: string;
  /** Compact mode for inline release cards */
  compact?: boolean;
}

const ArtistMerchSection = ({ artistId, artistName, releaseId, compact = false }: ArtistMerchSectionProps) => {
  const { data: products, isLoading } = useQuery({
    queryKey: ["artist-merch", artistId, releaseId],
    queryFn: async () => {
      let query = supabase
        .from("media_shop_products")
        .select("*, media_release:media_releases(id, title, media_type, cover_image_url, slug)")
        .eq("artist_id", artistId)
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (releaseId) {
        query = query.eq("media_release_id", releaseId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!artistId,
  });

  if (isLoading || !products || products.length === 0) return null;

  if (compact) {
    return (
      <div className="mt-3 space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <ShoppingCart className="w-3 h-3" /> Available Merch
        </p>
        {products.slice(0, 3).map((product: any) => (
          <div key={product.id} className="flex items-center gap-2 text-xs p-1.5 rounded bg-muted/50 hover:bg-muted transition-colors">
            {product.image_url ? (
              <img src={product.image_url} alt={product.title} className="w-8 h-8 rounded object-cover flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                {typeIcons[product.product_type] || <Package className="w-3 h-3 text-muted-foreground/50" />}
              </div>
            )}
            <span className="flex-1 text-foreground truncate">{product.title}</span>
            <span className="font-semibold text-foreground">${Number(product.price).toFixed(2)}</span>
            {product.stock_quantity <= 0 && product.product_type !== "digital_download" && (
              <Badge variant="outline" className="text-destructive border-destructive/30 text-[10px] px-1">Sold Out</Badge>
            )}
          </div>
        ))}
        {products.length > 3 && (
          <p className="text-[10px] text-muted-foreground">+{products.length - 3} more items</p>
        )}
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
        <ShoppingCart className="w-5 h-5" /> Merchandise
      </h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {products.map((product: any) => (
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
                <div className="inline-flex items-center gap-1 text-xs text-primary mb-2">
                  {product.media_release.media_type === "music" ? <Music className="w-3 h-3" /> : <Film className="w-3 h-3" />}
                  {product.media_release.title}
                </div>
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
    </div>
  );
};

export default ArtistMerchSection;
