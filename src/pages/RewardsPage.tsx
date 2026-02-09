import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gift, Star, Wallet, Package, Percent, CheckCircle, Clock, Truck } from "lucide-react";
import RedeemDialog from "@/components/vendx-pay/RedeemDialog";
import { PartnerOffersSection } from "@/components/rewards";

interface RewardsData {
  balance: number;
  lifetime_points: number;
  tier: string;
}

interface RewardItem {
  id: string;
  name: string;
  description: string | null;
  points_cost: number;
  reward_type: string;
  credit_amount: number | null;
  requires_shipping: boolean;
  stock: number | null;
  image_url: string | null;
  tier_required: string;
}

interface Redemption {
  id: string;
  points_spent: number;
  status: string;
  tracking_number: string | null;
  created_at: string;
  reward_catalog: {
    name: string;
    reward_type: string;
  };
}

const TIER_ORDER = ["bronze", "silver", "gold", "platinum"];

const RewardsPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [rewards, setRewards] = useState<RewardsData | null>(null);
  const [catalog, setCatalog] = useState<RewardItem[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReward, setSelectedReward] = useState<RewardItem | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        if (!session) {
          navigate("/auth");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Fetch rewards balance
        const { data: rewardsData } = await supabase
          .from("rewards_points")
          .select("balance, lifetime_points, tier")
          .eq("user_id", user.id)
          .maybeSingle();

        setRewards(rewardsData);

        // Fetch reward catalog
        const { data: catalogData } = await supabase
          .from("reward_catalog")
          .select("*")
          .eq("is_active", true)
          .order("points_cost", { ascending: true });

        setCatalog(catalogData || []);

        // Fetch user redemptions
        const { data: redemptionData } = await supabase
          .from("redemptions")
          .select(`
            id,
            points_spent,
            status,
            tracking_number,
            created_at,
            reward_catalog (name, reward_type)
          `)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20);

        setRedemptions(redemptionData as Redemption[] || []);
      } catch (error) {
        console.error("Error fetching rewards data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const canRedeem = (reward: RewardItem): boolean => {
    if (!rewards) return false;
    if (rewards.balance < reward.points_cost) return false;
    
    const userTierIndex = TIER_ORDER.indexOf(rewards.tier);
    const requiredTierIndex = TIER_ORDER.indexOf(reward.tier_required);
    if (userTierIndex < requiredTierIndex) return false;
    
    if (reward.stock !== null && reward.stock <= 0) return false;
    
    return true;
  };

  const getRewardIcon = (type: string) => {
    switch (type) {
      case "vend_credit": return <Wallet className="w-5 h-5" />;
      case "physical_item": return <Package className="w-5 h-5" />;
      case "partner_discount": return <Percent className="w-5 h-5" />;
      default: return <Gift className="w-5 h-5" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle className="w-4 h-4 text-primary" />;
      case "shipped": return <Truck className="w-4 h-4 text-accent" />;
      default: return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const handleRedeemSuccess = () => {
    // Refresh data
    if (user) {
      supabase
        .from("rewards_points")
        .select("balance, lifetime_points, tier")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => setRewards(data));

      supabase
        .from("redemptions")
        .select(`
          id,
          points_spent,
          status,
          tracking_number,
          created_at,
          reward_catalog (name, reward_type)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20)
        .then(({ data }) => setRedemptions(data as Redemption[] || []));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading rewards...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 py-24">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <Gift className="w-8 h-8 text-accent" />
                VendX Rewards
              </h1>
              <p className="text-muted-foreground mt-1">Redeem your points for exclusive rewards</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Available Points</p>
              <p className="text-3xl font-bold text-accent">{(rewards?.balance || 0).toLocaleString()}</p>
            </div>
          </div>

          <Tabs defaultValue="catalog" className="space-y-6">
            <TabsList>
              <TabsTrigger value="catalog">Reward Catalog</TabsTrigger>
              <TabsTrigger value="offers">Partner Offers</TabsTrigger>
              <TabsTrigger value="history">My Redemptions</TabsTrigger>
            </TabsList>

            <TabsContent value="catalog">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {catalog.map((reward) => {
                  const canGet = canRedeem(reward);
                  const needsHigherTier = TIER_ORDER.indexOf(rewards?.tier || "bronze") < TIER_ORDER.indexOf(reward.tier_required);
                  
                  return (
                    <Card key={reward.id} className={`relative ${!canGet ? "opacity-75" : ""}`}>
                      {reward.tier_required !== "bronze" && (
                        <Badge 
                          className="absolute top-3 right-3" 
                          variant={needsHigherTier ? "destructive" : "secondary"}
                        >
                          <Star className="w-3 h-3 mr-1" />
                          {reward.tier_required}
                        </Badge>
                      )}
                      
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <div className="p-3 rounded-full bg-primary/20 text-primary">
                            {getRewardIcon(reward.reward_type)}
                          </div>
                          <CardTitle className="text-lg">{reward.name}</CardTitle>
                        </div>
                      </CardHeader>
                      
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">
                          {reward.description}
                        </p>
                        
                        {reward.credit_amount && (
                          <Badge variant="outline" className="mb-2">
                            ${reward.credit_amount} wallet credit
                          </Badge>
                        )}
                        
                        {reward.requires_shipping && (
                          <Badge variant="outline" className="mb-2">
                            <Package className="w-3 h-3 mr-1" />
                            Shipping Required
                          </Badge>
                        )}
                        
                        {reward.stock !== null && (
                          <p className="text-xs text-muted-foreground">
                            {reward.stock} left in stock
                          </p>
                        )}
                      </CardContent>
                      
                      <CardFooter className="flex justify-between items-center">
                        <div>
                          <p className="text-2xl font-bold text-accent">
                            {reward.points_cost.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">points</p>
                        </div>
                        <Button 
                          disabled={!canGet}
                          onClick={() => setSelectedReward(reward)}
                        >
                          {needsHigherTier 
                            ? `Requires ${reward.tier_required}`
                            : (rewards?.balance || 0) < reward.points_cost
                              ? "Not Enough Points"
                              : "Redeem"}
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="offers">
              <PartnerOffersSection 
                userPoints={rewards?.balance || 0} 
                onPointsUpdate={handleRedeemSuccess} 
              />
            </TabsContent>

            <TabsContent value="history">
              <Card>
                <CardContent className="p-6">
                  {redemptions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No redemptions yet. Start earning and redeeming rewards!
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {redemptions.map((redemption) => (
                        <div key={redemption.id} className="flex items-center justify-between py-4 border-b border-border last:border-0">
                          <div className="flex items-center gap-4">
                            <div className="p-2 rounded-full bg-accent/20">
                              {getRewardIcon(redemption.reward_catalog?.reward_type)}
                            </div>
                            <div>
                              <p className="font-medium">{redemption.reward_catalog?.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {redemption.points_spent.toLocaleString()} points
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(redemption.status)}
                              <span className="capitalize">{redemption.status}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {new Date(redemption.created_at).toLocaleDateString()}
                            </p>
                            {redemption.tracking_number && (
                              <p className="text-xs text-primary">
                                Tracking: {redemption.tracking_number}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />

      {selectedReward && (
        <RedeemDialog
          open={!!selectedReward}
          onOpenChange={(open) => !open && setSelectedReward(null)}
          reward={selectedReward}
          userPoints={rewards?.balance || 0}
          onSuccess={handleRedeemSuccess}
        />
      )}
    </div>
  );
};

export default RewardsPage;
