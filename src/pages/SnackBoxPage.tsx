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
  Package, Star, Check, ArrowRight, Truck, RefreshCw, Gift, 
  Globe, Heart, Zap, Loader2, ShoppingCart 
} from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { toast } from "sonner";

interface Addon {
  id: string;
  name: string;
  description: string;
  price: number;
}

const features = [
  { icon: Package, title: "20+ Premium Snacks", description: "Curated selection of chips, candy, cookies, and unique treats" },
  { icon: Globe, title: "Worldwide Flavors", description: "Discover snacks from around the globe with our add-ons" },
  { icon: Truck, title: "Free Shipping", description: "Your box ships free every month, straight to your door" },
  { icon: RefreshCw, title: "Cancel Anytime", description: "No commitment. Pause or cancel your subscription easily" },
];

const perks = [
  "Exclusive snacks you won't find in stores",
  "New discoveries every month",
  "Perfect for office, home, or gifts",
  "Earn VendX reward points",
  "Member-only discounts",
  "Early access to new products",
];

const SnackBoxPage = () => {
  const navigate = useNavigate();
  const [product, setProduct] = useState<any>(null);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const { addToCart, cartCount } = useCart();

  useEffect(() => {
    fetchProduct();
  }, []);

  const fetchProduct = async () => {
    const { data: productData } = await supabase
      .from("store_products")
      .select("*")
      .eq("slug", "snack-in-the-box")
      .single();

    if (productData) {
      setProduct(productData);
      
      const { data: addonData } = await supabase
        .from("store_product_addons")
        .select("*")
        .eq("product_id", productData.id)
        .eq("is_active", true);
      
      if (addonData) {
        setAddons(addonData);
      }
    }
    setLoading(false);
  };

  const handleAddonToggle = (addonId: string) => {
    setSelectedAddons(prev => 
      prev.includes(addonId) 
        ? prev.filter(id => id !== addonId)
        : [...prev, addonId]
    );
  };

  const calculateTotal = () => {
    if (!product) return 29.99;
    const basePrice = product.subscription_price || 29.99;
    const addonsTotal = addons
      .filter(a => selectedAddons.includes(a.id))
      .reduce((sum, a) => sum + a.price, 0);
    return basePrice + addonsTotal;
  };

  const handleSubscribe = async () => {
    if (!product) return;
    setSubscribing(true);
    
    try {
      await addToCart(product.id, 1, selectedAddons);
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
        <div className="container mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="mb-4 bg-accent text-accent-foreground">MONTHLY SUBSCRIPTION</Badge>
              <h1 className="text-4xl md:text-6xl font-bold mb-6">
                <span className="text-accent glow-green">Snack</span>{" "}
                <span className="text-foreground">In The Box</span>
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                Premium snack box delivered monthly. Discover new favorites from around the world 
                with our curated selection of chips, candy, cookies, and unique treats.
              </p>
              
              <div className="flex flex-wrap items-center gap-4 mb-8">
                <div className="text-4xl font-bold text-primary">
                  ${calculateTotal().toFixed(2)}
                  <span className="text-lg font-normal text-muted-foreground">/month</span>
                </div>
                <Badge variant="outline" className="text-accent border-accent">
                  <Star className="h-3 w-3 mr-1 fill-current" />
                  4.9/5 Rating
                </Badge>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  size="lg" 
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                  onClick={handleSubscribe}
                  disabled={subscribing || loading}
                >
                  {subscribing ? (
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  ) : (
                    <Gift className="h-5 w-5 mr-2" />
                  )}
                  Subscribe Now
                </Button>
                <Link to="/store/snack-variety-pack">
                  <Button size="lg" variant="outline">
                    Try One-Time Box
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>

            <div className="relative">
              <div className="aspect-square rounded-2xl overflow-hidden border-4 border-accent/30 shadow-2xl">
                <img 
                  src="https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=800" 
                  alt="Snack Box"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-4 -right-4 bg-accent text-accent-foreground rounded-full p-4 shadow-lg">
                <Package className="h-8 w-8" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-card/50">
        <div className="container mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
        </div>
      </section>

      {/* Customize Your Box */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Customize Your Box</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Enhance your monthly box with optional add-ons for even more variety
            </p>
          </div>

          <div className="max-w-2xl mx-auto">
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-semibold">Snack In The Box</h3>
                    <p className="text-muted-foreground">Base subscription</p>
                  </div>
                  <span className="text-2xl font-bold text-primary">$29.99/mo</span>
                </div>

                <div className="border-t border-border pt-6 space-y-4">
                  <h4 className="font-medium">Optional Add-Ons:</h4>
                  {loading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    addons.map((addon) => (
                      <div 
                        key={addon.id}
                        className={`flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-all ${
                          selectedAddons.includes(addon.id) 
                            ? "border-accent bg-accent/10" 
                            : "border-border hover:border-accent/50"
                        }`}
                        onClick={() => handleAddonToggle(addon.id)}
                      >
                        <Checkbox 
                          checked={selectedAddons.includes(addon.id)}
                          onCheckedChange={() => handleAddonToggle(addon.id)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex justify-between">
                            <Label className="font-medium cursor-pointer text-base">{addon.name}</Label>
                            <span className="text-accent font-semibold">+${addon.price.toFixed(2)}/mo</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{addon.description}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="border-t border-border mt-6 pt-6">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-lg font-medium">Your Monthly Total:</span>
                    <span className="text-3xl font-bold text-primary">${calculateTotal().toFixed(2)}</span>
                  </div>
                  <Button 
                    className="w-full h-12 bg-accent text-accent-foreground hover:bg-accent/90"
                    onClick={handleSubscribe}
                    disabled={subscribing || loading}
                  >
                    {subscribing ? (
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    ) : (
                      <Zap className="h-5 w-5 mr-2" />
                    )}
                    Subscribe & Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Perks */}
      <section className="py-16 px-4 bg-gradient-to-b from-background to-card/50">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
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
                src="https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=400" 
                alt="Snacks"
                className="rounded-xl w-full aspect-square object-cover"
              />
              <img 
                src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400" 
                alt="Snacks"
                className="rounded-xl w-full aspect-square object-cover mt-8"
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <Card className="bg-gradient-to-r from-accent/20 via-primary/20 to-accent/20 border-accent/30">
            <CardContent className="p-8 md:p-12 text-center">
              <Heart className="h-12 w-12 text-accent mx-auto mb-4" />
              <h2 className="text-3xl font-bold mb-4">Ready to Snack?</h2>
              <p className="text-muted-foreground max-w-xl mx-auto mb-6">
                Join thousands of snack lovers who discover new favorites every month. 
                Start your subscription today and get 10% off your first box!
              </p>
              <Button 
                size="lg" 
                className="bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={handleSubscribe}
                disabled={subscribing || loading}
              >
                {subscribing ? (
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <Gift className="h-5 w-5 mr-2" />
                )}
                Get Your First Box
              </Button>
            </CardContent>
          </Card>
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

export default SnackBoxPage;
