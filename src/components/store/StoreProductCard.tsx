import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Store, MapPin, ShoppingCart } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

interface RetailLink {
  store: string;
  url: string;
  link_type?: string;
}

interface StoreProduct {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  price: number;
  compare_at_price: number | null;
  category: string;
  images: string[];
  stock: number | null;
  is_subscription: boolean;
  subscription_price: number | null;
  retail_status: string | null;
  retail_links: Json | null;
  shopify_handle: string | null;
}

interface StoreProductCardProps {
  product: StoreProduct;
  viewMode?: "grid" | "list";
  shopifyImages?: string[];
}

const retailStatusLabel: Record<string, string> = {
  in_store_and_online: "In Store & Online",
  in_store_only: "In Store Only",
  online_only: "Online Only",
};

const retailStatusColor: Record<string, string> = {
  in_store_and_online: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  in_store_only: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  online_only: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

export const StoreProductCard = ({ product, viewMode = "grid", shopifyImages }: StoreProductCardProps) => {
  const displayImage = (shopifyImages?.length ? shopifyImages[0] : null) || product.images?.[0] || "/placeholder.svg";
  const price = product.is_subscription ? (product.subscription_price || product.price) : product.price;
  const isOnSale = product.compare_at_price !== null && product.compare_at_price > product.price;
  const outOfStock = product.stock !== null && product.stock < 1;
  const retailLinks = (product.retail_links && Array.isArray(product.retail_links) ? product.retail_links : []) as unknown as RetailLink[];
  const retailCount = retailLinks.filter(l => l.url && l.store).length;

  if (viewMode === "list") {
    return (
      <Link to={`/store/${product.slug}`}>
        <Card className="bg-card border-border hover:border-primary/50 transition-all group flex flex-row">
          <div className="w-32 h-32 flex-shrink-0 overflow-hidden rounded-l-lg">
            <img
              src={displayImage}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
          </div>
          <CardContent className="p-4 flex-1 flex flex-col justify-center">
            <div className="flex flex-wrap gap-1.5 mb-1">
              {product.is_subscription && (
                <Badge className="bg-accent/20 text-accent-foreground text-[10px]">Subscription</Badge>
              )}
              {product.retail_status && (
                <Badge className={`text-[10px] border ${retailStatusColor[product.retail_status] || retailStatusColor.online_only}`}>
                  {retailStatusLabel[product.retail_status] || "Online Only"}
                </Badge>
              )}
            </div>
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-1">
              {product.name}
            </h3>
            {product.short_description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{product.short_description}</p>
            )}
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-primary">
                ${price.toFixed(2)}
                {product.is_subscription && <span className="text-xs font-normal text-muted-foreground">/mo</span>}
              </span>
              {isOnSale && (
                <span className="text-sm text-muted-foreground line-through">${product.compare_at_price!.toFixed(2)}</span>
              )}
            </div>
            {retailCount > 0 && (
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <Store className="w-3 h-3" />
                Available at {retailCount} retailer{retailCount !== 1 ? "s" : ""}
              </div>
            )}
          </CardContent>
        </Card>
      </Link>
    );
  }

  return (
    <Link to={`/store/${product.slug}`}>
      <Card className="bg-card border-border hover:border-primary/50 transition-all group h-full flex flex-col">
        <div className="aspect-square relative overflow-hidden rounded-t-lg">
          <img
            src={displayImage}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
          {isOnSale && <Badge className="absolute bottom-2 left-2 bg-destructive">Sale</Badge>}
          {outOfStock && <Badge className="absolute top-2 right-2 bg-muted text-muted-foreground">Out of Stock</Badge>}
          {product.shopify_handle && (
            <Badge className="absolute top-2 left-2 bg-primary/80 text-primary-foreground text-[10px]">
              <ShoppingCart className="w-3 h-3 mr-1" />
              Buy Online
            </Badge>
          )}
        </div>
        <CardContent className="p-4 flex-1 flex flex-col">
          <div className="flex flex-wrap gap-1.5 mb-2">
            <Badge variant="outline" className="capitalize text-[10px]">{product.category}</Badge>
            {product.is_subscription && (
              <Badge className="bg-accent/20 text-accent-foreground text-[10px]">Subscription</Badge>
            )}
            {product.retail_status && product.retail_status !== "online_only" && (
              <Badge className={`text-[10px] border ${retailStatusColor[product.retail_status] || ""}`}>
                {retailStatusLabel[product.retail_status]}
              </Badge>
            )}
          </div>
          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-1">
            {product.name}
          </h3>
          {product.short_description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3 flex-1">{product.short_description}</p>
          )}
          <div className="flex items-center justify-between mt-auto">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-primary">
                ${price.toFixed(2)}
                {product.is_subscription && <span className="text-xs font-normal text-muted-foreground">/mo</span>}
              </span>
              {isOnSale && (
                <span className="text-sm text-muted-foreground line-through">${product.compare_at_price!.toFixed(2)}</span>
              )}
            </div>
            {retailCount > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground" title={`Available at ${retailCount} retailer${retailCount !== 1 ? "s" : ""}`}>
                <Store className="w-3.5 h-3.5" />
                <span>{retailCount}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};
