import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Eye, TrendingUp, DollarSign, Monitor, Gamepad2, CheckCircle, XCircle, BarChart3 } from "lucide-react";
import { format } from "date-fns";

interface AdLocation {
  id: string;
  name: string;
  description: string | null;
  location_type: string;
  machine_id: string | null;
  game_id: string | null;
  pricing_model: string;
  price: number;
  estimated_weekly_views: number;
  dimensions: string | null;
  max_file_size_mb: number | null;
  is_active: boolean;
  created_at: string;
}

interface AdBooking {
  id: string;
  ad_location_id: string;
  business_owner_id: string;
  status: string;
  start_date: string;
  end_date: string;
  total_price: number;
  ad_creative_url: string | null;
  ad_title: string | null;
  ad_description: string | null;
  admin_notes: string | null;
  created_at: string;
  ad_locations?: { name: string; location_type: string } | null;
  profiles?: { full_name: string; email: string } | null;
}

interface BrandedGameRequest {
  id: string;
  business_owner_id: string;
  request_type: string;
  brand_name: string;
  brand_logo_url: string | null;
  game_title_id: string | null;
  desired_start_date: string | null;
  desired_end_date: string | null;
  description: string | null;
  budget_range: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  profiles?: { full_name: string; email: string } | null;
  video_games?: { title: string } | null;
}

interface PerformanceEntry {
  id: string;
  ad_booking_id: string;
  period_start: string;
  period_end: string;
  estimated_views: number;
  actual_views: number | null;
  clicks: number;
  notes: string | null;
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

const AdReachManager = () => {
  const { toast } = useToast();
  const [adLocations, setAdLocations] = useState<AdLocation[]>([]);
  const [bookings, setBookings] = useState<AdBooking[]>([]);
  const [gameRequests, setGameRequests] = useState<BrandedGameRequest[]>([]);
  const [machines, setMachines] = useState<{ id: string; name: string; machine_code: string }[]>([]);
  const [games, setGames] = useState<{ id: string; title: string }[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPerformanceDialog, setShowPerformanceDialog] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<AdBooking | null>(null);
  const [performanceEntries, setPerformanceEntries] = useState<PerformanceEntry[]>([]);

  // New ad location form
  const [newLocation, setNewLocation] = useState({
    name: "", description: "", location_type: "machine_screen",
    machine_id: "", game_id: "", pricing_model: "monthly",
    price: "", estimated_weekly_views: "", dimensions: "",
  });

  // Performance entry form
  const [newPerf, setNewPerf] = useState({
    period_start: "", period_end: "", estimated_views: "", actual_views: "", clicks: "", notes: "",
  });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const [locRes, bookRes, gameReqRes, machRes, gamesRes] = await Promise.all([
      supabase.from("ad_locations").select("*").order("created_at", { ascending: false }),
      supabase.from("ad_bookings").select("*, ad_locations(name, location_type), profiles:business_owner_id(full_name, email)").order("created_at", { ascending: false }),
      supabase.from("branded_game_requests").select("*, video_games:game_title_id(title)").order("created_at", { ascending: false }),
      supabase.from("vendx_machines").select("id, name, machine_code").eq("status", "active"),
      supabase.from("video_games").select("id, title").eq("is_active", true),
    ]);
    if (locRes.data) setAdLocations(locRes.data);
    if (bookRes.data) setBookings(bookRes.data as any);
    if (gameReqRes.data) setGameRequests(gameReqRes.data as any);
    if (machRes.data) setMachines(machRes.data);
    if (gamesRes.data) setGames(gamesRes.data);
  };

  const createAdLocation = async () => {
    const { error } = await supabase.from("ad_locations").insert({
      name: newLocation.name,
      description: newLocation.description || null,
      location_type: newLocation.location_type,
      machine_id: newLocation.machine_id || null,
      game_id: newLocation.game_id || null,
      pricing_model: newLocation.pricing_model,
      price: parseFloat(newLocation.price) || 0,
      estimated_weekly_views: parseInt(newLocation.estimated_weekly_views) || 0,
      dimensions: newLocation.dimensions || null,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Ad location created" });
    setShowCreateDialog(false);
    setNewLocation({ name: "", description: "", location_type: "machine_screen", machine_id: "", game_id: "", pricing_model: "monthly", price: "", estimated_weekly_views: "", dimensions: "" });
    fetchAll();
  };

  const updateBookingStatus = async (booking: AdBooking, newStatus: string, notes?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("ad_bookings").update({
      status: newStatus,
      admin_notes: notes || booking.admin_notes,
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
    }).eq("id", booking.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: `Booking ${newStatus}` });
    fetchAll();
  };

  const updateGameRequestStatus = async (req: BrandedGameRequest, newStatus: string, notes?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("branded_game_requests").update({
      status: newStatus,
      admin_notes: notes || req.admin_notes,
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
    }).eq("id", req.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: `Request ${newStatus}` });
    fetchAll();
  };

  const openPerformance = async (booking: AdBooking) => {
    setSelectedBooking(booking);
    const { data } = await supabase.from("ad_performance").select("*").eq("ad_booking_id", booking.id).order("period_start", { ascending: false });
    setPerformanceEntries(data || []);
    setShowPerformanceDialog(true);
  };

  const addPerformanceEntry = async () => {
    if (!selectedBooking) return;
    const { error } = await supabase.from("ad_performance").insert({
      ad_booking_id: selectedBooking.id,
      period_start: newPerf.period_start,
      period_end: newPerf.period_end,
      estimated_views: parseInt(newPerf.estimated_views) || 0,
      actual_views: newPerf.actual_views ? parseInt(newPerf.actual_views) : null,
      clicks: parseInt(newPerf.clicks) || 0,
      notes: newPerf.notes || null,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Performance data added" });
    setNewPerf({ period_start: "", period_end: "", estimated_views: "", actual_views: "", clicks: "", notes: "" });
    openPerformance(selectedBooking);
  };

  const toggleAdLocation = async (loc: AdLocation) => {
    await supabase.from("ad_locations").update({ is_active: !loc.is_active }).eq("id", loc.id);
    fetchAll();
  };

  // Stats
  const totalRevenue = bookings.filter(b => ["approved", "active", "completed"].includes(b.status)).reduce((s, b) => s + Number(b.total_price), 0);
  const activeBookings = bookings.filter(b => b.status === "active" || b.status === "approved").length;
  const pendingBookings = bookings.filter(b => b.status === "pending").length;
  const pendingGameReqs = gameRequests.filter(r => r.status === "pending").length;

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">VendX AdReach</h1>
          <p className="text-muted-foreground text-sm">Manage ad locations, bookings, and custom game ad requests</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6 flex items-center gap-4">
          <DollarSign className="w-8 h-8 text-green-400" />
          <div><p className="text-sm text-muted-foreground">Total Ad Revenue</p><p className="text-2xl font-bold">${totalRevenue.toFixed(2)}</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-4">
          <Eye className="w-8 h-8 text-blue-400" />
          <div><p className="text-sm text-muted-foreground">Active Bookings</p><p className="text-2xl font-bold">{activeBookings}</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-4">
          <TrendingUp className="w-8 h-8 text-yellow-400" />
          <div><p className="text-sm text-muted-foreground">Pending Approvals</p><p className="text-2xl font-bold">{pendingBookings}</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-4">
          <Gamepad2 className="w-8 h-8 text-purple-400" />
          <div><p className="text-sm text-muted-foreground">Custom Ad Requests</p><p className="text-2xl font-bold">{pendingGameReqs}</p></div>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="locations">
        <TabsList>
          <TabsTrigger value="locations">Ad Locations</TabsTrigger>
          <TabsTrigger value="bookings">Bookings {pendingBookings > 0 && <Badge variant="destructive" className="ml-2 text-xs">{pendingBookings}</Badge>}</TabsTrigger>
          <TabsTrigger value="game-requests">Custom Ad Requests {pendingGameReqs > 0 && <Badge variant="destructive" className="ml-2 text-xs">{pendingGameReqs}</Badge>}</TabsTrigger>
        </TabsList>

        {/* AD LOCATIONS TAB */}
        <TabsContent value="locations" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" />Create Ad Location</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Create Ad Location</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Name</Label><Input value={newLocation.name} onChange={e => setNewLocation(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Main Screen - Mall Location" /></div>
                  <div><Label>Description</Label><Textarea value={newLocation.description} onChange={e => setNewLocation(p => ({ ...p, description: e.target.value }))} /></div>
                  <div><Label>Ad Type</Label>
                    <Select value={newLocation.location_type} onValueChange={v => setNewLocation(p => ({ ...p, location_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="machine_screen">Machine Screen</SelectItem>
                        <SelectItem value="in_game_banner">In-Game Banner</SelectItem>
                        <SelectItem value="in_game_interstitial">In-Game Interstitial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {newLocation.location_type === "machine_screen" && (
                    <div><Label>Machine</Label>
                      <Select value={newLocation.machine_id} onValueChange={v => setNewLocation(p => ({ ...p, machine_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select machine" /></SelectTrigger>
                        <SelectContent>{machines.map(m => <SelectItem key={m.id} value={m.id}>{m.name} ({m.machine_code})</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}
                  {(newLocation.location_type === "in_game_banner" || newLocation.location_type === "in_game_interstitial") && (
                    <div><Label>VendX Interactive Game</Label>
                      <Select value={newLocation.game_id} onValueChange={v => setNewLocation(p => ({ ...p, game_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select game" /></SelectTrigger>
                        <SelectContent>{games.map(g => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Pricing Model</Label>
                      <Select value={newLocation.pricing_model} onValueChange={v => setNewLocation(p => ({ ...p, pricing_model: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Price ($)</Label><Input type="number" value={newLocation.price} onChange={e => setNewLocation(p => ({ ...p, price: e.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Est. Weekly Views</Label><Input type="number" value={newLocation.estimated_weekly_views} onChange={e => setNewLocation(p => ({ ...p, estimated_weekly_views: e.target.value }))} /></div>
                    <div><Label>Dimensions</Label><Input value={newLocation.dimensions} onChange={e => setNewLocation(p => ({ ...p, dimensions: e.target.value }))} placeholder="e.g. 1920x1080" /></div>
                  </div>
                  <Button onClick={createAdLocation} className="w-full">Create Location</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Pricing</TableHead>
              <TableHead>Est. Views/wk</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {adLocations.map(loc => (
                <TableRow key={loc.id}>
                  <TableCell className="font-medium">{loc.name}</TableCell>
                  <TableCell><Badge variant="outline">{locationTypeLabels[loc.location_type]}</Badge></TableCell>
                  <TableCell>${Number(loc.price).toFixed(2)}/{loc.pricing_model === "weekly" ? "wk" : "mo"}</TableCell>
                  <TableCell>{loc.estimated_weekly_views.toLocaleString()}</TableCell>
                  <TableCell><Badge variant={loc.is_active ? "default" : "secondary"}>{loc.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => toggleAdLocation(loc)}>
                      {loc.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {adLocations.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No ad locations created yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TabsContent>

        {/* BOOKINGS TAB */}
        <TabsContent value="bookings" className="space-y-4">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Business Owner</TableHead><TableHead>Ad Location</TableHead><TableHead>Dates</TableHead>
              <TableHead>Price</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {bookings.map(b => (
                <TableRow key={b.id}>
                  <TableCell>
                    <div>{(b as any).profiles?.full_name || "Unknown"}</div>
                    <div className="text-xs text-muted-foreground">{(b as any).profiles?.email}</div>
                  </TableCell>
                  <TableCell>
                    <div>{(b as any).ad_locations?.name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{locationTypeLabels[(b as any).ad_locations?.location_type] || ""}</div>
                  </TableCell>
                  <TableCell className="text-sm">{format(new Date(b.start_date), "MMM d")} – {format(new Date(b.end_date), "MMM d, yyyy")}</TableCell>
                  <TableCell className="font-medium">${Number(b.total_price).toFixed(2)}</TableCell>
                  <TableCell><Badge className={statusColors[b.status]}>{b.status}</Badge></TableCell>
                  <TableCell className="space-x-1">
                    {b.status === "pending" && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => updateBookingStatus(b, "approved")}><CheckCircle className="w-4 h-4 text-green-400" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => updateBookingStatus(b, "rejected")}><XCircle className="w-4 h-4 text-red-400" /></Button>
                      </>
                    )}
                    {b.status === "approved" && (
                      <Button size="sm" variant="outline" onClick={() => updateBookingStatus(b, "active")}>Set Active</Button>
                    )}
                    {b.status === "active" && (
                      <Button size="sm" variant="outline" onClick={() => updateBookingStatus(b, "completed")}>Complete</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => openPerformance(b)}><BarChart3 className="w-4 h-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {bookings.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No bookings yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TabsContent>

        {/* CUSTOM AD REQUESTS TAB */}
        <TabsContent value="game-requests" className="space-y-4">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Business Owner</TableHead><TableHead>Brand</TableHead><TableHead>Type</TableHead>
              <TableHead>Game</TableHead><TableHead>Dates</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {gameRequests.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{(r as any).profiles?.full_name || "Unknown"}</TableCell>
                  <TableCell className="font-medium">{r.brand_name}</TableCell>
                  <TableCell><Badge variant="outline">{r.request_type === "custom_cosmetics" ? "Custom Cosmetics" : r.request_type === "collab_items" ? "Collab Items" : r.request_type === "custom_ad" ? "Custom Ad" : r.request_type === "reskin" ? "Reskin" : "Custom"}</Badge></TableCell>
                  <TableCell>{(r as any).video_games?.title || "—"}</TableCell>
                  <TableCell className="text-sm">
                    {r.desired_start_date ? format(new Date(r.desired_start_date), "MMM d") : "—"}
                    {r.desired_end_date ? ` – ${format(new Date(r.desired_end_date), "MMM d")}` : ""}
                  </TableCell>
                  <TableCell><Badge className={statusColors[r.status]}>{r.status}</Badge></TableCell>
                  <TableCell className="space-x-1">
                    {r.status === "pending" && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => updateGameRequestStatus(r, "approved")}><CheckCircle className="w-4 h-4 text-green-400" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => updateGameRequestStatus(r, "rejected")}><XCircle className="w-4 h-4 text-red-400" /></Button>
                      </>
                    )}
                    {r.status === "approved" && (
                      <Select onValueChange={v => updateGameRequestStatus(r, v)}>
                        <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Update..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="in_production">In Production</SelectItem>
                          <SelectItem value="live">Live</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    {(r.status === "in_production") && (
                      <Button size="sm" variant="outline" onClick={() => updateGameRequestStatus(r, "live")}>Set Live</Button>
                    )}
                    {r.status === "live" && (
                      <Button size="sm" variant="outline" onClick={() => updateGameRequestStatus(r, "completed")}>Complete</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {gameRequests.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No custom ad requests</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>

      {/* Performance Dialog */}
      <Dialog open={showPerformanceDialog} onOpenChange={setShowPerformanceDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Ad Performance — {(selectedBooking as any)?.ad_locations?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Add Performance Entry */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Add Performance Data</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Period Start</Label><Input type="date" value={newPerf.period_start} onChange={e => setNewPerf(p => ({ ...p, period_start: e.target.value }))} /></div>
                  <div><Label>Period End</Label><Input type="date" value={newPerf.period_end} onChange={e => setNewPerf(p => ({ ...p, period_end: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Est. Views</Label><Input type="number" value={newPerf.estimated_views} onChange={e => setNewPerf(p => ({ ...p, estimated_views: e.target.value }))} /></div>
                  <div><Label>Actual Views</Label><Input type="number" value={newPerf.actual_views} onChange={e => setNewPerf(p => ({ ...p, actual_views: e.target.value }))} placeholder="Optional" /></div>
                  <div><Label>Clicks</Label><Input type="number" value={newPerf.clicks} onChange={e => setNewPerf(p => ({ ...p, clicks: e.target.value }))} /></div>
                </div>
                <div><Label>Notes</Label><Input value={newPerf.notes} onChange={e => setNewPerf(p => ({ ...p, notes: e.target.value }))} /></div>
                <Button onClick={addPerformanceEntry} size="sm">Add Entry</Button>
              </CardContent>
            </Card>

            {/* Performance Table */}
            <Table>
              <TableHeader><TableRow>
                <TableHead>Period</TableHead><TableHead>Est. Views</TableHead><TableHead>Actual Views</TableHead><TableHead>Clicks</TableHead><TableHead>CTR</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {performanceEntries.map(p => {
                  const views = p.actual_views ?? p.estimated_views;
                  const ctr = views > 0 ? ((p.clicks / views) * 100).toFixed(2) : "0.00";
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm">{format(new Date(p.period_start), "MMM d")} – {format(new Date(p.period_end), "MMM d")}</TableCell>
                      <TableCell>{p.estimated_views.toLocaleString()}</TableCell>
                      <TableCell>{p.actual_views?.toLocaleString() ?? "—"}</TableCell>
                      <TableCell>{p.clicks}</TableCell>
                      <TableCell>{ctr}%</TableCell>
                    </TableRow>
                  );
                })}
                {performanceEntries.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">No performance data yet</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdReachManager;
