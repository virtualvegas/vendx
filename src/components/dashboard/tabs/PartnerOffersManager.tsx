import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Percent, Plus, RefreshCw, Copy, Wand2, Calendar, Users, TrendingUp, Clock, CheckCircle, XCircle, Sparkles } from "lucide-react";

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
  created_at: string;
}

interface OfferRedemption {
  id: string;
  user_id: string;
  points: number;
  transaction_type: string;
  description: string | null;
  reference_id: string | null;
  created_at: string;
}

const PartnerOffersManager = () => {
  const [offers, setOffers] = useState<PartnerOffer[]>([]);
  const [redemptions, setRedemptions] = useState<OfferRedemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOfferDialog, setShowOfferDialog] = useState(false);
  const [editingOffer, setEditingOffer] = useState<PartnerOffer | null>(null);
  const [offerForm, setOfferForm] = useState({
    partner_name: "",
    offer_name: "",
    description: "",
    discount_type: "percentage",
    discount_value: "",
    discount_code: "",
    points_cost: "",
    valid_until: "",
    max_redemptions: "",
  });
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [offersRes, redemptionsRes] = await Promise.all([
        supabase
          .from("partner_offers")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("point_transactions")
          .select("*")
          .eq("transaction_type", "partner_offer_redemption")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      setOffers(offersRes.data || []);
      setRedemptions(redemptionsRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveOffer = async () => {
    try {
      const offerData = {
        partner_name: offerForm.partner_name,
        offer_name: offerForm.offer_name,
        description: offerForm.description || null,
        discount_type: offerForm.discount_type,
        discount_value: parseFloat(offerForm.discount_value),
        discount_code: offerForm.discount_code.toUpperCase(),
        points_cost: parseInt(offerForm.points_cost),
        valid_until: offerForm.valid_until || null,
        max_redemptions: offerForm.max_redemptions ? parseInt(offerForm.max_redemptions) : null,
        is_active: true,
      };

      if (editingOffer) {
        const { error } = await supabase
          .from("partner_offers")
          .update(offerData)
          .eq("id", editingOffer.id);

        if (error) throw error;
        toast({ title: "Offer updated successfully" });
      } else {
        const { error } = await supabase
          .from("partner_offers")
          .insert(offerData);

        if (error) throw error;
        toast({ title: "Offer created successfully" });
      }

      setShowOfferDialog(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Error saving offer:", error);
      toast({
        title: "Error",
        description: "Failed to save offer",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setOfferForm({
      partner_name: "",
      offer_name: "",
      description: "",
      discount_type: "percentage",
      discount_value: "",
      discount_code: "",
      points_cost: "",
      valid_until: "",
      max_redemptions: "",
    });
    setEditingOffer(null);
  };

  const handleEditOffer = (offer: PartnerOffer) => {
    setEditingOffer(offer);
    setOfferForm({
      partner_name: offer.partner_name,
      offer_name: offer.offer_name,
      description: offer.description || "",
      discount_type: offer.discount_type,
      discount_value: offer.discount_value.toString(),
      discount_code: offer.discount_code,
      points_cost: offer.points_cost.toString(),
      valid_until: offer.valid_until ? offer.valid_until.split("T")[0] : "",
      max_redemptions: offer.max_redemptions?.toString() || "",
    });
    setShowOfferDialog(true);
  };

  const toggleOfferActive = async (offer: PartnerOffer) => {
    try {
      const { error } = await supabase
        .from("partner_offers")
        .update({ is_active: !offer.is_active })
        .eq("id", offer.id);

      if (error) throw error;
      toast({ title: `Offer ${offer.is_active ? "deactivated" : "activated"}` });
      fetchData();
    } catch (error) {
      console.error("Error toggling offer:", error);
    }
  };

  const deleteOffer = async (offer: PartnerOffer) => {
    if (!confirm(`Delete "${offer.offer_name}"? This cannot be undone.`)) return;
    
    try {
      const { error } = await supabase
        .from("partner_offers")
        .delete()
        .eq("id", offer.id);

      if (error) throw error;
      toast({ title: "Offer deleted" });
      fetchData();
    } catch (error) {
      console.error("Error deleting offer:", error);
      toast({ title: "Error", description: "Failed to delete offer", variant: "destructive" });
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Code copied to clipboard" });
  };

  const generateCode = () => {
    const prefix = offerForm.partner_name.slice(0, 4).toUpperCase() || "DEAL";
    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    setOfferForm({ ...offerForm, discount_code: `${prefix}${suffix}` });
  };

  const formatDiscount = (offer: PartnerOffer) => {
    if (offer.discount_type === "percentage") {
      return `${offer.discount_value}% off`;
    }
    return `$${offer.discount_value} off`;
  };

  const isExpired = (offer: PartnerOffer) => {
    if (!offer.valid_until) return false;
    return new Date(offer.valid_until) < new Date();
  };

  const isMaxedOut = (offer: PartnerOffer) => {
    if (!offer.max_redemptions) return false;
    return offer.current_redemptions >= offer.max_redemptions;
  };

  const activeOffers = offers.filter((o) => o.is_active && !isExpired(o) && !isMaxedOut(o));
  const expiredOffers = offers.filter((o) => isExpired(o) || isMaxedOut(o) || !o.is_active);

  const totalRedemptions = offers.reduce((sum, o) => sum + o.current_redemptions, 0);
  const totalPointsRedeemed = redemptions.reduce((sum, r) => sum + Math.abs(r.points), 0);

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading partner offers...</div>;
  }

  const OfferTable = ({ offerList, showActions = true }: { offerList: PartnerOffer[]; showActions?: boolean }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Partner</TableHead>
          <TableHead>Offer</TableHead>
          <TableHead>Discount</TableHead>
          <TableHead>Points Cost</TableHead>
          <TableHead>Redemptions</TableHead>
          <TableHead>Valid Until</TableHead>
          <TableHead>Status</TableHead>
          {showActions && <TableHead>Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {offerList.length === 0 ? (
          <TableRow>
            <TableCell colSpan={showActions ? 8 : 7} className="text-center py-8 text-muted-foreground">
              No offers found
            </TableCell>
          </TableRow>
        ) : (
          offerList.map((offer) => (
            <TableRow key={offer.id} className={!offer.is_active ? "opacity-60" : ""}>
              <TableCell className="font-medium">{offer.partner_name}</TableCell>
              <TableCell>
                <div>
                  <p className="font-medium">{offer.offer_name}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                      {offer.discount_code}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => copyCode(offer.discount_code)}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{formatDiscount(offer)}</Badge>
              </TableCell>
              <TableCell>{offer.points_cost.toLocaleString()}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Users className="w-3 h-3 text-muted-foreground" />
                  {offer.current_redemptions}
                  {offer.max_redemptions && (
                    <span className="text-muted-foreground">/ {offer.max_redemptions}</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {offer.valid_until ? (
                  <div className="flex items-center gap-1 text-sm">
                    <Calendar className="w-3 h-3 text-muted-foreground" />
                    {new Date(offer.valid_until).toLocaleDateString()}
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">No expiry</span>
                )}
              </TableCell>
              <TableCell>
                {isExpired(offer) ? (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="w-3 h-3" /> Expired
                  </Badge>
                ) : isMaxedOut(offer) ? (
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle className="w-3 h-3" /> Maxed Out
                  </Badge>
                ) : offer.is_active ? (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle className="w-3 h-3" /> Active
                  </Badge>
                ) : (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </TableCell>
              {showActions && (
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => handleEditOffer(offer)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant={offer.is_active ? "secondary" : "default"}
                      onClick={() => toggleOfferActive(offer)}
                    >
                      {offer.is_active ? "Pause" : "Activate"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteOffer(offer)}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Percent className="w-6 h-6 text-primary" />
            Partner Offers
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Manage partner discount offers that users can redeem with their points
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowOfferDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Offer
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Offers</p>
                <p className="text-2xl font-bold">{activeOffers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <Users className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Redemptions</p>
                <p className="text-2xl font-bold">{totalRedemptions.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary">
                <TrendingUp className="w-5 h-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Points Redeemed</p>
                <p className="text-2xl font-bold">{totalPointsRedeemed.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Clock className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Expired/Inactive</p>
                <p className="text-2xl font-bold">{expiredOffers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">Active Offers ({activeOffers.length})</TabsTrigger>
          <TabsTrigger value="archived">Archived ({expiredOffers.length})</TabsTrigger>
          <TabsTrigger value="history">Redemption History</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle>Active Partner Offers</CardTitle>
              <CardDescription>
                These offers are currently available for users to redeem with their reward points
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OfferTable offerList={activeOffers} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="archived">
          <Card>
            <CardHeader>
              <CardTitle>Archived Offers</CardTitle>
              <CardDescription>
                Expired, maxed out, or manually deactivated offers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OfferTable offerList={expiredOffers} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Redemption History</CardTitle>
              <CardDescription>
                Recent partner offer redemptions by users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Offer</TableHead>
                    <TableHead>Points Used</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {redemptions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        No redemptions yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    redemptions.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          {new Date(r.created_at).toLocaleDateString()} at{" "}
                          {new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </TableCell>
                        <TableCell>{r.description || "Partner Offer Redemption"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{Math.abs(r.points).toLocaleString()} pts</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Offer Dialog */}
      <Dialog
        open={showOfferDialog}
        onOpenChange={(open) => {
          setShowOfferDialog(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingOffer ? "Edit Partner Offer" : "Create New Partner Offer"}</DialogTitle>
            <DialogDescription>
              {editingOffer
                ? "Update the details of this partner offer"
                : "Add a new discount offer from a partner business"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Partner Name *</Label>
                <Input
                  value={offerForm.partner_name}
                  onChange={(e) => setOfferForm({ ...offerForm, partner_name: e.target.value })}
                  placeholder="e.g., Starbucks"
                />
              </div>
              <div className="space-y-2">
                <Label>Offer Name *</Label>
                <Input
                  value={offerForm.offer_name}
                  onChange={(e) => setOfferForm({ ...offerForm, offer_name: e.target.value })}
                  placeholder="e.g., 20% off any drink"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={offerForm.description}
                onChange={(e) => setOfferForm({ ...offerForm, description: e.target.value })}
                placeholder="Terms and conditions, how to use the code, etc."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Discount Type *</Label>
                <Select
                  value={offerForm.discount_type}
                  onValueChange={(v) => setOfferForm({ ...offerForm, discount_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage Off</SelectItem>
                    <SelectItem value="fixed">Fixed Amount Off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Discount Value *</Label>
                <Input
                  type="number"
                  value={offerForm.discount_value}
                  onChange={(e) => setOfferForm({ ...offerForm, discount_value: e.target.value })}
                  placeholder={offerForm.discount_type === "percentage" ? "20" : "5.00"}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Discount Code *</Label>
              <div className="flex gap-2">
                <Input
                  value={offerForm.discount_code}
                  onChange={(e) => setOfferForm({ ...offerForm, discount_code: e.target.value.toUpperCase() })}
                  placeholder="VENDX20"
                  className="font-mono"
                />
                <Button type="button" variant="outline" onClick={generateCode}>
                  <Wand2 className="w-4 h-4 mr-2" />
                  Generate
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Points Cost *</Label>
              <Input
                type="number"
                value={offerForm.points_cost}
                onChange={(e) => setOfferForm({ ...offerForm, points_cost: e.target.value })}
                placeholder="500"
              />
              <p className="text-xs text-muted-foreground">
                How many reward points users need to unlock this offer
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valid Until (optional)</Label>
                <Input
                  type="date"
                  value={offerForm.valid_until}
                  onChange={(e) => setOfferForm({ ...offerForm, valid_until: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Redemptions (optional)</Label>
                <Input
                  type="number"
                  value={offerForm.max_redemptions}
                  onChange={(e) => setOfferForm({ ...offerForm, max_redemptions: e.target.value })}
                  placeholder="Unlimited"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOfferDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveOffer}
              disabled={
                !offerForm.partner_name ||
                !offerForm.offer_name ||
                !offerForm.discount_value ||
                !offerForm.discount_code ||
                !offerForm.points_cost
              }
            >
              {editingOffer ? "Update Offer" : "Create Offer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PartnerOffersManager;
