import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Package, Plus, Minus, AlertTriangle, CheckCircle, Loader2, Clock, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Location {
  id: string;
  name: string | null;
  city: string;
}

interface Prize {
  id: string;
  name: string;
  ticket_cost: number;
  image_url: string | null;
}

interface Inventory {
  id: string;
  prize_id: string;
  location_id: string;
  quantity: number;
  reserved_quantity: number;
  low_stock_threshold: number | null;
  last_restocked: string | null;
  prize: Prize;
  location: Location;
}

interface Reservation {
  id: string;
  user_id: string;
  status: string;
  expires_at: string;
  created_at: string;
  prize: { name: string; ticket_cost: number };
  location: { name: string | null; city: string };
}

const PrizeInventoryManager = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("all");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState<Inventory | null>(null);
  const [adjustAmount, setAdjustAmount] = useState(0);
  const [newInventory, setNewInventory] = useState({
    prize_id: "",
    location_id: "",
    quantity: 10,
    low_stock_threshold: 5,
  });

  // Fetch inventory
  const { data: inventory, isLoading } = useQuery({
    queryKey: ["admin-prize-inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prize_inventory")
        .select(`
          id, prize_id, location_id, quantity, reserved_quantity, low_stock_threshold, last_restocked,
          prize:ticket_prizes(id, name, ticket_cost, image_url),
          location:locations(id, name, city)
        `)
        .order("quantity", { ascending: true });
      if (error) throw error;
      return data as unknown as Inventory[];
    },
  });

  // Fetch locations
  const { data: locations } = useQuery({
    queryKey: ["all-locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name, city")
        .eq("status", "active")
        .order("city");
      if (error) throw error;
      return data as Location[];
    },
  });

  // Fetch prizes
  const { data: prizes } = useQuery({
    queryKey: ["all-prizes-for-inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_prizes")
        .select("id, name, ticket_cost, image_url")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Prize[];
    },
  });

  // Fetch reservations
  const { data: reservations } = useQuery({
    queryKey: ["all-reservations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prize_reservations")
        .select(`
          id, user_id, status, expires_at, created_at,
          prize:ticket_prizes(name, ticket_cost),
          location:locations(name, city)
        `)
        .in("status", ["pending", "confirmed"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Reservation[];
    },
  });

  // Add inventory
  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("prize_inventory").insert({
        prize_id: newInventory.prize_id,
        location_id: newInventory.location_id,
        quantity: newInventory.quantity,
        low_stock_threshold: newInventory.low_stock_threshold,
        last_restocked: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-prize-inventory"] });
      toast.success("Inventory added");
      setAddDialogOpen(false);
      setNewInventory({ prize_id: "", location_id: "", quantity: 10, low_stock_threshold: 5 });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Adjust inventory
  const adjustMutation = useMutation({
    mutationFn: async () => {
      if (!selectedInventory) return;
      const newQty = Math.max(0, selectedInventory.quantity + adjustAmount);
      const { error } = await supabase
        .from("prize_inventory")
        .update({ 
          quantity: newQty,
          last_restocked: adjustAmount > 0 ? new Date().toISOString() : selectedInventory.last_restocked,
        })
        .eq("id", selectedInventory.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-prize-inventory"] });
      toast.success("Inventory updated");
      setAdjustDialogOpen(false);
      setSelectedInventory(null);
      setAdjustAmount(0);
    },
  });

  // Mark reservation as claimed
  const claimMutation = useMutation({
    mutationFn: async (reservationId: string) => {
      const { error } = await supabase
        .from("prize_reservations")
        .update({ status: "claimed", claimed_at: new Date().toISOString() })
        .eq("id", reservationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-reservations"] });
      toast.success("Reservation marked as claimed");
    },
  });

  // Filter inventory
  const filtered = inventory?.filter(inv => {
    const matchesSearch = inv.prize.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLocation = selectedLocation === "all" || inv.location_id === selectedLocation;
    return matchesSearch && matchesLocation;
  });

  const lowStockItems = filtered?.filter(inv => 
    inv.low_stock_threshold && inv.quantity <= inv.low_stock_threshold
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Prize Inventory</h2>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Stock
        </Button>
      </div>

      <Tabs defaultValue="inventory">
        <TabsList>
          <TabsTrigger value="inventory" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Inventory
          </TabsTrigger>
          <TabsTrigger value="reservations" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Reservations
            {reservations && reservations.length > 0 && (
              <Badge variant="secondary">{reservations.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-4 mt-4">
          {/* Low Stock Alert */}
          {lowStockItems && lowStockItems.length > 0 && (
            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardContent className="p-4 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <span className="text-sm">
                  <strong>{lowStockItems.length}</strong> items are low on stock
                </span>
              </CardContent>
            </Card>
          )}

          {/* Filters */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search prizes..."
                className="pl-9"
              />
            </div>
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations?.map(loc => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name || loc.city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Inventory Table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Prize</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-center">In Stock</TableHead>
                      <TableHead className="text-center">Reserved</TableHead>
                      <TableHead className="text-center">Available</TableHead>
                      <TableHead>Last Restocked</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered?.map((inv) => {
                      const available = inv.quantity - inv.reserved_quantity;
                      const isLow = inv.low_stock_threshold && inv.quantity <= inv.low_stock_threshold;
                      return (
                        <TableRow key={inv.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {inv.prize.image_url ? (
                                <img src={inv.prize.image_url} alt="" className="h-10 w-10 rounded object-cover" />
                              ) : (
                                <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                                  <Package className="h-5 w-5 text-muted-foreground" />
                                </div>
                              )}
                              <span className="font-medium">{inv.prize.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              {inv.location.name || inv.location.city}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={isLow ? "destructive" : "secondary"}>
                              {inv.quantity}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {inv.reserved_quantity > 0 ? (
                              <Badge variant="outline">{inv.reserved_quantity}</Badge>
                            ) : "-"}
                          </TableCell>
                          <TableCell className="text-center font-medium">
                            {available}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {inv.last_restocked 
                              ? format(new Date(inv.last_restocked), "MMM d, yyyy")
                              : "-"
                            }
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedInventory(inv);
                                setAdjustAmount(0);
                                setAdjustDialogOpen(true);
                              }}
                            >
                              Adjust
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reservations" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Reservations</CardTitle>
            </CardHeader>
            <CardContent>
              {reservations && reservations.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Prize</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reservations.map((res) => (
                      <TableRow key={res.id}>
                        <TableCell className="font-medium">{res.prize.name}</TableCell>
                        <TableCell>{res.location.name || res.location.city}</TableCell>
                        <TableCell>
                          <Badge variant={res.status === "confirmed" ? "default" : "secondary"}>
                            {res.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(res.expires_at), "MMM d, h:mm a")}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => claimMutation.mutate(res.id)}
                            disabled={claimMutation.isPending}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Mark Claimed
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center py-8 text-muted-foreground">No active reservations</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Inventory Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Prize Stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Prize</Label>
              <Select value={newInventory.prize_id} onValueChange={(v) => setNewInventory({ ...newInventory, prize_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select prize" /></SelectTrigger>
                <SelectContent>
                  {prizes?.map(prize => (
                    <SelectItem key={prize.id} value={prize.id}>{prize.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Select value={newInventory.location_id} onValueChange={(v) => setNewInventory({ ...newInventory, location_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>
                  {locations?.map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>{loc.name || loc.city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Initial Quantity</Label>
                <Input
                  type="number"
                  value={newInventory.quantity}
                  onChange={(e) => setNewInventory({ ...newInventory, quantity: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Low Stock Threshold</Label>
                <Input
                  type="number"
                  value={newInventory.low_stock_threshold}
                  onChange={(e) => setNewInventory({ ...newInventory, low_stock_threshold: parseInt(e.target.value) || 5 })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => addMutation.mutate()} disabled={!newInventory.prize_id || !newInventory.location_id}>
              Add Stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Inventory Dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Inventory</DialogTitle>
          </DialogHeader>
          {selectedInventory && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-medium">{selectedInventory.prize.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedInventory.location.name || selectedInventory.location.city}
                  </p>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">Current Stock</p>
                <p className="text-3xl font-bold">{selectedInventory.quantity}</p>
              </div>

              <div className="flex items-center justify-center gap-4">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setAdjustAmount(a => a - 1)}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <div className="text-center min-w-[80px]">
                  <p className={`text-2xl font-bold ${adjustAmount > 0 ? "text-green-500" : adjustAmount < 0 ? "text-red-500" : ""}`}>
                    {adjustAmount > 0 ? `+${adjustAmount}` : adjustAmount}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setAdjustAmount(a => a + 1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="text-center">
                <p className="text-sm text-muted-foreground">New Total</p>
                <p className="text-xl font-bold">
                  {Math.max(0, selectedInventory.quantity + adjustAmount)}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => adjustMutation.mutate()} disabled={adjustAmount === 0}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PrizeInventoryManager;
