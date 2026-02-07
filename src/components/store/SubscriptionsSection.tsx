import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Gift } from "lucide-react";
import { SubscriptionProductCard } from "./SubscriptionProductCard";

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

export const SubscriptionsSection = () => {
  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ["store-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_products")
        .select("id, name, slug, short_description, price, subscription_price, subscription_interval, images, is_featured, category")
        .eq("is_active", true)
        .eq("is_subscription", true)
        .order("subscription_price", { ascending: true });

      if (error) throw error;
      return data as SubscriptionProduct[];
    },
  });

  if (isLoading) {
    return (
      <section className="py-12 px-4">
        <div className="container mx-auto">
          <h2 className="text-2xl font-bold mb-6">Subscriptions</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="bg-card/50 border-border/50">
                <CardContent className="p-6">
                  <Skeleton className="w-12 h-12 rounded-xl mb-4" />
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full mb-4" />
                  <Skeleton className="h-8 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!subscriptions || subscriptions.length === 0) {
    return null;
  }

  return (
    <section className="py-12 px-4 bg-gradient-to-b from-card/50 to-background">
      <div className="container mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
            <Gift className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Subscriptions</h2>
            <p className="text-muted-foreground text-sm">Monthly plans that deliver value straight to you</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {subscriptions.map((product) => (
            <SubscriptionProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
};
