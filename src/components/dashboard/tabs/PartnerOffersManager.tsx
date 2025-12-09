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
import { Percent, Plus, RefreshCw, Copy } from "lucide-react";

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

const PartnerOffersManager = () => {
  const [offers, setOffers] = useState<PartnerOffer[]>([]);
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
      const { data } = await supabase
        .from("partner_offers")
        .select("*")
        .order("created_at", { ascending: false });

      setOffers(data || []);
    } catch (error) {
      console.error("Error fetching offers:", error);
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
        discount_code: offerForm.discount_code,
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
        toast({ title: "Offer updated" });
      } else {
        const { error } = await supabase
          .from("partner_offers")
          .insert(offerData);

        if (error) throw error;
        toast({ title: "Offer created" });
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
      valid_until: offer.valid_until || "",
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

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Code copied to clipboard" });
  };

  const formatDiscount = (offer: PartnerOffer) => {
    if (offer.discount_type === "percentage") {
      return `${offer.discount_value}% off`;
    } else {
      return `$${offer.discount_value} off`;
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Percent className="w-6 h-6 text-accent" />
          Partner Offers
        </h2>
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
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Total Offers</p>
            <p className="text-2xl font-bold">{offers.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Active Offers</p>
            <p className="text-2xl font-bold text-green-500">
              {offers.filter((o) => o.is_active).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Total Redemptions</p>
            <p className="text-2xl font-bold text-accent">
              {offers.reduce((sum, o) => sum + o.current_redemptions, 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Offers Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Partner Offers</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partner</TableHead>
                <TableHead>Offer</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Points</TableHead>
                <TableHead>Redemptions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offers.map((offer) => (
                <TableRow key={offer.id}>
                  <TableCell className="font-medium">{offer.partner_name}</TableCell>
                  <TableCell>
                    <div>
                      <p>{offer.offer_name}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <code className="text-xs bg-muted px-2 py-0.5 rounded">
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
                  <TableCell>{formatDiscount(offer)}</TableCell>
                  <TableCell>{offer.points_cost.toLocaleString()}</TableCell>
                  <TableCell>
                    {offer.current_redemptions}
                    {offer.max_redemptions && ` / ${offer.max_redemptions}`}
                  </TableCell>
                  <TableCell>
                    <Badge variant={offer.is_active ? "default" : "secondary"}>
                      {offer.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEditOffer(offer)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant={offer.is_active ? "destructive" : "default"}
                        onClick={() => toggleOfferActive(offer)}
                      >
                        {offer.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Offer Dialog */}
      <Dialog open={showOfferDialog} onOpenChange={(open) => {
        setShowOfferDialog(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingOffer ? "Edit Offer" : "Add New Partner Offer"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Partner Name</Label>
              <Input
                value={offerForm.partner_name}
                onChange={(e) => setOfferForm({ ...offerForm, partner_name: e.target.value })}
                placeholder="e.g., Starbucks"
              />
            </div>
            <div className="space-y-2">
              <Label>Offer Name</Label>
              <Input
                value={offerForm.offer_name}
                onChange={(e) => setOfferForm({ ...offerForm, offer_name: e.target.value })}
                placeholder="e.g., 20% off any drink"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={offerForm.description}
                onChange={(e) => setOfferForm({ ...offerForm, description: e.target.value })}
                placeholder="Offer details and terms"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Discount Type</Label>
                <Select
                  value={offerForm.discount_type}
                  onValueChange={(v) => setOfferForm({ ...offerForm, discount_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Discount Value</Label>
                <Input
                  type="number"
                  value={offerForm.discount_value}
                  onChange={(e) => setOfferForm({ ...offerForm, discount_value: e.target.value })}
                  placeholder={offerForm.discount_type === "percentage" ? "20" : "5.00"}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Discount Code</Label>
                <Input
                  value={offerForm.discount_code}
                  onChange={(e) => setOfferForm({ ...offerForm, discount_code: e.target.value })}
                  placeholder="VENDX20"
                />
              </div>
              <div className="space-y-2">
                <Label>Points Cost</Label>
                <Input
                  type="number"
                  value={offerForm.points_cost}
                  onChange={(e) => setOfferForm({ ...offerForm, points_cost: e.target.value })}
                  placeholder="500"
                />
              </div>
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
                  placeholder="∞"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOfferDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveOffer}>
              {editingOffer ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PartnerOffersManager;
