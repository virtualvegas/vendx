import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Ticket, Search, Gift, Clock, CheckCircle, XCircle, Loader2, MapPin } from "lucide-react";
import { format } from "date-fns";
import { useTickets } from "@/hooks/useTickets";
import TicketPrizeCard from "./TicketPrizeCard";
import TicketRedemptionDialog from "./TicketRedemptionDialog";
import LocationPrizeInventory from "./LocationPrizeInventory";

interface TicketPrize {
  id: string;
  name: string;
  description: string | null;
  ticket_cost: number;
  category: string;
  image_url: string | null;
  requires_approval: boolean;
  requires_shipping: boolean;
  min_age: number | null;
  shipping_fee_type?: string;
  shipping_fee_amount?: number;
}

interface Redemption {
  id: string;
  tickets_spent: number;
  status: string;
  redemption_type: string;
  redemption_code: string;
  created_at: string;
  prize: {
    name: string;
    image_url: string | null;
  } | null;
  location: {
    name: string | null;
    city: string;
  } | null;
}

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-500",
  approved: "bg-blue-500/20 text-blue-500",
  completed: "bg-green-500/20 text-green-500",
  rejected: "bg-red-500/20 text-red-500",
  cancelled: "bg-muted text-muted-foreground",
};

export const TicketRedemptionPage = () => {
  const { balance, isLoading: balanceLoading, refetch: refetchBalance } = useTickets();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedPrize, setSelectedPrize] = useState<TicketPrize | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Fetch prizes
  const { data: prizes, isLoading: prizesLoading } = useQuery({
    queryKey: ["ticket-prizes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_prizes")
        .select("*")
        .eq("is_active", true)
        .order("ticket_cost");
      if (error) throw error;
      return data as TicketPrize[];
    },
  });

  // Fetch user redemptions
  const { data: redemptions, isLoading: redemptionsLoading, refetch: refetchRedemptions } = useQuery({
    queryKey: ["user-redemptions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("ticket_redemptions")
        .select(`
          id, tickets_spent, status, redemption_type, redemption_code, created_at,
          prize:ticket_prizes(name, image_url),
          location:locations(name, city)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Redemption[];
    },
  });

  // Get unique categories
  const categories = [...new Set(prizes?.map(p => p.category) || [])];

  // Filter prizes
  const filteredPrizes = prizes?.filter(prize => {
    const matchesSearch = prize.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prize.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || prize.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleRedeem = (prize: TicketPrize) => {
    setSelectedPrize(prize);
    setDialogOpen(true);
  };

  const handleRedemptionSuccess = () => {
    refetchBalance();
    refetchRedemptions();
  };

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      {/* Header with Balance */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Gift className="h-8 w-8 text-primary" />
            Prize Redemption
          </h1>
          <p className="text-muted-foreground mt-1">
            Redeem your tickets for awesome prizes
          </p>
        </div>

        <Card className="md:min-w-[200px]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Ticket className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Your Balance</p>
              <p className="text-2xl font-bold">
                {balanceLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  balance.toLocaleString()
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="prizes" className="w-full">
        <TabsList>
          <TabsTrigger value="prizes" className="flex items-center gap-2">
            <Gift className="h-4 w-4" />
            Online Prizes
          </TabsTrigger>
          <TabsTrigger value="locations" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Find Nearby
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            My Redemptions
            {redemptions && redemptions.length > 0 && (
              <Badge variant="secondary" className="ml-1">{redemptions.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="prizes" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search prizes..."
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Prize Grid */}
          {prizesLoading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-muted-foreground mt-2">Loading prizes...</p>
            </div>
          ) : filteredPrizes && filteredPrizes.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredPrizes.map((prize) => (
                <TicketPrizeCard
                  key={prize.id}
                  prize={prize}
                  userBalance={balance}
                  onRedeem={handleRedeem}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Gift className="h-12 w-12 mx-auto text-muted-foreground/30" />
              <p className="text-muted-foreground mt-2">No prizes found</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="locations" className="mt-4">
          <LocationPrizeInventory />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Redemption History</CardTitle>
            </CardHeader>
            <CardContent>
              {redemptionsLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </div>
              ) : redemptions && redemptions.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {redemptions.map((redemption) => (
                      <div
                        key={redemption.id}
                        className="flex items-center gap-4 p-4 border rounded-lg"
                      >
                        <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          {redemption.prize?.image_url ? (
                            <img
                              src={redemption.prize.image_url}
                              alt=""
                              className="h-full w-full object-cover rounded-lg"
                            />
                          ) : (
                            <Gift className="h-6 w-6 text-muted-foreground" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {redemption.prize?.name || "Unknown Prize"}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{redemption.tickets_spent.toLocaleString()} tickets</span>
                            <span>•</span>
                            <span>{format(new Date(redemption.created_at), "MMM d, yyyy")}</span>
                          </div>
                          <p className="text-xs text-muted-foreground font-mono mt-1">
                            Code: {redemption.redemption_code}
                          </p>
                        </div>

                        <Badge className={statusColors[redemption.status]}>
                          {redemption.status === "completed" && <CheckCircle className="h-3 w-3 mr-1" />}
                          {redemption.status === "rejected" && <XCircle className="h-3 w-3 mr-1" />}
                          {redemption.status.charAt(0).toUpperCase() + redemption.status.slice(1)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No redemptions yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Redemption Dialog */}
      <TicketRedemptionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        prize={selectedPrize}
        userBalance={balance}
        onSuccess={handleRedemptionSuccess}
      />
    </div>
  );
};

export default TicketRedemptionPage;
