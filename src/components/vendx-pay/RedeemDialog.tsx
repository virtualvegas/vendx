import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, Gift, Package, MapPin, Plus } from "lucide-react";

interface RewardItem {
  id: string;
  name: string;
  description: string | null;
  points_cost: number;
  reward_type: string;
  credit_amount: number | null;
  requires_shipping: boolean;
}

interface ShippingAddress {
  id: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  is_default: boolean;
}

interface RedeemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reward: RewardItem;
  userPoints: number;
  onSuccess: () => void;
}

const RedeemDialog = ({ open, onOpenChange, reward, userPoints, onSuccess }: RedeemDialogProps) => {
  const [addresses, setAddresses] = useState<ShippingAddress[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string>("");
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    zip_code: "",
    country: "USA",
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchAddresses = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("shipping_addresses")
        .select("*")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false });

      setAddresses(data || []);
      
      const defaultAddr = data?.find(a => a.is_default);
      if (defaultAddr) {
        setSelectedAddress(defaultAddr.id);
      }
    };

    if (open && reward.requires_shipping) {
      fetchAddresses();
    }
  }, [open, reward.requires_shipping]);

  const handleAddAddress = async () => {
    if (!newAddress.address_line1 || !newAddress.city || !newAddress.state || !newAddress.zip_code) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required address fields.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const { data, error } = await supabase
        .from("shipping_addresses")
        .insert({
          user_id: user.id,
          ...newAddress,
          is_default: addresses.length === 0,
        })
        .select()
        .single();

      if (error) throw error;

      setAddresses([...addresses, data]);
      setSelectedAddress(data.id);
      setShowAddAddress(false);
      setNewAddress({
        address_line1: "",
        address_line2: "",
        city: "",
        state: "",
        zip_code: "",
        country: "USA",
      });

      toast({ title: "Address Added", description: "Your shipping address has been saved." });
    } catch (error) {
      console.error("Error adding address:", error);
      toast({
        title: "Error",
        description: "Failed to add address. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async () => {
    if (reward.requires_shipping && !selectedAddress) {
      toast({
        title: "Address Required",
        description: "Please select a shipping address.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      // Check points balance
      const { data: rewardsData } = await supabase
        .from("rewards_points")
        .select("id, balance")
        .eq("user_id", user.id)
        .single();

      if (!rewardsData || rewardsData.balance < reward.points_cost) {
        toast({
          title: "Insufficient Points",
          description: "You don't have enough points for this reward.",
          variant: "destructive",
        });
        return;
      }

      // Create redemption
      const { error: redemptionError } = await supabase
        .from("redemptions")
        .insert({
          user_id: user.id,
          reward_id: reward.id,
          points_spent: reward.points_cost,
          status: reward.reward_type === "vend_credit" ? "completed" : "pending",
          shipping_address_id: reward.requires_shipping ? selectedAddress : null,
        });

      if (redemptionError) throw redemptionError;

      // Deduct points
      const newBalance = rewardsData.balance - reward.points_cost;
      const { error: pointsError } = await supabase
        .from("rewards_points")
        .update({ balance: newBalance })
        .eq("id", rewardsData.id);

      if (pointsError) throw pointsError;

      // Log point transaction
      await supabase.from("point_transactions").insert({
        user_id: user.id,
        points: -reward.points_cost,
        transaction_type: "redeem",
        description: `Redeemed: ${reward.name}`,
      });

      // If vend credit, add to wallet
      if (reward.reward_type === "vend_credit" && reward.credit_amount) {
        const { data: wallet } = await supabase
          .from("wallets")
          .select("id, balance")
          .eq("user_id", user.id)
          .single();

        if (wallet) {
          await supabase
            .from("wallets")
            .update({ balance: wallet.balance + reward.credit_amount })
            .eq("id", wallet.id);

          await supabase.from("wallet_transactions").insert({
            wallet_id: wallet.id,
            amount: reward.credit_amount,
            transaction_type: "reward_credit",
            description: `Reward: ${reward.name}`,
          });
        }
      }

      toast({
        title: "Reward Redeemed!",
        description: reward.requires_shipping 
          ? "Your reward will be shipped soon. Check your email for tracking."
          : reward.reward_type === "vend_credit"
            ? `$${reward.credit_amount} has been added to your wallet!`
            : "Your reward has been redeemed successfully.",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error redeeming reward:", error);
      toast({
        title: "Error",
        description: "Failed to redeem reward. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-accent" />
            Redeem Reward
          </DialogTitle>
          <DialogDescription>
            You're about to redeem {reward.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Reward Summary */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h4 className="font-semibold">{reward.name}</h4>
            <p className="text-sm text-muted-foreground">{reward.description}</p>
            <div className="flex justify-between items-center pt-2 border-t border-border">
              <span className="text-sm text-muted-foreground">Points Cost:</span>
              <span className="font-bold text-accent">{reward.points_cost.toLocaleString()} pts</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Your Balance:</span>
              <span className="font-medium">{userPoints.toLocaleString()} pts</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">After Redemption:</span>
              <span className="font-medium">{(userPoints - reward.points_cost).toLocaleString()} pts</span>
            </div>
          </div>

          {/* Shipping Address */}
          {reward.requires_shipping && (
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Shipping Address
              </Label>
              
              {addresses.length > 0 && !showAddAddress ? (
                <>
                  <Select value={selectedAddress} onValueChange={setSelectedAddress}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an address" />
                    </SelectTrigger>
                    <SelectContent>
                      {addresses.map((addr) => (
                        <SelectItem key={addr.id} value={addr.id}>
                          {addr.address_line1}, {addr.city}, {addr.state} {addr.zip_code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={() => setShowAddAddress(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add New Address
                  </Button>
                </>
              ) : (
                <div className="space-y-3 p-4 border border-border rounded-lg">
                  <Input
                    placeholder="Address Line 1 *"
                    value={newAddress.address_line1}
                    onChange={(e) => setNewAddress({ ...newAddress, address_line1: e.target.value })}
                  />
                  <Input
                    placeholder="Address Line 2 (Optional)"
                    value={newAddress.address_line2}
                    onChange={(e) => setNewAddress({ ...newAddress, address_line2: e.target.value })}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="City *"
                      value={newAddress.city}
                      onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                    />
                    <Input
                      placeholder="State *"
                      value={newAddress.state}
                      onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="ZIP Code *"
                      value={newAddress.zip_code}
                      onChange={(e) => setNewAddress({ ...newAddress, zip_code: e.target.value })}
                    />
                    <Input
                      placeholder="Country"
                      value={newAddress.country}
                      onChange={(e) => setNewAddress({ ...newAddress, country: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleAddAddress} disabled={loading} size="sm">
                      Save Address
                    </Button>
                    {addresses.length > 0 && (
                      <Button variant="outline" size="sm" onClick={() => setShowAddAddress(false)}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleRedeem} 
            disabled={loading || (reward.requires_shipping && !selectedAddress)}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Redeeming...
              </>
            ) : (
              <>
                <Gift className="w-4 h-4 mr-2" />
                Confirm Redemption
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RedeemDialog;
