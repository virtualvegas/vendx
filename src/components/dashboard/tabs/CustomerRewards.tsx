import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gift, Star, Trophy, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const tierColors: Record<string, string> = {
  bronze: "bg-amber-700",
  silver: "bg-gray-400",
  gold: "bg-yellow-500",
  platinum: "bg-purple-500",
};

const tierThresholds = {
  bronze: 0,
  silver: 5000,
  gold: 25000,
  platinum: 100000,
};

const CustomerRewards = () => {
  const { toast } = useToast();

  const { data: rewardsPoints, isLoading: pointsLoading } = useQuery({
    queryKey: ["customer-rewards-points"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("rewards_points")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const { data: catalog, isLoading: catalogLoading } = useQuery({
    queryKey: ["rewards-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reward_catalog")
        .select("*")
        .eq("is_active", true)
        .order("points_cost", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const { data: redemptions, isLoading: redemptionsLoading } = useQuery({
    queryKey: ["customer-redemptions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("redemptions")
        .select("*, reward_catalog(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
  });

  const currentTier = rewardsPoints?.tier || "bronze";
  const lifetimePoints = rewardsPoints?.lifetime_points || 0;
  const currentBalance = rewardsPoints?.balance || 0;

  const getNextTier = () => {
    const tiers = ["bronze", "silver", "gold", "platinum"];
    const currentIndex = tiers.indexOf(currentTier);
    if (currentIndex < tiers.length - 1) {
      return tiers[currentIndex + 1];
    }
    return null;
  };

  const getProgressToNextTier = () => {
    const nextTier = getNextTier();
    if (!nextTier) return 100;
    const nextThreshold = tierThresholds[nextTier as keyof typeof tierThresholds];
    const currentThreshold = tierThresholds[currentTier as keyof typeof tierThresholds];
    const progress = ((lifetimePoints - currentThreshold) / (nextThreshold - currentThreshold)) * 100;
    return Math.min(Math.max(progress, 0), 100);
  };

  const handleRedeem = async (rewardId: string, pointsCost: number) => {
    if (currentBalance < pointsCost) {
      toast({
        title: "Insufficient Points",
        description: "You don't have enough points to redeem this reward.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Coming Soon",
      description: "Reward redemption will be available soon!",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">My Rewards</h2>
        <p className="text-muted-foreground">
          Earn points with every purchase and redeem for exclusive rewards
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-primary/20 to-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Star className="w-4 h-4" />
              Points Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">
              {currentBalance.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              Current Tier
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={`${tierColors[currentTier]} text-white capitalize text-lg px-3 py-1`}>
              {currentTier}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Lifetime Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{lifetimePoints.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {getNextTier() && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Progress to {getNextTier()?.charAt(0).toUpperCase()}{getNextTier()?.slice(1)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full bg-muted rounded-full h-3">
              <div
                className="bg-primary h-3 rounded-full transition-all duration-500"
                style={{ width: `${getProgressToNextTier()}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {lifetimePoints.toLocaleString()} / {tierThresholds[getNextTier() as keyof typeof tierThresholds].toLocaleString()} points
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5" />
            Available Rewards
          </CardTitle>
        </CardHeader>
        <CardContent>
          {catalogLoading ? (
            <p className="text-muted-foreground">Loading rewards...</p>
          ) : catalog && catalog.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {catalog.map((reward) => (
                <Card key={reward.id} className="border border-border">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-foreground">{reward.name}</h4>
                        <p className="text-xs text-muted-foreground">{reward.description}</p>
                      </div>
                      <Badge variant="outline">{reward.reward_type}</Badge>
                    </div>
                    <div className="flex items-center justify-between mt-4">
                      <span className="text-primary font-bold">
                        {reward.points_cost.toLocaleString()} pts
                      </span>
                      <Button
                        size="sm"
                        disabled={currentBalance < reward.points_cost}
                        onClick={() => handleRedeem(reward.id, reward.points_cost)}
                      >
                        Redeem
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No rewards available at the moment. Check back soon!
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Redemption History</CardTitle>
        </CardHeader>
        <CardContent>
          {redemptionsLoading ? (
            <p className="text-muted-foreground">Loading history...</p>
          ) : redemptions && redemptions.length > 0 ? (
            <div className="space-y-3">
              {redemptions.map((redemption) => (
                <div
                  key={redemption.id}
                  className="flex items-center justify-between p-3 border border-border rounded-lg"
                >
                  <div>
                    <p className="font-medium text-foreground">
                      {(redemption.reward_catalog as any)?.name || "Reward"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(redemption.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant={
                      redemption.status === "completed" ? "default" :
                      redemption.status === "pending" ? "secondary" : "outline"
                    }>
                      {redemption.status}
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-1">
                      -{redemption.points_spent.toLocaleString()} pts
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No redemptions yet. Start earning and redeeming rewards!
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerRewards;
