import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Search, Ticket, Package, Clock, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format, addHours } from "date-fns";

interface Location {
  id: string;
  name: string | null;
  city: string;
  address: string | null;
}

interface Prize {
  id: string;
  name: string;
  description: string | null;
  ticket_cost: number;
  image_url: string | null;
  category: string;
}

interface PrizeInventory {
  id: string;
  prize_id: string;
  location_id: string;
  quantity: number;
  reserved_quantity: number;
  prize: Prize;
  location: Location;
}

interface Reservation {
  id: string;
  prize_id: string;
  location_id: string;
  status: string;
  expires_at: string;
  created_at: string;
  prize: { name: string; ticket_cost: number; image_url: string | null };
  location: { name: string | null; city: string };
}

export const LocationPrizeInventory = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCity, setSelectedCity] = useState("all");
  const [selectedPrize, setSelectedPrize] = useState<PrizeInventory | null>(null);
  const [reserveDialogOpen, setReserveDialogOpen] = useState(false);

  // Fetch locations with prize inventory
  const { data: inventory, isLoading } = useQuery({
    queryKey: ["prize-inventory-by-location"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prize_inventory")
        .select(`
          id, prize_id, location_id, quantity, reserved_quantity,
          prize:ticket_prizes(id, name, description, ticket_cost, image_url, category),
          location:locations(id, name, city, address)
        `)
        .gt("quantity", 0)
        .order("quantity", { ascending: false });
      if (error) throw error;
      return data as unknown as PrizeInventory[];
    },
  });

  // Fetch user's reservations
  const { data: myReservations } = useQuery({
    queryKey: ["my-prize-reservations"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("prize_reservations")
        .select(`
          id, prize_id, location_id, status, expires_at, created_at,
          prize:ticket_prizes(name, ticket_cost, image_url),
          location:locations(name, city)
        `)
        .eq("user_id", user.id)
        .in("status", ["pending", "confirmed"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Reservation[];
    },
  });

  // Reserve prize mutation
  const reserveMutation = useMutation({
    mutationFn: async (inv: PrizeInventory) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in to reserve prizes");

      const { error } = await supabase
        .from("prize_reservations")
        .insert({
          user_id: user.id,
          prize_id: inv.prize_id,
          location_id: inv.location_id,
          expires_at: addHours(new Date(), 24).toISOString(),
        });
      if (error) throw error;

      // Increment reserved quantity
      await supabase
        .from("prize_inventory")
        .update({ reserved_quantity: inv.reserved_quantity + 1 })
        .eq("id", inv.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prize-inventory-by-location"] });
      queryClient.invalidateQueries({ queryKey: ["my-prize-reservations"] });
      toast.success("Prize reserved! Pick up within 24 hours.");
      setReserveDialogOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Cancel reservation
  const cancelMutation = useMutation({
    mutationFn: async (reservationId: string) => {
      const { error } = await supabase
        .from("prize_reservations")
        .update({ status: "cancelled" })
        .eq("id", reservationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-prize-reservations"] });
      toast.success("Reservation cancelled");
    },
  });

  // Get unique cities
  const cities = [...new Set(inventory?.map(i => i.location.city) || [])];

  // Filter inventory
  const filtered = inventory?.filter(inv => {
    const matchesSearch = 
      inv.prize.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.location.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.location.city.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCity = selectedCity === "all" || inv.location.city === selectedCity;
    return matchesSearch && matchesCity;
  });

  // Group by location
  const groupedByLocation = filtered?.reduce((acc, inv) => {
    const locId = inv.location_id;
    if (!acc[locId]) {
      acc[locId] = { location: inv.location, prizes: [] };
    }
    acc[locId].prizes.push(inv);
    return acc;
  }, {} as Record<string, { location: Location; prizes: PrizeInventory[] }>);

  const availableCount = (inv: PrizeInventory) => inv.quantity - inv.reserved_quantity;

  return (
    <div className="space-y-6">
      {/* My Reservations */}
      {myReservations && myReservations.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              My Reservations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {myReservations.map((res) => (
                <div key={res.id} className="flex items-center justify-between p-3 bg-background rounded-lg border">
                  <div className="flex items-center gap-3">
                    {res.prize.image_url ? (
                      <img src={res.prize.image_url} alt="" className="h-10 w-10 rounded object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-sm">{res.prize.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {res.location.name || res.location.city} • Expires {format(new Date(res.expires_at), "MMM d, h:mm a")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={res.status === "confirmed" ? "default" : "secondary"}>
                      {res.status}
                    </Badge>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => cancelMutation.mutate(res.id)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search prizes or locations..."
            className="pl-9"
          />
        </div>
        <Select value={selectedCity} onValueChange={setSelectedCity}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Cities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cities</SelectItem>
            {cities.map(city => (
              <SelectItem key={city} value={city}>{city}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Locations with Prizes */}
      {isLoading ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
        </div>
      ) : groupedByLocation && Object.keys(groupedByLocation).length > 0 ? (
        <div className="space-y-4">
          {Object.values(groupedByLocation).map(({ location, prizes }) => (
            <Card key={location.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">
                    {location.name || location.city}
                  </CardTitle>
                </div>
                {location.address && (
                  <p className="text-sm text-muted-foreground">{location.address}</p>
                )}
              </CardHeader>
              <CardContent>
                <ScrollArea className="w-full">
                  <div className="flex gap-3 pb-2">
                    {prizes.map((inv) => (
                      <div 
                        key={inv.id}
                        className="flex-shrink-0 w-[200px] border rounded-lg overflow-hidden hover:border-primary/50 transition-colors"
                      >
                        <div className="aspect-square bg-muted relative">
                          {inv.prize.image_url ? (
                            <img 
                              src={inv.prize.image_url} 
                              alt={inv.prize.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="h-12 w-12 text-muted-foreground/30" />
                            </div>
                          )}
                          <Badge 
                            className="absolute top-2 right-2"
                            variant={availableCount(inv) > 3 ? "default" : "destructive"}
                          >
                            {availableCount(inv)} left
                          </Badge>
                        </div>
                        <div className="p-3 space-y-2">
                          <p className="font-medium text-sm truncate">{inv.prize.name}</p>
                          <div className="flex items-center gap-1 text-primary">
                            <Ticket className="h-4 w-4" />
                            <span className="font-bold">{inv.prize.ticket_cost.toLocaleString()}</span>
                          </div>
                          <Button 
                            size="sm" 
                            className="w-full"
                            disabled={availableCount(inv) <= 0}
                            onClick={() => {
                              setSelectedPrize(inv);
                              setReserveDialogOpen(true);
                            }}
                          >
                            Reserve
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Package className="h-12 w-12 mx-auto text-muted-foreground/30" />
          <p className="text-muted-foreground mt-2">No prizes available at nearby locations</p>
        </div>
      )}

      {/* Reserve Dialog */}
      <Dialog open={reserveDialogOpen} onOpenChange={setReserveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reserve Prize</DialogTitle>
            <DialogDescription>
              Reserve this prize for pickup within 24 hours
            </DialogDescription>
          </DialogHeader>
          {selectedPrize && (
            <div className="space-y-4">
              <div className="flex gap-4">
                {selectedPrize.prize.image_url ? (
                  <img 
                    src={selectedPrize.prize.image_url} 
                    alt="" 
                    className="h-20 w-20 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center">
                    <Package className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold">{selectedPrize.prize.name}</h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="h-3 w-3" />
                    {selectedPrize.location.name || selectedPrize.location.city}
                  </p>
                  <p className="text-primary font-bold mt-2 flex items-center gap-1">
                    <Ticket className="h-4 w-4" />
                    {selectedPrize.prize.ticket_cost.toLocaleString()} tickets
                  </p>
                </div>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-500">Reservation expires in 24 hours</p>
                  <p className="text-muted-foreground">Visit the location to redeem your tickets and claim this prize.</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReserveDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => selectedPrize && reserveMutation.mutate(selectedPrize)}
              disabled={reserveMutation.isPending}
            >
              {reserveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Confirm Reservation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LocationPrizeInventory;
