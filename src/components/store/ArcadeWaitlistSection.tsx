import { useState, useEffect } from "react";
import arcadeHeroImage from "@/assets/arcade-hero.png";
import { supabase } from "@/integrations/supabase/client";
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
  Star
} from "lucide-react";

interface ArcadeProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  subscription_price: number | null;
  short_description: string | null;
}

const planIcons: Record<string, any> = {
  starter: Gamepad2,
  pro: Zap,
  elite: Crown,
};

const planFeatures: Record<string, string[]> = {
  starter: ["1 Machine", "Basic Games", "Standard Support", "Annual Swap"],
  pro: ["1 Machine", "Premium Games", "Priority Support", "Quarterly Swaps"],
  elite: ["1-2 Machines", "All Games", "24/7 Support", "Monthly Swaps"],
};

const features = [
  { icon: Truck, title: "Free Delivery & Setup", description: "We deliver and set up your machine professionally" },
  { icon: Wrench, title: "Free Repairs", description: "If something breaks, we fix it at no extra cost" },
  { icon: RefreshCw, title: "Machine Swaps", description: "Swap your machine based on your plan tier" },
  { icon: Home, title: "Your Home Arcade", description: "Real arcade experience without ownership hassle" },
];

const ArcadeWaitlistSection = () => {
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

  useEffect(() => {
    fetchArcadeProducts();
    fetchWaitlistCount();
  }, []);

  const fetchArcadeProducts = async () => {
    const { data, error } = await supabase
      .from("store_products")
      .select("id, name, slug, price, subscription_price, short_description")
      .eq("is_active", true)
      .eq("is_subscription", true)
      .ilike("slug", "%arcade%")
      .order("subscription_price", { ascending: true });

    if (!error && data) {
      setArcadeProducts(data);
    }
    setLoadingData(false);
  };

  const fetchWaitlistCount = async () => {
    const { count, error } = await supabase
      .from("arcade_waitlist")
      .select("*", { count: "exact", head: true });

    if (!error && count !== null) {
      setWaitlistCount(count);
    }
  };

  const getPlanTier = (slug: string): string => {
    if (slug.includes("elite")) return "elite";
    if (slug.includes("pro")) return "pro";
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
      const { error } = await supabase.from("arcade_waitlist").insert({
        email,
        full_name: fullName || null,
        preferred_plan: selectedPlan,
        referral_source: "store_page",
      });

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "Already on waitlist!",
            description: "This email is already registered for the waitlist.",
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
        fetchWaitlistCount();
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

  // Don't render if no arcade products
  if (!loadingData && arcadeProducts.length === 0) {
    return null;
  }

  return (
    <section className="py-8 px-4">
      <div className="container mx-auto">
        {/* Hero Card */}
        <div className="relative rounded-xl overflow-hidden border border-purple-500/30 bg-gradient-to-br from-purple-900/30 via-card to-indigo-900/30 mb-8">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-500/10 via-transparent to-transparent" />
          
          <div className="relative p-8 md:p-12">
            <div className="flex flex-col lg:flex-row gap-8 items-center">
              {/* Left side - Info */}
              <div className="flex-1 text-center lg:text-left">
                <div className="flex flex-wrap gap-2 mb-4 justify-center lg:justify-start">
                  <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                    <Sparkles className="h-3 w-3 mr-1" />
                    COMING SOON
                  </Badge>
                  <Badge variant="outline" className="border-amber-500/50 text-amber-400">
                    <MapPin className="h-3 w-3 mr-1" />
                    Massachusetts Only
                  </Badge>
                </div>
                <h2 className="text-3xl md:text-5xl font-bold mb-4">
                  <span className="text-purple-400">VendX Global</span>{" "}
                  <span className="text-foreground">Arcade</span>{" "}
                  <span className="text-indigo-400">Subscription</span>
                </h2>
                <p className="text-muted-foreground text-lg mb-4 max-w-xl mx-auto lg:mx-0">
                  Get a real arcade machine in your home without buying one. Pay monthly, and we handle 
                  delivery, setup, and all maintenance. If something breaks, we fix it.
                </p>
                <p className="text-foreground font-semibold text-xl mb-6 max-w-xl mx-auto lg:mx-0">
                  No ownership. No repairs. No hassle — just play.
                </p>

                <div className="flex flex-wrap items-center gap-4 justify-center lg:justify-start">
                  <Badge variant="outline" className="text-purple-400 border-purple-400">
                    <Star className="h-3 w-3 mr-1 fill-current" />
                    Premium Service
                  </Badge>
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    {waitlistCount > 0 
                      ? `${waitlistCount.toLocaleString()} on waitlist`
                      : 'Be the first to join!'
                    }
                  </span>
                </div>
              </div>

              {/* Right side - Visual */}
              <div className="w-full lg:w-96 flex-shrink-0">
                <div className="relative aspect-square rounded-2xl overflow-hidden border-4 border-purple-500/30 shadow-2xl">
                  <img 
                    src={arcadeHeroImage} 
                    alt="Arcade Machine in Home"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute -bottom-4 -right-4 bg-purple-600 text-white rounded-full p-4 shadow-lg">
                    <Gamepad2 className="h-8 w-8" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {features.map((feature, index) => (
            <Card key={index} className="bg-card/50 border-purple-500/20 text-center">
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

        {/* Plan Selection - Similar to Snack Box */}
        <div className="text-center mb-8">
          <h3 className="text-3xl font-bold mb-4">Choose Your Plan</h3>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Select the subscription tier that fits your gaming needs. Join the waitlist to get early access and exclusive launch pricing.
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
                      <span className="text-3xl font-bold text-foreground">${price.toFixed(2)}</span>
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
                      className={`w-full ${
                        isPopular 
                          ? "bg-purple-600 hover:bg-purple-700 text-white" 
                          : "bg-muted hover:bg-purple-600 hover:text-white"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlanSelect(product.id);
                      }}
                    >
                      <Rocket className="h-4 w-4 mr-2" />
                      Join Waitlist
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Waitlist count and MA note */}
        <div className="text-center mt-8">
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {waitlistCount > 0 
                ? `${waitlistCount.toLocaleString()} people on the waitlist`
                : 'Be the first to join the waitlist!'
              }
            </span>
            <span className="hidden sm:inline text-border">•</span>
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-amber-400" />
              Launching first in Massachusetts
            </span>
          </div>
        </div>

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
      </div>
    </section>
  );
};

export default ArcadeWaitlistSection;
