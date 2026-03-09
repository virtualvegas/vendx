import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingBag, ArrowRight, Star } from "lucide-react";
import { useShopifyProducts } from "@/hooks/useShopifyProducts";
import { useMemo } from "react";

interface Product {
  id: string;
  name: string;
  slug: string;
  short_description: string;
  price: number;
  compare_at_price: number | null;
  images: string[];
  is_featured: boolean;
  is_subscription: boolean;
  subscription_price: number | null;
  shopify_handle: string | null;
}

const FeaturedProducts = () => {
  const { data: products, isLoading } = useQuery({
    queryKey: ["featured-products-home"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_products")
        .select("id, name, slug, short_description, price, compare_at_price, images, is_featured, is_subscription, subscription_price")
        .eq("is_active", true)
        .eq("is_featured", true)
        .order("created_at", { ascending: false })
        .limit(4);

      if (error) throw error;
      return data as Product[];
    },
  });

  return (
    <section className="py-20 relative">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
          <div>
            <h2 className="text-4xl lg:text-5xl font-bold mb-3">
              Featured <span className="text-primary glow-blue">Products</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl">
              Shop exclusive VendX merchandise and subscription boxes
            </p>
          </div>
          <Link to="/store">
            <Button variant="outline" className="gap-2 group">
              View All Products
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="bg-card/50 border-border/50">
                <Skeleton className="aspect-square rounded-t-lg" />
                <CardContent className="p-4">
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full mb-3" />
                  <Skeleton className="h-6 w-1/3" />
                </CardContent>
              </Card>
            ))
          ) : products && products.length > 0 ? (
            products.map((product) => (
              <Link key={product.id} to={`/store/${product.slug}`}>
                <Card className="group bg-card/50 border-border/50 hover:border-primary/50 transition-all duration-300 overflow-hidden h-full">
                  <div className="aspect-square relative overflow-hidden">
                    <img
                      src={product.images[0] || "https://via.placeholder.com/400"}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {product.is_featured && (
                      <Badge className="absolute top-2 left-2 bg-primary gap-1">
                        <Star className="w-3 h-3" /> Featured
                      </Badge>
                    )}
                    {product.is_subscription && (
                      <Badge className="absolute top-2 right-2 bg-accent text-accent-foreground">
                        Subscription
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1 mb-1">
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
                </Card>
              </Link>
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <ShoppingBag className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No featured products available</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default FeaturedProducts;
