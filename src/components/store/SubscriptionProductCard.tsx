import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gift, Star, Gamepad2, Package } from "lucide-react";

interface SubscriptionProduct {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  price: number;
  subscription_price: number | null;
  subscription_interval: string | null;
  images: string[] | null;
  is_featured: boolean | null;
  category: string;
}

interface SubscriptionProductCardProps {
  product: SubscriptionProduct;
}

const getProductIcon = (name: string) => {
  if (name.toLowerCase().includes("arcade")) return Gamepad2;
  if (name.toLowerCase().includes("snack")) return Package;
  return Gift;
};

export const SubscriptionProductCard = ({ product }: SubscriptionProductCardProps) => {
  const Icon = getProductIcon(product.name);
  const isArcade = product.name.toLowerCase().includes("arcade");
  
  // Determine tier color for arcade subscriptions
  const getTierStyle = () => {
    if (product.name.includes("Elite")) return "from-amber-500/20 to-orange-500/20 border-amber-500/50";
    if (product.name.includes("Pro")) return "from-purple-500/20 to-indigo-500/20 border-purple-500/50";
    if (product.name.includes("Starter")) return "from-primary/20 to-primary/30 border-primary/50";
    return "from-accent/20 to-accent/30 border-accent/50";
  };

  const linkPath = isArcade ? "/store/arcade-subscription" : `/store/${product.slug}`;

  return (
    <Link to={linkPath}>
      <Card className={`group bg-gradient-to-br ${getTierStyle()} border hover:shadow-lg transition-all h-full`}>
        <CardContent className="p-6 flex flex-col h-full">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-background/50 flex items-center justify-center">
              <Icon className="w-6 h-6 text-primary" />
            </div>
            {product.is_featured && (
              <Badge className="bg-accent text-accent-foreground gap-1">
                <Star className="w-3 h-3" /> Featured
              </Badge>
            )}
          </div>

          {/* Image (if available) */}
          {product.images && product.images[0] && (
            <div className="aspect-video rounded-lg overflow-hidden mb-4 bg-background/30">
              <img
                src={product.images[0]}
                alt={product.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
            </div>
          )}

          {/* Content */}
          <div className="flex-1">
            <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors mb-2">
              {product.name}
            </h3>
            {product.short_description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                {product.short_description}
              </p>
            )}
          </div>

          {/* Pricing */}
          <div className="mt-auto pt-4 border-t border-border/50">
            <div className="flex items-end justify-between">
              <div>
                <span className="text-2xl font-bold text-primary">
                  ${(product.subscription_price || product.price).toFixed(0)}
                </span>
                <span className="text-muted-foreground">
                  /{product.subscription_interval || "month"}
                </span>
              </div>
              <Button size="sm" variant="secondary" className="group-hover:bg-primary group-hover:text-primary-foreground">
                {isArcade ? "View Plans" : "Subscribe"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};
