import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Eye, TrendingUp, Megaphone, Gamepad2, ShoppingCart, BarChart3, Calendar } from "lucide-react";
import { format, differenceInWeeks, differenceInDays } from "date-fns";

interface AdLocation {
  id: string;
  name: string;
  description: string | null;
  location_type: string;
  pricing_model: string;
  price: number;
  estimated_weekly_views: number;
  dimensions: string | null;
}

interface AdBooking {
  id: string;
  ad_location_id: string;
  status: string;
  start_date: string;
  end_date: string;
  total_price: number;
  ad_creative_url: string | null;
  ad_title: string | null;
  ad_description: string | null;
  admin_notes: string | null;
  created_at: string;
  ad_locations?: AdLocation | null;
}

interface PerformanceEntry {
  id: string;
  period_start: string;
  period_end: string;
  estimated_views: number;
  actual_views: number | null;
  clicks: number;
}

interface BrandedGameRequest {
  id: string;
  request_type: string;
  brand_name: string;
  game_title_id: string | null;
  desired_start_date: string | null;
  desired_end_date: string | null;
  description: string | null;
  budget_range: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  video_games?: { title: string } | null;
}

const locationTypeLabels: Record<string, string> = {
  machine_screen: "Machine Screen",
  in_game_banner: "In-Game Banner",
  in_game_interstitial: "In-Game Interstitial",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  approved: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
  active: "bg-green-500/20 text-green-400 border-green-500/30",
  completed: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-muted text-muted-foreground border-border",
  in_production: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  live: "bg-green-500/20 text-green-400 border-green-500/30",
};

const BusinessAdReach = () => {
  const { toast } = useToast();
  const [adLocations, setAdLocations] = useState<AdLocation[]>([]);
  const [myBookings, setMyBookings] = useState<AdBooking[]>([]);
  const [myGameRequests, setMyGameRequests] = useState<BrandedGameRequest[]>([]);
  const [games, setGames] = useState<{ id: string; title: string }[]>([]);
  const [showBookDialog, setShowBookDialog] = useState(false);
  const [showGameReqDialog, setShowGameReqDialog] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<AdLocation | null>(null);
  const [showPerfDialog, setShowPerfDialog] = useState(false);
  const [perfEntries, setPerfEntries] = useState<PerformanceEntry[]>([]);

  // Booking form
  const [bookForm, setBookForm] = useState({
    start_date: "", end_date: "", ad_title: "", ad_description: "", ad_creative_url: "",
  });

  // Game request form
  const [gameForm, setGameForm] = useState({
    request_type: "custom_cosmetics", brand_name: "", game_title_id: "", desired_start_date: "",
    desired_end_date: "", description: "", budget_range: "", brand_logo_url: "",
  });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [locRes, bookRes, gameReqRes, gamesRes] = await Promise.all([
      supabase.from("ad_locations").select("*").eq("is_active", true).order("name"),
      supabase.from("ad_bookings").select("*, ad_locations(*)").eq("business_owner_id", user.id).order("created_at", { ascending: false }),
      supabase.from("branded_game_requests").select("*, video_games:game_title_id(title)").eq("business_owner_id", user.id).order("created_at", { ascending: false }),
      supabase.from("video_games").select("id, title").eq("is_active", true),
    ]);
    if (locRes.data) setAdLocations(locRes.data);
    if (bookRes.data) setMyBookings(bookRes.data as any);
    if (gameReqRes.data) setMyGameRequests(gameReqRes.data as any);
    if (gamesRes.data) setGames(gamesRes.data);
  };

  const calculatePrice = (loc: AdLocation, startDate: string, endDate: string) => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (loc.pricing_model === "weekly") {
      const weeks = Math.max(1, Math.ceil(differenceInDays(end, start) / 7));
      return weeks * Number(loc.price);
    }
    const months = Math.max(1, Math.ceil(differenceInDays(end, start) / 30));
    return months * Number(loc.price);
  };

  const submitBooking = async () => {
    if (!selectedLocation) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const totalPrice = calculatePrice(selectedLocation, bookForm.start_date, bookForm.end_date);

    try {
      const { data, error } = await supabase.functions.invoke("adreach-checkout", {
        body: {
          ad_location_id: selectedLocation.id,
          start_date: bookForm.start_date,
          end_date: bookForm.end_date,
          total_price: totalPrice,
          ad_title: bookForm.ad_title || null,
          ad_description: bookForm.ad_description || null,
          ad_creative_url: bookForm.ad_creative_url || null,
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast({ title: "Error", description: "Could not create checkout session", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Payment failed", variant: "destructive" });
    }
  };

  const submitGameRequest = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("branded_game_requests").insert({
      business_owner_id: user.id,
      request_type: gameForm.request_type,
      brand_name: gameForm.brand_name,
      game_title_id: gameForm.game_title_id || null,
      desired_start_date: gameForm.desired_start_date || null,
      desired_end_date: gameForm.desired_end_date || null,
      description: gameForm.description || null,
      budget_range: gameForm.budget_range || null,
      brand_logo_url: gameForm.brand_logo_url || null,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Custom ad request submitted!" });
    setShowGameReqDialog(false);
    setGameForm({ request_type: "custom_cosmetics", brand_name: "", game_title_id: "", desired_start_date: "", desired_end_date: "", description: "", budget_range: "", brand_logo_url: "" });
    fetchAll();
  };

  const viewPerformance = async (booking: AdBooking) => {
    const { data } = await supabase.from("ad_performance").select("*").eq("ad_booking_id", booking.id).order("period_start", { ascending: false });
    setPerfEntries(data || []);
    setShowPerfDialog(true);
  };

  const totalSpent = myBookings.filter(b => ["approved", "active", "completed"].includes(b.status)).reduce((s, b) => s + Number(b.total_price), 0);

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Megaphone className="w-6 h-6" /> VendX AdReach</h1>
          <p className="text-muted-foreground text-sm">Advertise on VendX machines and games</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showGameReqDialog} onOpenChange={setShowGameReqDialog}>
            <DialogTrigger asChild>
              <Button variant="outline"><Gamepad2 className="w-4 h-4 mr-2" />Custom Ad Request</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Custom Game Ad Request</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div><Label>Request Type</Label>
                  <Select value={gameForm.request_type} onValueChange={v => setGameForm(p => ({ ...p, request_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom_cosmetics">Custom Cosmetics</SelectItem>
                      <SelectItem value="collab_items">Collab Items</SelectItem>
                      <SelectItem value="custom_ad">Custom In-Game Ad</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Brand Name</Label><Input value={gameForm.brand_name} onChange={e => setGameForm(p => ({ ...p, brand_name: e.target.value }))} placeholder="Your brand name" /></div>
                <div><Label>Brand Logo URL</Label><Input value={gameForm.brand_logo_url} onChange={e => setGameForm(p => ({ ...p, brand_logo_url: e.target.value }))} placeholder="https://..." /></div>
                {gameForm.request_type !== "custom_ad" && (
                  <div><Label>VendX Interactive Game</Label>
                    <Select value={gameForm.game_title_id} onValueChange={v => setGameForm(p => ({ ...p, game_title_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select game" /></SelectTrigger>
                      <SelectContent>{games.map(g => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Start Date</Label><Input type="date" value={gameForm.desired_start_date} onChange={e => setGameForm(p => ({ ...p, desired_start_date: e.target.value }))} /></div>
                  <div><Label>End Date</Label><Input type="date" value={gameForm.desired_end_date} onChange={e => setGameForm(p => ({ ...p, desired_end_date: e.target.value }))} /></div>
                </div>
                <div><Label>Budget Range</Label>
                  <Select value={gameForm.budget_range} onValueChange={v => setGameForm(p => ({ ...p, budget_range: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select budget" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="$500-$1,000">$500 – $1,000</SelectItem>
                      <SelectItem value="$1,000-$2,500">$1,000 – $2,500</SelectItem>
                      <SelectItem value="$2,500-$5,000">$2,500 – $5,000</SelectItem>
                      <SelectItem value="$5,000+">$5,000+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Description / Requirements</Label><Textarea value={gameForm.description} onChange={e => setGameForm(p => ({ ...p, description: e.target.value }))} placeholder="Describe your custom cosmetics, collab items, or ad concept..." rows={4} /></div>
                <Button onClick={submitGameRequest} className="w-full">Submit Request</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6 flex items-center gap-4">
          <ShoppingCart className="w-8 h-8 text-primary" />
          <div><p className="text-sm text-muted-foreground">Total Ad Spend</p><p className="text-2xl font-bold">${totalSpent.toFixed(2)}</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-4">
          <Calendar className="w-8 h-8 text-blue-400" />
          <div><p className="text-sm text-muted-foreground">Active Bookings</p><p className="text-2xl font-bold">{myBookings.filter(b => b.status === "active" || b.status === "approved").length}</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-4">
          <Gamepad2 className="w-8 h-8 text-purple-400" />
          <div><p className="text-sm text-muted-foreground">Custom Ad Requests</p><p className="text-2xl font-bold">{myGameRequests.length}</p></div>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="marketplace">
        <TabsList>
          <TabsTrigger value="marketplace">Ad Marketplace</TabsTrigger>
          <TabsTrigger value="my-bookings">My Bookings ({myBookings.length})</TabsTrigger>
          <TabsTrigger value="my-games">Custom Ad Requests ({myGameRequests.length})</TabsTrigger>
        </TabsList>

        {/* MARKETPLACE */}
        <TabsContent value="marketplace" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {adLocations.map(loc => (
              <Card key={loc.id} className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{locationTypeLabels[loc.location_type]}</Badge>
                    <span className="text-lg font-bold text-primary">${Number(loc.price).toFixed(2)}<span className="text-xs text-muted-foreground">/{loc.pricing_model === "weekly" ? "wk" : "mo"}</span></span>
                  </div>
                  <CardTitle className="text-lg">{loc.name}</CardTitle>
                  {loc.description && <CardDescription>{loc.description}</CardDescription>}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1"><Eye className="w-4 h-4" /> Est. Views/wk</span>
                    <span className="font-medium">{loc.estimated_weekly_views.toLocaleString()}</span>
                  </div>
                  {loc.dimensions && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Dimensions</span>
                      <span>{loc.dimensions}</span>
                    </div>
                  )}
                  <Button className="w-full" onClick={() => { setSelectedLocation(loc); setShowBookDialog(true); }}>Book This Spot</Button>
                </CardContent>
              </Card>
            ))}
            {adLocations.length === 0 && (
              <Card className="col-span-full"><CardContent className="py-12 text-center text-muted-foreground">No ad locations available yet. Check back soon!</CardContent></Card>
            )}
          </div>
        </TabsContent>

        {/* MY BOOKINGS */}
        <TabsContent value="my-bookings" className="space-y-4">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Ad Location</TableHead><TableHead>Dates</TableHead><TableHead>Price</TableHead>
              <TableHead>Status</TableHead><TableHead>Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {myBookings.map(b => (
                <TableRow key={b.id}>
                  <TableCell>
                    <div className="font-medium">{(b as any).ad_locations?.name || "—"}</div>
                    {b.ad_title && <div className="text-xs text-muted-foreground">{b.ad_title}</div>}
                  </TableCell>
                  <TableCell className="text-sm">{format(new Date(b.start_date), "MMM d")} – {format(new Date(b.end_date), "MMM d, yyyy")}</TableCell>
                  <TableCell className="font-medium">${Number(b.total_price).toFixed(2)}</TableCell>
                  <TableCell><Badge className={statusColors[b.status]}>{b.status}</Badge></TableCell>
                  <TableCell>
                    {(b.status === "active" || b.status === "completed") && (
                      <Button size="sm" variant="ghost" onClick={() => viewPerformance(b)}><BarChart3 className="w-4 h-4 mr-1" />Stats</Button>
                    )}
                    {b.admin_notes && <p className="text-xs text-muted-foreground mt-1">Note: {b.admin_notes}</p>}
                  </TableCell>
                </TableRow>
              ))}
              {myBookings.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No bookings yet — browse the marketplace to get started!</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TabsContent>

        {/* MY GAME REQUESTS */}
        <TabsContent value="my-games" className="space-y-4">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Brand</TableHead><TableHead>Type</TableHead><TableHead>Game</TableHead>
              <TableHead>Dates</TableHead><TableHead>Budget</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {myGameRequests.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.brand_name}</TableCell>
                  <TableCell><Badge variant="outline">{r.request_type === "custom_cosmetics" ? "Custom Cosmetics" : r.request_type === "collab_items" ? "Collab Items" : r.request_type === "custom_ad" ? "Custom Ad" : r.request_type === "reskin" ? "Reskin" : "Custom"}</Badge></TableCell>
                  <TableCell>{(r as any).video_games?.title || "—"}</TableCell>
                  <TableCell className="text-sm">
                    {r.desired_start_date ? format(new Date(r.desired_start_date), "MMM d") : "—"}
                    {r.desired_end_date ? ` – ${format(new Date(r.desired_end_date), "MMM d")}` : ""}
                  </TableCell>
                  <TableCell>{r.budget_range || "—"}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[r.status]}>{r.status}</Badge>
                    {r.admin_notes && <p className="text-xs text-muted-foreground mt-1">{r.admin_notes}</p>}
                  </TableCell>
                </TableRow>
              ))}
              {myGameRequests.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No custom ad requests yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>

      {/* Book Ad Dialog */}
      <Dialog open={showBookDialog} onOpenChange={v => { setShowBookDialog(v); if (!v) setSelectedLocation(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Book Ad — {selectedLocation?.name}</DialogTitle>
          </DialogHeader>
          {selectedLocation && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between"><span>Type:</span><span>{locationTypeLabels[selectedLocation.location_type]}</span></div>
                <div className="flex justify-between"><span>Price:</span><span>${Number(selectedLocation.price).toFixed(2)}/{selectedLocation.pricing_model === "weekly" ? "week" : "month"}</span></div>
                <div className="flex justify-between"><span>Est. Views/wk:</span><span>{selectedLocation.estimated_weekly_views.toLocaleString()}</span></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Start Date</Label><Input type="date" value={bookForm.start_date} onChange={e => setBookForm(p => ({ ...p, start_date: e.target.value }))} /></div>
                <div><Label>End Date</Label><Input type="date" value={bookForm.end_date} onChange={e => setBookForm(p => ({ ...p, end_date: e.target.value }))} /></div>
              </div>
              {bookForm.start_date && bookForm.end_date && (
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-center">
                  <span className="text-sm text-muted-foreground">Total Price: </span>
                  <span className="text-xl font-bold text-primary">${calculatePrice(selectedLocation, bookForm.start_date, bookForm.end_date).toFixed(2)}</span>
                </div>
              )}
              <div><Label>Ad Title</Label><Input value={bookForm.ad_title} onChange={e => setBookForm(p => ({ ...p, ad_title: e.target.value }))} placeholder="Your ad campaign title" /></div>
              <div><Label>Ad Description</Label><Textarea value={bookForm.ad_description} onChange={e => setBookForm(p => ({ ...p, ad_description: e.target.value }))} placeholder="Describe your ad..." /></div>
              <div><Label>Creative URL (image/video link)</Label><Input value={bookForm.ad_creative_url} onChange={e => setBookForm(p => ({ ...p, ad_creative_url: e.target.value }))} placeholder="https://..." /></div>
              <Button onClick={submitBooking} className="w-full">Pay & Submit for Approval</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Performance Dialog */}
      <Dialog open={showPerfDialog} onOpenChange={setShowPerfDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Ad Performance</DialogTitle></DialogHeader>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Period</TableHead><TableHead>Views</TableHead><TableHead>Clicks</TableHead><TableHead>CTR</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {perfEntries.map(p => {
                const views = p.actual_views ?? p.estimated_views;
                const ctr = views > 0 ? ((p.clicks / views) * 100).toFixed(2) : "0.00";
                return (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">{format(new Date(p.period_start), "MMM d")} – {format(new Date(p.period_end), "MMM d")}</TableCell>
                    <TableCell>{views.toLocaleString()} {p.actual_views === null && <span className="text-xs text-muted-foreground">(est.)</span>}</TableCell>
                    <TableCell>{p.clicks}</TableCell>
                    <TableCell>{ctr}%</TableCell>
                  </TableRow>
                );
              })}
              {perfEntries.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">No performance data available yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BusinessAdReach;
