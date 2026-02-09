import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Percent, Copy, CheckCircle, Clock, Sparkles } from "lucide-react";

interface PartnerOffer {
  id: string;
  partner_name: string;
  offer_name: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  discount_code: string;
  points_cost: number;
  valid_from: string;
  valid_until: string | null;
  max_redemptions: number | null;
  current_redemptions: number;
  is_active: boolean;
}

interface PartnerOffersSectionProps {
  userPoints: number;
  onPointsUpdate: () => void;
}

const PartnerOffersSection = ({ userPoints, onPointsUpdate }: PartnerOffersSectionProps) => {
  const [offers, setOffers] = useState<PartnerOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOffer, setSelectedOffer] = useState<PartnerOffer | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemedCode, setRedeemedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchOffers();
  }, []);

  const fetchOffers = async () => {
    try {
      const { data } = await supabase
        .from("partner_offers")
        .select("*")
        .eq("is_active", true)
        .order("points_cost", { ascending: true });

      // Filter valid offers (not expired, not maxed out)
      const validOffers = (data || []).filter((offer) => {
        if (offer.valid_until && new Date(offer.valid_until) < new Date()) return false;
        if (offer.max_redemptions && offer.current_redemptions >= offer.max_redemptions) return false;
        return true;
      });

      setOffers(validOffers);
    } catch (error) {
      console.error("Error fetching offers:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDiscount = (offer: PartnerOffer) => {
    if (offer.discount_type === "percentage") {
      return `${offer.discount_value}% off`;
    }
    return `$${offer.discount_value} off`;
  };

  const canRedeem = (offer: PartnerOffer) => {
    return userPoints >= offer.points_cost;
  };

  const handleRedeem = async () => {
    if (!selectedOffer) return;

    setRedeeming(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Deduct points manually
      const { data: currentPoints } = await supabase
        .from("rewards_points")
        .select("balance")
        .eq("user_id", user.id)
        .single();

      if (!currentPoints || currentPoints.balance < selectedOffer.points_cost) {
        throw new Error("Insufficient points");
      }

      await supabase
        .from("rewards_points")
        .update({ balance: currentPoints.balance - selectedOffer.points_cost })
        .eq("user_id", user.id);

      // Increment redemption count
      await supabase
        .from("partner_offers")
        .update({ current_redemptions: selectedOffer.current_redemptions + 1 })
        .eq("id", selectedOffer.id);

      // Log the redemption in point_transactions
      await supabase.from("point_transactions").insert({
        user_id: user.id,
        points: -selectedOffer.points_cost,
        transaction_type: "partner_offer_redemption",
        description: `Redeemed: ${selectedOffer.offer_name} from ${selectedOffer.partner_name}`,
        reference_id: selectedOffer.id,
      });

      setRedeemedCode(selectedOffer.discount_code);
      onPointsUpdate();
      fetchOffers();
      
      toast({ title: "Offer redeemed successfully!" });
    } catch (error: any) {
      console.error("Error redeeming offer:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to redeem offer",
        variant: "destructive",
      });
    } finally {
      setRedeeming(false);
    }
  };

  const copyCode = () => {
    if (redeemedCode) {
      navigator.clipboard.writeText(redeemedCode);
      setCopied(true);
      toast({ title: "Code copied to clipboard!" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const closeDialog = () => {
    setSelectedOffer(null);
    setRedeemedCode(null);
    setCopied(false);
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Loading partner offers...
      </div>
    );
  }

  if (offers.length === 0) {
    return (
      <Card className="bg-muted/30">
        <CardContent className="p-8 text-center">
          <Percent className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No partner offers available right now.</p>
          <p className="text-sm text-muted-foreground">Check back soon for exclusive discounts!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">Partner Offers</h3>
        <Badge variant="secondary">{offers.length} available</Badge>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {offers.map((offer) => {
          const affordable = canRedeem(offer);
          return (
            <Card
              key={offer.id}
              className={`relative transition-all ${
                affordable ? "hover:border-primary/50" : "opacity-60"
              }`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">
                    {offer.partner_name}
                  </Badge>
                  <Badge className="bg-accent text-accent-foreground">
                    {formatDiscount(offer)}
                  </Badge>
                </div>
                <CardTitle className="text-base mt-2">{offer.offer_name}</CardTitle>
              </CardHeader>

              <CardContent className="pb-2">
                {offer.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {offer.description}
                  </p>
                )}
                {offer.valid_until && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    Expires {new Date(offer.valid_until).toLocaleDateString()}
                  </div>
                )}
              </CardContent>

              <CardFooter className="flex justify-between items-center pt-2">
                <div>
                  <p className="text-xl font-bold text-primary">
                    {offer.points_cost.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">points</p>
                </div>
                <Button
                  size="sm"
                  disabled={!affordable}
                  onClick={() => setSelectedOffer(offer)}
                >
                  {affordable ? "Redeem" : "Not enough points"}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Redeem Dialog */}
      <Dialog open={!!selectedOffer} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {redeemedCode ? "Offer Redeemed!" : "Redeem Partner Offer"}
            </DialogTitle>
            {!redeemedCode && (
              <DialogDescription>
                Use {selectedOffer?.points_cost.toLocaleString()} points to get this discount code
              </DialogDescription>
            )}
          </DialogHeader>

          {redeemedCode ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2 text-primary mb-4">
                <CheckCircle className="w-8 h-8" />
                <span className="text-lg font-medium">Success!</span>
              </div>

              <div className="bg-muted rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground mb-2">Your discount code:</p>
                <div className="flex items-center justify-center gap-2">
                  <code className="text-2xl font-bold tracking-wider">{redeemedCode}</code>
                  <Button variant="ghost" size="icon" onClick={copyCode}>
                    {copied ? (
                      <CheckCircle className="w-5 h-5 text-primary" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </Button>
                </div>
              </div>

              <p className="text-sm text-muted-foreground text-center">
                Use this code at {selectedOffer?.partner_name} to claim your discount.
              </p>
            </div>
          ) : (
            selectedOffer && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                  <div className="p-3 rounded-full bg-primary/20">
                    <Percent className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{selectedOffer.offer_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedOffer.partner_name} • {formatDiscount(selectedOffer)}
                    </p>
                  </div>
                </div>

                <div className="flex justify-between items-center p-3 border rounded-lg">
                  <span className="text-muted-foreground">Your Points</span>
                  <span className="font-medium">{userPoints.toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center p-3 border rounded-lg">
                  <span className="text-muted-foreground">Cost</span>
                  <span className="font-medium text-primary">
                    -{selectedOffer.points_cost.toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <span className="font-medium">After Redemption</span>
                  <span className="font-bold">
                    {(userPoints - selectedOffer.points_cost).toLocaleString()}
                  </span>
                </div>
              </div>
            )
          )}

          <DialogFooter>
            {redeemedCode ? (
              <Button onClick={closeDialog} className="w-full">
                Done
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button onClick={handleRedeem} disabled={redeeming}>
                  {redeeming ? "Redeeming..." : "Confirm Redemption"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PartnerOffersSection;
