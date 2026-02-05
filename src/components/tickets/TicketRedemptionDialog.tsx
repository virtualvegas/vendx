import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Loader2, Ticket, MapPin, Truck, Store, CheckCircle, Plus, Copy } from "lucide-react";
import { toast } from "sonner";

interface TicketPrize {
  id: string;
  name: string;
  description: string | null;
  ticket_cost: number;
  category: string;
  requires_approval: boolean;
  requires_shipping: boolean;
  shipping_fee_type?: string;
  shipping_fee_amount?: number;
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

interface TicketRedemptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prize: TicketPrize | null;
  userBalance: number;
  onSuccess: () => void;
}

export const TicketRedemptionDialog = ({
  open,
  onOpenChange,
  prize,
  userBalance,
  onSuccess,
}: TicketRedemptionDialogProps) => {
  const queryClient = useQueryClient();
  const [redemptionType, setRedemptionType] = useState<"online" | "in_person">("online");
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [selectedAddress, setSelectedAddress] = useState<string>("");
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [redemptionCode, setRedemptionCode] = useState<string | null>(null);
  const [newAddress, setNewAddress] = useState({
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    zip_code: "",
    country: "USA",
  });

  // Fetch locations
  const { data: locations } = useQuery({
    queryKey: ["redemption-locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name, city, address")
        .eq("status", "active")
        .order("city");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch shipping addresses
  const { data: addresses, refetch: refetchAddresses } = useQuery({
    queryKey: ["user-shipping-addresses"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("shipping_addresses")
        .select("*")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false });
      if (error) throw error;
      return data as ShippingAddress[];
    },
    enabled: open && prize?.requires_shipping,
  });

  useEffect(() => {
    if (addresses?.length && !selectedAddress) {
      const defaultAddr = addresses.find(a => a.is_default);
      if (defaultAddr) setSelectedAddress(defaultAddr.id);
    }
  }, [addresses, selectedAddress]);

  useEffect(() => {
    if (!open) {
      setRedemptionCode(null);
      setRedemptionType("online");
      setSelectedLocation("");
      setShowAddAddress(false);
    }
  }, [open]);

  // Add address mutation
  const addAddressMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("shipping_addresses")
        .insert({
          user_id: user.id,
          ...newAddress,
          is_default: !addresses?.length,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
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
      refetchAddresses();
      toast.success("Address added");
    },
    onError: (error) => {
      toast.error("Failed to add address: " + error.message);
    },
  });

  // Redemption mutation
  const redeemMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("tickets-redeem-prize", {
        body: {
          prize_id: prize?.id,
          location_id: redemptionType === "in_person" ? selectedLocation : null,
          redemption_type: redemptionType,
          shipping_address_id: prize?.requires_shipping ? selectedAddress : null,
        },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Redemption failed");
      return data;
    },
    onSuccess: (data) => {
      setRedemptionCode(data.redemption_code);
      queryClient.invalidateQueries({ queryKey: ["user-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["user-redemptions"] });
      onSuccess();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const copyCode = () => {
    if (redemptionCode) {
      navigator.clipboard.writeText(redemptionCode);
      toast.success("Code copied!");
    }
  };

  if (!prize) return null;

  const canRedeem = 
    userBalance >= prize.ticket_cost &&
    (redemptionType === "online" || selectedLocation) &&
    (!prize.requires_shipping || selectedAddress);

  // Success state
  if (redemptionCode) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-500">
              <CheckCircle className="h-5 w-5" />
              Prize Redeemed!
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4 text-center">
            <p className="text-muted-foreground">
              {prize.requires_approval 
                ? "Your redemption is pending approval."
                : redemptionType === "in_person"
                  ? "Show this code to staff to claim your prize."
                  : prize.requires_shipping
                    ? "Your prize will be shipped soon!"
                    : "Your redemption has been processed."
              }
            </p>

            <div className="bg-muted rounded-lg p-6">
              <p className="text-sm text-muted-foreground mb-2">Redemption Code</p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl font-mono font-bold tracking-wider">
                  {redemptionCode}
                </span>
                <Button size="icon" variant="ghost" onClick={copyCode}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              <p className="font-medium">{prize.name}</p>
              <p>{prize.ticket_cost.toLocaleString()} tickets</p>
            </div>
          </div>

          <DialogFooter>
            <Button className="w-full" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5 text-primary" />
            Redeem Prize
          </DialogTitle>
          <DialogDescription>
            Redeem {prize.name} for {prize.ticket_cost.toLocaleString()} tickets
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Balance Check */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Prize Cost:</span>
              <span className="font-bold">{prize.ticket_cost.toLocaleString()} tickets</span>
            </div>
            {prize.requires_shipping && prize.shipping_fee_type === "tickets" && prize.shipping_fee_amount ? (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Shipping (tickets):</span>
                <span className="font-medium">+{prize.shipping_fee_amount.toLocaleString()} tickets</span>
              </div>
            ) : prize.requires_shipping && prize.shipping_fee_type === "fixed" && prize.shipping_fee_amount ? (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Shipping Fee:</span>
                <span className="font-medium">${prize.shipping_fee_amount.toFixed(2)}</span>
              </div>
            ) : prize.requires_shipping ? (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Shipping:</span>
                <span className="font-medium text-primary">FREE</span>
              </div>
            ) : null}
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Your Balance:</span>
              <span className="font-medium">{userBalance.toLocaleString()} tickets</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-sm text-muted-foreground">After Redemption:</span>
              {(() => {
                const shippingTickets = prize.shipping_fee_type === "tickets" ? (prize.shipping_fee_amount || 0) : 0;
                const totalCost = prize.ticket_cost + shippingTickets;
                const remaining = userBalance - totalCost;
                return (
                  <span className={remaining >= 0 ? "font-medium text-primary" : "text-destructive"}>
                    {remaining.toLocaleString()} tickets
                  </span>
                );
              })()}
            </div>
          </div>

          {/* Redemption Type */}
          <div className="space-y-3">
            <Label>How would you like to redeem?</Label>
            <RadioGroup 
              value={redemptionType} 
              onValueChange={(v) => setRedemptionType(v as "online" | "in_person")}
              className="grid grid-cols-2 gap-4"
            >
              <div>
                <RadioGroupItem value="online" id="online" className="peer sr-only" />
                <Label
                  htmlFor="online"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <Truck className="h-6 w-6 mb-2" />
                  <span className="text-sm font-medium">Online</span>
                  <span className="text-xs text-muted-foreground">Ship to me</span>
                </Label>
              </div>
              <div>
                <RadioGroupItem value="in_person" id="in_person" className="peer sr-only" />
                <Label
                  htmlFor="in_person"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <Store className="h-6 w-6 mb-2" />
                  <span className="text-sm font-medium">In-Person</span>
                  <span className="text-xs text-muted-foreground">Pick up</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Location Selection (for in-person) */}
          {redemptionType === "in_person" && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Select Pickup Location
              </Label>
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a location" />
                </SelectTrigger>
                <SelectContent>
                  {locations?.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name || loc.city} - {loc.address || loc.city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Shipping Address (if required) */}
          {prize.requires_shipping && redemptionType === "online" && (
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Shipping Address
              </Label>

              {addresses && addresses.length > 0 && !showAddAddress ? (
                <>
                  <Select value={selectedAddress} onValueChange={setSelectedAddress}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select address" />
                    </SelectTrigger>
                    <SelectContent>
                      {addresses.map((addr) => (
                        <SelectItem key={addr.id} value={addr.id}>
                          {addr.address_line1}, {addr.city}, {addr.state} {addr.zip_code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddAddress(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add New Address
                  </Button>
                </>
              ) : (
                <div className="space-y-3 p-4 border rounded-lg">
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
                    <Button
                      size="sm"
                      onClick={() => addAddressMutation.mutate()}
                      disabled={!newAddress.address_line1 || !newAddress.city || !newAddress.state || !newAddress.zip_code || addAddressMutation.isPending}
                    >
                      Save Address
                    </Button>
                    {addresses && addresses.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddAddress(false)}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Approval notice */}
          {prize.requires_approval && (
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 rounded-lg text-sm">
              <Badge variant="outline" className="bg-amber-500/20 text-amber-600 border-amber-500/50">
                Approval Required
              </Badge>
              <p className="text-muted-foreground">
                This prize requires staff approval before pickup/shipping.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => redeemMutation.mutate()}
            disabled={!canRedeem || redeemMutation.isPending}
          >
            {redeemMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Redeeming...
              </>
            ) : (
              <>
                <Ticket className="h-4 w-4 mr-2" />
                Redeem {prize.ticket_cost.toLocaleString()} Tickets
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TicketRedemptionDialog;
