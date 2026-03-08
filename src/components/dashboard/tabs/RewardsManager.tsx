import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gift, Plus, Package, Truck, CheckCircle, Clock, RefreshCw } from "lucide-react";

interface RewardItem {
  id: string;
  name: string;
  description: string | null;
  points_cost: number;
  reward_type: string;
  credit_amount: number | null;
  requires_shipping: boolean;
  stock: number | null;
  is_active: boolean;
  tier_required: string;
}

interface Redemption {
  id: string;
  points_spent: number;
  status: string;
  tracking_number: string | null;
  notes: string | null;
  created_at: string;
  user_id: string;
  reward_catalog: {
    name: string;
    reward_type: string;
    requires_shipping: boolean;
  };
  shipping_addresses: {
    address_line1: string;
    city: string;
    state: string;
    zip_code: string;
  } | null;
}

const RewardsManager = () => {
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRewardDialog, setShowRewardDialog] = useState(false);
  const [showShippingDialog, setShowShippingDialog] = useState(false);
  const [selectedRedemption, setSelectedRedemption] = useState<Redemption | null>(null);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [editingReward, setEditingReward] = useState<RewardItem | null>(null);
  const [rewardForm, setRewardForm] = useState({
    name: "",
    description: "",
    points_cost: "",
    reward_type: "vend_credit",
    credit_amount: "",
    requires_shipping: false,
    stock: "",
    tier_required: "bronze",
  });
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: rewardsData } = await supabase
        .from("reward_catalog")
        .select("*")
        .order("points_cost", { ascending: true });

      setRewards(rewardsData || []);

      const { data: redemptionsData } = await supabase
        .from("redemptions")
        .select(`
          *,
          reward_catalog (name, reward_type, requires_shipping),
          shipping_addresses (address_line1, city, state, zip_code)
        `)
        .order("created_at", { ascending: false });

      setRedemptions(redemptionsData as Redemption[] || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveReward = async () => {
    try {
      const rewardData = {
        name: rewardForm.name,
        description: rewardForm.description || null,
        points_cost: parseInt(rewardForm.points_cost),
        reward_type: rewardForm.reward_type,
        credit_amount: rewardForm.credit_amount ? parseFloat(rewardForm.credit_amount) : null,
        requires_shipping: rewardForm.requires_shipping,
        stock: rewardForm.stock ? parseInt(rewardForm.stock) : null,
        tier_required: rewardForm.tier_required,
        is_active: true,
      };

      if (editingReward) {
        const { error } = await supabase
          .from("reward_catalog")
          .update(rewardData)
          .eq("id", editingReward.id);

        if (error) throw error;
        toast({ title: "Reward updated" });
      } else {
        const { error } = await supabase
          .from("reward_catalog")
          .insert(rewardData);

        if (error) throw error;
        toast({ title: "Reward created" });
      }

      setShowRewardDialog(false);
      resetRewardForm();
      fetchData();
    } catch (error) {
      console.error("Error saving reward:", error);
      toast({
        title: "Error",
        description: "Failed to save reward",
        variant: "destructive",
      });
    }
  };

  const resetRewardForm = () => {
    setRewardForm({
      name: "",
      description: "",
      points_cost: "",
      reward_type: "vend_credit",
      credit_amount: "",
      requires_shipping: false,
      stock: "",
      tier_required: "bronze",
    });
    setEditingReward(null);
  };

  const handleEditReward = (reward: RewardItem) => {
    setEditingReward(reward);
    setRewardForm({
      name: reward.name,
      description: reward.description || "",
      points_cost: reward.points_cost.toString(),
      reward_type: reward.reward_type,
      credit_amount: reward.credit_amount?.toString() || "",
      requires_shipping: reward.requires_shipping,
      stock: reward.stock?.toString() || "",
      tier_required: reward.tier_required,
    });
    setShowRewardDialog(true);
  };

  const toggleRewardActive = async (reward: RewardItem) => {
    try {
      const { error } = await supabase
        .from("reward_catalog")
        .update({ is_active: !reward.is_active })
        .eq("id", reward.id);

      if (error) throw error;
      toast({ title: `Reward ${reward.is_active ? "deactivated" : "activated"}` });
      fetchData();
    } catch (error) {
      console.error("Error toggling reward:", error);
    }
  };

  const handleUpdateShipping = async () => {
    if (!selectedRedemption) return;

    try {
      const updateData: { status: string; tracking_number?: string } = {
        status: "shipped",
      };
      if (trackingNumber) {
        updateData.tracking_number = trackingNumber;
      }

      const { error } = await supabase
        .from("redemptions")
        .update(updateData)
        .eq("id", selectedRedemption.id);

      if (error) throw error;

      toast({ title: "Shipping updated" });
      setShowShippingDialog(false);
      setTrackingNumber("");
      setSelectedRedemption(null);
      fetchData();
    } catch (error) {
      console.error("Error updating shipping:", error);
      toast({
        title: "Error",
        description: "Failed to update shipping",
        variant: "destructive",
      });
    }
  };

  const markAsCompleted = async (redemption: Redemption) => {
    try {
      const { error } = await supabase
        .from("redemptions")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", redemption.id);

      if (error) throw error;
      toast({ title: "Marked as completed" });
      fetchData();
    } catch (error) {
      console.error("Error completing redemption:", error);
    }
  };

  const pendingShipments = redemptions.filter(
    (r) => r.reward_catalog?.requires_shipping && r.status === "pending"
  );

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Gift className="w-6 h-6 text-accent" />
          Rewards Manager
        </h2>
        <div className="flex gap-2">
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowRewardDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Reward
          </Button>
        </div>
      </div>

      {/* Pending Shipments Alert */}
      {pendingShipments.length > 0 && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="p-4 flex items-center gap-4">
            <Package className="w-6 h-6 text-yellow-500" />
            <div>
              <p className="font-medium">Pending Shipments</p>
              <p className="text-sm text-muted-foreground">
                {pendingShipments.length} reward(s) awaiting shipment
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="catalog">
        <TabsList>
          <TabsTrigger value="catalog">Reward Catalog</TabsTrigger>
          <TabsTrigger value="redemptions">All Redemptions</TabsTrigger>
          <TabsTrigger value="shipments">Pending Shipments</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Reward Catalog</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Type</TableHead>
                    <TableHead>Points</TableHead>
                    <TableHead className="hidden md:table-cell">Tier</TableHead>
                    <TableHead className="hidden lg:table-cell">Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rewards.map((reward) => (
                    <TableRow key={reward.id}>
                      <TableCell className="font-medium">{reward.name}</TableCell>
                      <TableCell className="capitalize">{reward.reward_type.replace("_", " ")}</TableCell>
                      <TableCell>{reward.points_cost.toLocaleString()}</TableCell>
                      <TableCell className="capitalize">{reward.tier_required}</TableCell>
                      <TableCell>{reward.stock !== null ? reward.stock : "∞"}</TableCell>
                      <TableCell>
                        <Badge variant={reward.is_active ? "default" : "secondary"}>
                          {reward.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleEditReward(reward)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant={reward.is_active ? "destructive" : "default"}
                            onClick={() => toggleRewardActive(reward)}
                          >
                            {reward.is_active ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="redemptions" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>All Redemptions</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reward</TableHead>
                    <TableHead>Points</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {redemptions.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.reward_catalog?.name}</TableCell>
                      <TableCell>{r.points_spent.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            r.status === "completed"
                              ? "default"
                              : r.status === "shipped"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {r.status === "completed" && <CheckCircle className="w-3 h-3 mr-1" />}
                          {r.status === "shipped" && <Truck className="w-3 h-3 mr-1" />}
                          {r.status === "pending" && <Clock className="w-3 h-3 mr-1" />}
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {r.status !== "completed" && (
                          <Button size="sm" variant="outline" onClick={() => markAsCompleted(r)}>
                            Complete
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shipments" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Pending Shipments</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingShipments.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No pending shipments</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reward</TableHead>
                      <TableHead>Shipping Address</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingShipments.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.reward_catalog?.name}</TableCell>
                        <TableCell className="text-sm">
                          {r.shipping_addresses ? (
                            <>
                              {r.shipping_addresses.address_line1}<br />
                              {r.shipping_addresses.city}, {r.shipping_addresses.state} {r.shipping_addresses.zip_code}
                            </>
                          ) : (
                            "No address"
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedRedemption(r);
                              setShowShippingDialog(true);
                            }}
                          >
                            <Truck className="w-4 h-4 mr-2" />
                            Ship
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Reward Dialog */}
      <Dialog open={showRewardDialog} onOpenChange={(open) => {
        setShowRewardDialog(open);
        if (!open) resetRewardForm();
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingReward ? "Edit Reward" : "Add New Reward"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={rewardForm.name}
                onChange={(e) => setRewardForm({ ...rewardForm, name: e.target.value })}
                placeholder="Reward name"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={rewardForm.description}
                onChange={(e) => setRewardForm({ ...rewardForm, description: e.target.value })}
                placeholder="Description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Points Cost</Label>
                <Input
                  type="number"
                  value={rewardForm.points_cost}
                  onChange={(e) => setRewardForm({ ...rewardForm, points_cost: e.target.value })}
                  placeholder="1000"
                />
              </div>
              <div className="space-y-2">
                <Label>Reward Type</Label>
                <Select
                  value={rewardForm.reward_type}
                  onValueChange={(v) => setRewardForm({ ...rewardForm, reward_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vend_credit">Vend Credit</SelectItem>
                    <SelectItem value="physical_item">Physical Item</SelectItem>
                    <SelectItem value="partner_discount">Partner Discount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {rewardForm.reward_type === "vend_credit" && (
              <div className="space-y-2">
                <Label>Credit Amount ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={rewardForm.credit_amount}
                  onChange={(e) => setRewardForm({ ...rewardForm, credit_amount: e.target.value })}
                  placeholder="5.00"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tier Required</Label>
                <Select
                  value={rewardForm.tier_required}
                  onValueChange={(v) => setRewardForm({ ...rewardForm, tier_required: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bronze">Bronze</SelectItem>
                    <SelectItem value="silver">Silver</SelectItem>
                    <SelectItem value="gold">Gold</SelectItem>
                    <SelectItem value="platinum">Platinum</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Stock (leave empty for unlimited)</Label>
                <Input
                  type="number"
                  value={rewardForm.stock}
                  onChange={(e) => setRewardForm({ ...rewardForm, stock: e.target.value })}
                  placeholder="∞"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRewardDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveReward}>
              {editingReward ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shipping Dialog */}
      <Dialog open={showShippingDialog} onOpenChange={setShowShippingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Shipping</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Reward</p>
              <p className="font-medium">{selectedRedemption?.reward_catalog?.name}</p>
            </div>
            {selectedRedemption?.shipping_addresses && (
              <div>
                <p className="text-sm text-muted-foreground">Ship To</p>
                <p className="font-medium">
                  {selectedRedemption.shipping_addresses.address_line1}<br />
                  {selectedRedemption.shipping_addresses.city}, {selectedRedemption.shipping_addresses.state} {selectedRedemption.shipping_addresses.zip_code}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Tracking Number (optional)</Label>
              <Input
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Enter tracking number"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShippingDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateShipping}>
              <Truck className="w-4 h-4 mr-2" />
              Mark as Shipped
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RewardsManager;
