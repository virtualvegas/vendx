import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import arcadeHeroImage from "@/assets/arcade-hero.png";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Gamepad2, 
  Sparkles, 
  Zap, 
  Crown, 
  Check, 
  Loader2,
  Users,
  Rocket,
  Truck,
  Wrench,
  RefreshCw,
  MapPin,
  Home,
  Star,
  ShoppingCart,
  ArrowLeft,
  Shield,
  Calendar,
  Headphones
} from "lucide-react";
import { useCart } from "@/hooks/useCart";

interface ArcadeProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  subscription_price: number | null;
  short_description: string | null;
  waitlist_enabled: boolean | null;
}

const planIcons: Record<string, any> = {
  starter: Gamepad2,
  bronze: Gamepad2,
  pro: Zap,
  silver: Zap,
  elite: Crown,
  gold: Crown,
};

const planFeatures: Record<string, string[]> = {
  starter: ["1 Arcade Machine", "Classic Game Library", "Standard Support", "Annual Machine Swap"],
  bronze: ["1 Arcade Machine", "Classic Game Library", "Standard Support", "Annual Machine Swap"],
  pro: ["1 Arcade Machine", "Premium Game Library", "Priority Support", "Quarterly Machine Swaps"],
  silver: ["1 Arcade Machine", "Premium Game Library", "Priority Support", "Quarterly Machine Swaps"],
  elite: ["Up to 2 Machines", "Full Game Library", "24/7 VIP Support", "Monthly Machine Swaps"],
  gold: ["Up to 2 Machines", "Full Game Library", "24/7 VIP Support", "Monthly Machine Swaps"],
};

const features = [
  { icon: Truck, title: "Free Delivery & Setup", description: "We deliver and professionally set up your arcade machine in your home" },
  { icon: Wrench, title: "Free Repairs", description: "If anything breaks, we fix or replace it at no extra cost to you" },
  { icon: RefreshCw, title: "Machine Swaps", description: "Swap your machine for a different one based on your subscription tier" },
  { icon: Home, title: "Real Arcade Experience", description: "Authentic arcade machines, not emulators or mini-cabinets" },
];

const perks = [
  "No ownership costs or depreciation",
  "All maintenance included",
  "Swap machines to try new games",
  "Earn VendX reward points",
  "Member-only events",
  "Early access to new machines",
];

const ArcadeSubscriptionPage = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [arcadeProducts, setArcadeProducts] = useState<ArcadeProduct[]>([]);
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [loadingData, setLoadingData] = useState(true);
  const { toast } = useToast();
  const { cartCount } = useCart();

  useEffect(() => {
    fetchArcadeProducts();
  }, []);

  const fetchArcadeProducts = async () => {
    // Fetch arcade subscription products that have waitlist enabled
    const { data, error } = await supabase
      .from("store_products")
      .select("id, name, slug, price, subscription_price, short_description, waitlist_enabled")
      .eq("is_active", true)
      .eq("is_subscription", true)
      .eq("category", "subscriptions")
      .ilike("slug", "%arcade%")
      .order("subscription_price", { ascending: true });

    if (!error && data) {
      setArcadeProducts(data);
      
      // Fetch waitlist count for these products
      if (data.length > 0) {
        const productIds = data.map(p => p.id);
        const { count } = await supabase
          .from("product_waitlist")
          .select("*", { count: "exact", head: true })
          .in("product_id", productIds);
        
        if (count !== null) {
          setWaitlistCount(count);
        }
      }
    }
    setLoadingData(false);
  };

  const getPlanTier = (slug: string): string => {
    if (slug.includes("elite") || slug.includes("gold")) return "elite";
    if (slug.includes("pro") || slug.includes("silver")) return "pro";
    if (slug.includes("bronze")) return "bronze";
    return "starter";
  };

  const isPopularPlan = (index: number, total: number): boolean => {
    if (total <= 1) return false;
    if (total === 2) return index === 1;
    return index === Math.floor(total / 2);
  };

  const handlePlanSelect = (productId: string) => {
    setSelectedPlan(productId);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Insert into the generic product_waitlist table
      const { error } = await supabase.from("product_waitlist").insert({
        email,
        full_name: fullName || null,
        product_id: selectedPlan,
        referral_source: "arcade_page",
      });

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "Already on waitlist!",
            description: "This email is already registered for this product.",
          });
        } else {
          throw error;
        }
      } else {
        setSuccess(true);
        toast({
          title: "You're on the list! 🎮",
          description: "We'll notify you as soon as Arcade subscriptions launch.",
        });
        // Refresh waitlist count
        if (arcadeProducts.length > 0) {
          const productIds = arcadeProducts.map(p => p.id);
          const { count } = await supabase
            .from("product_waitlist")
            .select("*", { count: "exact", head: true })
            .in("product_id", productIds);
          
          if (count !== null) {
            setWaitlistCount(count);
          }
        }
      }
    } catch (error: any) {
      console.error("Error joining waitlist:", error);
      toast({
        title: "Error",
        description: "Failed to join waitlist. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail("");
    setFullName("");
    setSuccess(false);
  };

  const selectedProduct = arcadeProducts.find(p => p.id === selectedPlan);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      {/* Hero Section */}
      <section className="relative pt-24 pb-16 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-background to-background" />
        <div className="container mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                  <Sparkles className="h-3 w-3 mr-1" />
                  COMING SOON
                </Badge>
                <Badge variant="outline" className="border-amber-500/50 text-amber-400">
                  <MapPin className="h-3 w-3 mr-1" />
                  Massachusetts Only
                </Badge>
              </div>
              <h1 className="text-4xl md:text-6xl font-bold mb-6">
                <span className="text-purple-400">VendX Global</span>{" "}
                <span className="text-foreground">Arcade</span>{" "}
                <span className="text-indigo-400">Subscription</span>
              </h1>
              <p className="text-xl text-muted-foreground mb-4">
                Get a real arcade machine in your home without buying one. Pay monthly, 
                and we handle delivery, setup, and all maintenance.
              </p>
              <p className="text-2xl font-semibold text-foreground mb-8">
                No ownership. No repairs. No hassle — just play.
              </p>
              
              <div className="flex flex-wrap items-center gap-4 mb-8">
                <Badge variant="outline" className="text-purple-400 border-purple-400">
                  <Star className="h-3 w-3 mr-1 fill-current" />
                  Premium Service
                </Badge>
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  {waitlistCount > 0 
                    ? `${waitlistCount.toLocaleString()} on waitlist`
                    : 'Be the first to join!'
                  }
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  size="lg" 
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={() => {
                    document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  <Rocket className="h-5 w-5 mr-2" />
                  Join Waitlist
                </Button>
                <Link to="/store">
                  <Button size="lg" variant="outline">
                    <ArrowLeft className="h-5 w-5 mr-2" />
                    Back to Store
                  </Button>
                </Link>
              </div>
            </div>

            <div className="relative">
              <div className="aspect-square rounded-2xl overflow-hidden border-4 border-purple-500/30 shadow-2xl">
                <img 
                  src={arcadeHeroImage} 
                  alt="Arcade Machine in Home"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-4 -right-4 bg-purple-600 text-white rounded-full p-4 shadow-lg">
                <Gamepad2 className="h-8 w-8" />
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
              <Card key={index} className="bg-card border-purple-500/20 text-center">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
                    <feature.icon className="h-6 w-6 text-purple-400" />
                  </div>
                  <h3 className="font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Plan Selection */}
      <section id="plans" className="py-16 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Choose Your Plan</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Select the subscription tier that fits your gaming needs. Join the waitlist 
              to get early access and exclusive launch pricing.
            </p>
          </div>

          <div className={`grid gap-6 max-w-5xl mx-auto ${
            arcadeProducts.length === 2 ? 'md:grid-cols-2' : 
            arcadeProducts.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-1'
          }`}>
            {loadingData ? (
              [1, 2, 3].map((i) => (
                <Card key={i} className="bg-card border-border animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-12 w-12 bg-muted rounded-full mx-auto mb-4" />
                    <div className="h-6 bg-muted rounded w-3/4 mx-auto mb-2" />
                    <div className="h-8 bg-muted rounded w-1/2 mx-auto mb-4" />
                    <div className="space-y-2">
                      {[1, 2, 3, 4].map(j => (
                        <div key={j} className="h-4 bg-muted rounded" />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : arcadeProducts.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Gamepad2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Plans Available Yet</h3>
                <p className="text-muted-foreground">Check back soon for arcade subscription plans!</p>
              </div>
            ) : (
              arcadeProducts.map((product, index) => {
                const tier = getPlanTier(product.slug);
                const Icon = planIcons[tier] || Gamepad2;
                const isPopular = isPopularPlan(index, arcadeProducts.length);
                const price = product.subscription_price || product.price;
                const tierFeatures = planFeatures[tier] || planFeatures.starter;
                
                return (
                  <Card
                    key={product.id}
                    className={`relative bg-card transition-all cursor-pointer hover:scale-[1.02] ${
                      isPopular 
                        ? "border-2 border-purple-500 shadow-lg shadow-purple-500/20" 
                        : "border-border hover:border-purple-500/50"
                    } ${selectedPlan === product.id ? "ring-2 ring-purple-500" : ""}`}
                    onClick={() => handlePlanSelect(product.id)}
                  >
                    {isPopular && (
                      <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-500 text-white">
                        Most Popular
                      </Badge>
                    )}
                    <CardContent className="p-6 text-center">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                        isPopular ? "bg-purple-500/20" : "bg-muted"
                      }`}>
                        <Icon className={`h-8 w-8 ${isPopular ? "text-purple-400" : "text-muted-foreground"}`} />
                      </div>
                      
                      <h3 className="text-xl font-bold mb-2">{product.name}</h3>
                      
                      <div className="mb-4">
                        <span className="text-4xl font-bold text-foreground">${price.toFixed(2)}</span>
                        <span className="text-muted-foreground">/month</span>
                      </div>

                      <div className="space-y-3 mb-6 text-left">
                        {tierFeatures.map((feature, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                              <Check className="h-3 w-3 text-purple-400" />
                            </div>
                            <span className="text-sm text-muted-foreground">{feature}</span>
                          </div>
                        ))}
                      </div>

                      <Button 
                        className={`w-full h-12 ${
                          isPopular 
                            ? "bg-purple-600 hover:bg-purple-700 text-white" 
                            : "bg-muted hover:bg-purple-600 hover:text-white"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlanSelect(product.id);
                        }}
                      >
                        <Rocket className="h-5 w-5 mr-2" />
                        Join Waitlist
                      </Button>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* Perks */}
      <section className="py-16 px-4 bg-gradient-to-b from-background to-card/50">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">Member Benefits</h2>
              <div className="space-y-4">
                {perks.map((perk, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                      <Check className="h-4 w-4 text-purple-400" />
                    </div>
                    <span className="text-foreground">{perk}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-card/50 border-purple-500/20">
                <CardContent className="p-6 text-center">
                  <Shield className="h-10 w-10 text-purple-400 mx-auto mb-3" />
                  <h4 className="font-semibold mb-1">Full Coverage</h4>
                  <p className="text-sm text-muted-foreground">All repairs & maintenance included</p>
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-purple-500/20">
                <CardContent className="p-6 text-center">
                  <Calendar className="h-10 w-10 text-purple-400 mx-auto mb-3" />
                  <h4 className="font-semibold mb-1">Flexible</h4>
                  <p className="text-sm text-muted-foreground">Cancel or pause anytime</p>
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-purple-500/20">
                <CardContent className="p-6 text-center">
                  <RefreshCw className="h-10 w-10 text-purple-400 mx-auto mb-3" />
                  <h4 className="font-semibold mb-1">Swap Games</h4>
                  <p className="text-sm text-muted-foreground">Trade machines based on plan</p>
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-purple-500/20">
                <CardContent className="p-6 text-center">
                  <Headphones className="h-10 w-10 text-purple-400 mx-auto mb-3" />
                  <h4 className="font-semibold mb-1">Support</h4>
                  <p className="text-sm text-muted-foreground">Dedicated customer service</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <Card className="bg-gradient-to-r from-purple-500/20 via-indigo-500/20 to-purple-500/20 border-purple-500/30">
            <CardContent className="p-8 md:p-12 text-center">
              <Gamepad2 className="h-12 w-12 text-purple-400 mx-auto mb-4" />
              <h2 className="text-3xl font-bold mb-4">Ready to Play?</h2>
              <p className="text-muted-foreground max-w-xl mx-auto mb-4">
                Join the waitlist today and be the first to bring a real arcade machine home. 
                Early members get exclusive launch pricing and priority scheduling.
              </p>
              <Badge variant="outline" className="border-amber-500/50 text-amber-400 mb-6">
                <MapPin className="h-3 w-3 mr-1" />
                Launching in Massachusetts only
              </Badge>
              <div className="flex flex-wrap justify-center gap-4">
                <Button 
                  size="lg" 
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={() => {
                    document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  <Rocket className="h-5 w-5 mr-2" />
                  Join Waitlist - It's Free
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                {waitlistCount > 0 
                  ? `${waitlistCount.toLocaleString()} people already on the waitlist`
                  : 'Be the first to join!'
                }
              </p>
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
            <span className="absolute -top-1 -right-1 bg-purple-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
              {cartCount}
            </span>
          )}
        </Button>
      </Link>

      {/* Waitlist Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gamepad2 className="h-5 w-5 text-purple-500" />
              Join the Arcade Waitlist
            </DialogTitle>
            <DialogDescription>
              Be the first to get a real arcade machine in your home. Get early access and exclusive launch pricing.
            </DialogDescription>
          </DialogHeader>

          {selectedProduct && (
            <Card className="bg-purple-500/10 border-purple-500/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{selectedProduct.name}</p>
                    <p className="text-sm text-muted-foreground">Selected Plan</p>
                  </div>
                  <span className="text-xl font-bold text-purple-400">
                    ${(selectedProduct.subscription_price || selectedProduct.price).toFixed(2)}/mo
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          <Badge variant="outline" className="w-fit border-amber-500/50 text-amber-400">
            <MapPin className="h-3 w-3 mr-1" />
            Launching in Massachusetts only
          </Badge>

          {success ? (
            <div className="py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="text-xl font-semibold mb-2">You're on the list!</h3>
              <p className="text-muted-foreground">
                We'll email you when VendX Arcade launches in Massachusetts.
              </p>
              <Button 
                variant="outline" 
                className="mt-6"
                onClick={() => setIsDialogOpen(false)}
              >
                Close
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName">Name (optional)</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Your name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 bg-purple-600 hover:bg-purple-700"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>
                    <Rocket className="h-4 w-4 mr-2" />
                    Join Waitlist - It's Free
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                We'll only email you about the Arcade launch. No spam, ever.
              </p>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default ArcadeSubscriptionPage;
