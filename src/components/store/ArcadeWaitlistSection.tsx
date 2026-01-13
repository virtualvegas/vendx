import { useState, useEffect } from "react";
import arcadeHomeMachine from "@/assets/arcade-home-machine.png";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  Home
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

const ArcadeWaitlistSection = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("");
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
      if (data.length > 0 && !selectedPlan) {
        // Default to middle option if exists, otherwise first
        const middleIndex = Math.floor(data.length / 2);
        setSelectedPlan(data[middleIndex]?.id || data[0]?.id);
      }
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
    // Middle plan is popular, or second if only 2
    if (total <= 1) return false;
    if (total === 2) return index === 1;
    return index === Math.floor(total / 2);
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
    setSelectedPlan("pro");
    setSuccess(false);
  };

  // Don't render if no arcade products
  if (!loadingData && arcadeProducts.length === 0) {
    return null;
  }

  return (
    <section className="py-8 px-4">
      <div className="container mx-auto">
        <div className="relative rounded-xl overflow-hidden border border-purple-500/30 bg-gradient-to-br from-purple-900/30 via-card to-indigo-900/30">
          {/* Animated background effect */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-500/10 via-transparent to-transparent" />
          
          <div className="relative p-8 md:p-12">
            <div className="flex flex-col lg:flex-row gap-8 items-center">
              {/* Left side - Info */}
              <div className="flex-1 text-center lg:text-left">
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
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  <span className="text-purple-400">VendX Global</span>{" "}
                  <span className="text-foreground">Arcade</span>{" "}
                  <span className="text-indigo-400">Subscription</span>
                </h2>
                <p className="text-muted-foreground text-lg mb-4 max-w-xl">
                  Get a real arcade machine in your home without buying one. Pay monthly, and we handle 
                  delivery, setup, and all maintenance. If something breaks, we fix it.
                </p>
                <p className="text-foreground font-medium mb-6 max-w-xl">
                  No ownership. No repairs. No hassle — just play.
                </p>

                {/* Feature highlights */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Truck className="h-4 w-4 text-purple-400 flex-shrink-0" />
                    <span>Free Delivery</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Home className="h-4 w-4 text-purple-400 flex-shrink-0" />
                    <span>Pro Setup</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Wrench className="h-4 w-4 text-purple-400 flex-shrink-0" />
                    <span>Free Repairs</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <RefreshCw className="h-4 w-4 text-purple-400 flex-shrink-0" />
                    <span>Machine Swaps</span>
                  </div>
                </div>

                {/* Plan Preview Cards - Dynamic from Database */}
                {loadingData ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="p-4 rounded-lg border border-border/50 bg-card/50 animate-pulse">
                        <div className="h-8 w-8 bg-muted rounded mx-auto mb-2" />
                        <div className="h-4 bg-muted rounded w-3/4 mx-auto mb-2" />
                        <div className="h-6 bg-muted rounded w-1/2 mx-auto" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={`grid grid-cols-1 ${arcadeProducts.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-4 mb-8`}>
                    {arcadeProducts.map((product, index) => {
                      const tier = getPlanTier(product.slug);
                      const Icon = planIcons[tier] || Gamepad2;
                      const isPopular = isPopularPlan(index, arcadeProducts.length);
                      const price = product.subscription_price || product.price;
                      
                      return (
                        <div
                          key={product.id}
                          className={`relative p-4 rounded-lg border transition-all ${
                            isPopular 
                              ? "border-purple-500 bg-purple-500/10" 
                              : "border-border/50 bg-card/50"
                          }`}
                        >
                          {isPopular && (
                            <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-purple-500 text-white text-xs">
                              Most Popular
                            </Badge>
                          )}
                          <Icon className={`h-8 w-8 mx-auto mb-2 ${isPopular ? "text-purple-400" : "text-muted-foreground"}`} />
                          <h3 className="font-semibold text-sm text-center">{product.name}</h3>
                          <p className="text-center mt-1">
                            <span className="text-xl font-bold text-foreground">${price.toFixed(2)}</span>
                            <span className="text-muted-foreground text-sm">/mo</span>
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* CTA */}
                <Dialog open={isOpen} onOpenChange={(open) => {
                  setIsOpen(open);
                  if (!open) resetForm();
                }}>
                  <DialogTrigger asChild>
                    <Button size="lg" className="bg-purple-600 hover:bg-purple-700 text-white gap-2">
                      <Rocket className="h-5 w-5" />
                      Join Free Waitlist
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Gamepad2 className="h-5 w-5 text-purple-500" />
                        Join the Arcade Waitlist
                      </DialogTitle>
                      <DialogDescription>
                        Be the first to get a real arcade machine in your home. Join the waitlist for early access, 
                        exclusive launch pricing, and priority scheduling in Massachusetts.
                      </DialogDescription>
                    </DialogHeader>

                    <Badge variant="outline" className="w-fit border-amber-500/50 text-amber-400">
                      <MapPin className="h-3 w-3 mr-1" />
                      Currently launching in Massachusetts only
                    </Badge>

                    {success ? (
                      <div className="py-8 text-center">
                        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                          <Check className="h-8 w-8 text-green-500" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">You are on the list!</h3>
                        <p className="text-muted-foreground">
                          We will send you an email when VendX Arcade launches in Massachusetts.
                        </p>
                        <Button 
                          variant="outline" 
                          className="mt-6"
                          onClick={() => setIsOpen(false)}
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

                        <div className="space-y-3">
                          <Label>Interested in which plan?</Label>
                          <RadioGroup value={selectedPlan} onValueChange={setSelectedPlan}>
                            {arcadeProducts.map((product) => {
                              const price = product.subscription_price || product.price;
                              return (
                                <div key={product.id} className="flex items-center space-x-3">
                                  <RadioGroupItem value={product.id} id={product.id} />
                                  <Label htmlFor={product.id} className="flex items-center gap-2 cursor-pointer">
                                    <span className="font-medium">{product.name}</span>
                                    <span className="text-muted-foreground text-sm">${price.toFixed(2)}/mo</span>
                                  </Label>
                                </div>
                              );
                            })}
                          </RadioGroup>
                        </div>

                        <Button 
                          type="submit" 
                          className="w-full bg-purple-600 hover:bg-purple-700"
                          disabled={loading}
                        >
                          {loading ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Joining...
                            </>
                          ) : (
                            <>
                              <Users className="h-4 w-4 mr-2" />
                              Join Waitlist - It's Free
                            </>
                          )}
                        </Button>

                        <p className="text-xs text-muted-foreground text-center">
                          We will only email you about the Arcade launch. No spam, ever.
                        </p>
                      </form>
                    )}
                  </DialogContent>
                </Dialog>

                <div className="mt-4 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {waitlistCount > 0 
                      ? `${waitlistCount.toLocaleString()} on the waitlist`
                      : 'Be the first to join!'
                    }
                  </span>
                  <span className="hidden sm:inline text-border">•</span>
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-amber-400" />
                    Massachusetts Launch
                  </span>
                </div>
              </div>

              {/* Right side - Visual */}
              <div className="w-full lg:w-80 flex-shrink-0">
                <div className="relative aspect-square rounded-2xl overflow-hidden border border-purple-500/30">
                  <img 
                    src={arcadeHomeMachine} 
                    alt="Arcade Machine in Home"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-purple-900/80 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 space-y-2">
                    <div className="flex items-center gap-2 text-white">
                      <Home className="h-5 w-5 text-purple-400" />
                      <span className="font-semibold">Real Arcade. Your Home.</span>
                    </div>
                    <p className="text-xs text-white/70">Swap machines based on your plan</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ArcadeWaitlistSection;