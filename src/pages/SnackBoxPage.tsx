import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Package,
  Star,
  Check,
  ArrowRight,
  Truck,
  RefreshCw,
  Gift,
  Globe,
  Heart,
  Zap,
  Loader2,
  ShoppingCart,
} from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { toast } from "sonner";

interface Addon {
  id: string;
  name: string;
  description: string;
  price: number;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  subscription_price: number;
  description: string;
}

const features = [
  {
    icon: Package,
    title: "Commercial Grade Machines",
    description: "High-quality arcade machines for your home or space",
  },
  { icon: Truck, title: "Delivery & Setup", description: "VendX delivers and installs your machine at no extra cost" },
  { icon: RefreshCw, title: "Swap Machines", description: "Upgrade or swap machines after 4–6 months based on tier" },
  {
    icon: Globe,
    title: "Worldwide Access",
    description: "Choose from various machines, including premium models on higher tiers",
  },
];

const perks = [
  "No ownership, no maintenance hassle",
  "Exclusive access to premium arcade machines",
  "Flexible subscription tiers",
  "Earn VendX reward points",
  "Member-only promotions",
  "Early access to new machines",
];

const ArcadeSubscriptionPage = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [addons, setAddons] = useState<Record<string, Addon[]>>({});
  const [selectedAddons, setSelectedAddons] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const { addToCart, cartCount } = useCart();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    // Fetch the three tier products by slug
    const slugs = ["starter-arcade", "pro-arcade", "elite-arcade"];
    const { data: productData } = await supabase.from("store_products").select("*").in("slug", slugs);

    if (productData) {
      setProducts(productData);

      // Fetch addons for each product
      const addonsObj: Record<string, Addon[]> = {};
      for (let product of productData) {
        const { data: addonData } = await supabase
          .from("store_product_addons")
          .select("*")
          .eq("product_id", product.id)
          .eq("is_active", true);
        addonsObj[product.id] = addonData || [];
      }
      setAddons(addonsObj);
    }
    setLoading(false);
  };

  const handleAddonToggle = (productId: string, addonId: string) => {
    setSelectedAddons((prev) => ({
      ...prev,
      [productId]: prev[productId]?.includes(addonId)
        ? prev[productId].filter((id) => id !== addonId)
        : [...(prev[productId] || []), addonId],
    }));
  };

  const calculateTotal = (product: Product) => {
    const basePrice = product.subscription_price || 129;
    const productAddons = addons[product.id] || [];
    const selected = selectedAddons[product.id] || [];
    const addonsTotal = productAddons.filter((a) => selected.includes(a.id)).reduce((sum, a) => sum + a.price, 0);
    return basePrice + addonsTotal;
  };

  const handleSubscribe = async (product: Product) => {
    setSubscribing(true);
    try {
      await addToCart(product.id, 1, selectedAddons[product.id] || []);
      toast.success("Added to cart!");
      navigate("/store/cart");
    } catch (error) {
      toast.error("Failed to add to cart");
    }
    setSubscribing(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero Section */}
      <section className="relative pt-24 pb-16 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-accent/10 via-background to-background" />
        <div className="container mx-auto relative z-10 text-center">
          <Badge className="mb-4 bg-accent text-accent-foreground">WAITLIST OPEN</Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            <span className="text-accent glow-green">VendX</span>{" "}
            <span className="text-foreground">Arcade Subscription</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Real arcade machines for your home or space without the cost or hassle of ownership. Join our waitlist and
            get exclusive access before spots fill up!
          </p>
        </div>
      </section>

      {/* Subscription Tiers */}
      <section className="py-16 px-4">
        <div className="container mx-auto grid md:grid-cols-3 gap-8">
          {loading ? (
            <div className="col-span-3 text-center">
              <Loader2 className="h-12 w-12 animate-spin mx-auto" />
            </div>
          ) : (
            products.map((product) => (
              <Card key={product.id} className="bg-card border-border">
                <CardContent className="p-6 flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold">{product.name}</h2>
                    <Badge variant="outline" className="text-accent border-accent">
                      <Star className="h-3 w-3 mr-1 fill-current" />
                      5/5
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mb-6">{product.description}</p>

                  {/* Add-ons */}
                  {addons[product.id] && addons[product.id].length > 0 && (
                    <div className="mb-4">
                      <h3 className="font-medium mb-2">Optional Add-Ons:</h3>
                      {addons[product.id].map((addon) => (
                        <div
                          key={addon.id}
                          className={`flex items-start gap-4 p-2 rounded-lg border cursor-pointer transition-all ${
                            selectedAddons[product.id]?.includes(addon.id)
                              ? "border-accent bg-accent/10"
                              : "border-border hover:border-accent/50"
                          }`}
                          onClick={() => handleAddonToggle(product.id, addon.id)}
                        >
                          <Checkbox
                            checked={selectedAddons[product.id]?.includes(addon.id) || false}
                            onCheckedChange={() => handleAddonToggle(product.id, addon.id)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex justify-between">
                              <Label className="font-medium cursor-pointer">{addon.name}</Label>
                              <span className="text-accent font-semibold">+${addon.price.toFixed(2)}/mo</span>
                            </div>
                            <p className="text-sm text-muted-foreground">{addon.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Total + Subscribe */}
                  <div className="mt-auto">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-lg font-medium">Monthly Total:</span>
                      <span className="text-2xl font-bold text-primary">${calculateTotal(product).toFixed(2)}</span>
                    </div>
                    <Button
                      className="w-full h-12 bg-accent text-accent-foreground hover:bg-accent/90"
                      onClick={() => handleSubscribe(product)}
                      disabled={subscribing || loading}
                    >
                      {subscribing ? (
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      ) : (
                        <Gift className="h-5 w-5 mr-2" />
                      )}
                      Join Waitlist
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-card/50">
        <div className="container mx-auto grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <Card key={index} className="bg-card border-border text-center">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Perks */}
      <section className="py-16 px-4 bg-gradient-to-b from-background to-card/50">
        <div className="container mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold mb-6">Member Perks</h2>
            <div className="space-y-4">
              {perks.map((perk, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                    <Check className="h-4 w-4 text-accent" />
                  </div>
                  <span className="text-foreground">{perk}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <img
              src="https://images.unsplash.com/photo-1602524200067-0d65caa1f191?w=400"
              alt="Arcade"
              className="rounded-xl w-full aspect-square object-cover"
            />
            <img
              src="https://images.unsplash.com/photo-1574226516831-e1dff420e8e6?w=400"
              alt="Arcade"
              className="rounded-xl w-full aspect-square object-cover mt-8"
            />
          </div>
        </div>
      </section>

      {/* Cart FAB */}
      <Link to="/store/cart" className="fixed bottom-6 right-6 z-50">
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

export default SnackBoxPage;
