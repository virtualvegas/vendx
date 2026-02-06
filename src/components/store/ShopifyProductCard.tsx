import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Loader2 } from "lucide-react";
import { useShopifyCartStore, ShopifyProduct } from "@/stores/shopifyCartStore";
import { toast } from "sonner";

interface ShopifyProductCardProps {
  product: ShopifyProduct;
  viewMode?: "grid" | "list";
}

export const ShopifyProductCard = ({ product, viewMode = "grid" }: ShopifyProductCardProps) => {
  const addItem = useShopifyCartStore(state => state.addItem);
  const isLoading = useShopifyCartStore(state => state.isLoading);
  
  const { node } = product;
  const firstVariant = node.variants.edges[0]?.node;
  const firstImage = node.images.edges[0]?.node;
  const price = parseFloat(node.priceRange.minVariantPrice.amount);
  const compareAtPrice = parseFloat(node.compareAtPriceRange?.minVariantPrice?.amount || "0");
  const isOnSale = compareAtPrice > price;
  const currencyCode = node.priceRange.minVariantPrice.currencyCode;

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!firstVariant) {
      toast.error("No variant available");
      return;
    }

    await addItem({
      product,
      variantId: firstVariant.id,
      variantTitle: firstVariant.title,
      price: firstVariant.price,
      quantity: 1,
      selectedOptions: firstVariant.selectedOptions || []
    });
    
    toast.success(`${node.title} added to cart!`);
  };

  if (viewMode === "list") {
    return (
      <Card className="bg-card border-border hover:border-primary/50 transition-all group flex flex-row">
        <Link to={`/store/product/${node.handle}`} className="flex flex-1">
          <div className="w-32 h-32 flex-shrink-0 overflow-hidden rounded-l-lg">
            <img
              src={firstImage?.url || "https://via.placeholder.com/400"}
              alt={firstImage?.altText || node.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
          </div>
          <CardContent className="p-4 flex-1 flex flex-col justify-center">
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-1">
              {node.title}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {node.description}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-primary">
                {currencyCode} {price.toFixed(2)}
              </span>
              {isOnSale && (
                <span className="text-sm text-muted-foreground line-through">
                  {currencyCode} {compareAtPrice.toFixed(2)}
                </span>
              )}
            </div>
          </CardContent>
        </Link>
        <div className="p-4 flex items-center">
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={handleAddToCart}
            disabled={isLoading || !firstVariant?.availableForSale}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShoppingCart className="h-4 w-4" />
            )}
            Add
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border hover:border-primary/50 transition-all group h-full flex flex-col">
      <Link to={`/store/product/${node.handle}`} className="flex-1">
        <div className="aspect-square relative overflow-hidden rounded-t-lg">
          <img
            src={firstImage?.url || "https://via.placeholder.com/400"}
            alt={firstImage?.altText || node.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
          {isOnSale && (
            <Badge className="absolute bottom-2 left-2 bg-destructive">Sale</Badge>
          )}
          {!firstVariant?.availableForSale && (
            <Badge className="absolute top-2 right-2 bg-muted text-muted-foreground">Out of Stock</Badge>
          )}
        </div>
        <CardContent className="p-4">
          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-1">
            {node.title}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {node.description}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-primary">
              {currencyCode} {price.toFixed(2)}
            </span>
            {isOnSale && (
              <span className="text-sm text-muted-foreground line-through">
                {currencyCode} {compareAtPrice.toFixed(2)}
              </span>
            )}
          </div>
        </CardContent>
      </Link>
      <div className="px-4 pb-4">
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full gap-2"
          onClick={handleAddToCart}
          disabled={isLoading || !firstVariant?.availableForSale}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShoppingCart className="h-4 w-4" />
          )}
          Quick Add
        </Button>
      </div>
    </Card>
  );
};