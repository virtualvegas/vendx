import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { 
  Trophy, Plus, CheckCircle, XCircle, Search, Filter, 
  Download, RefreshCw, Image, MapPin, Gamepad2, User 
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import PrizeWinsFeed from "@/components/arcade/PrizeWinsFeed";

interface PrizeWin {
  id: string;
  user_id: string | null;
  machine_id: string | null;
  location_id: string | null;
  prize_name: string;
  prize_value: number;
  prize_type: string;
  photo_url: string | null;
  verified: boolean;
  verified_at: string | null;
  notes: string | null;
  created_at: string;
  machine?: { name: string; machine_code: string } | null;
  location?: { name: string | null; city: string } | null;
  profile?: { full_name: string | null; email: string } | null;
}

const PrizeWinsManager = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterVerified, setFilterVerified] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedWin, setSelectedWin] = useState<PrizeWin | null>(null);

  // Form state for new win
  const [newWin, setNewWin] = useState({
    prize_name: "",
    prize_value: 0,
    prize_type: "standard",
    machine_id: "",
    location_id: "",
    notes: "",
    verified: true,
  });

  // Fetch all prize wins
  const { data: wins, isLoading, refetch } = useQuery({
    queryKey: ["admin-prize-wins", filterVerified, filterType],
    queryFn: async () => {
      let query = supabase
        .from("prize_wins")
        .select(`
          *,
          machine:vendx_machines(name, machine_code),
          location:locations(name, city),
          profile:profiles(full_name, email)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (filterVerified === "verified") {
        query = query.eq("verified", true);
      } else if (filterVerified === "unverified") {
        query = query.eq("verified", false);
      }

      if (filterType !== "all") {
        query = query.eq("prize_type", filterType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as PrizeWin[];
    },
  });

  // Fetch machines for dropdown
  const { data: machines } = useQuery({
    queryKey: ["arcade-machines-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendx_machines")
        .select("id, name, machine_code, location_id")
        .in("machine_type", ["arcade", "claw"])
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch locations for dropdown
  const { data: locations } = useQuery({
    queryKey: ["locations-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name, city")
        .eq("status", "active")
        .order("city");
      if (error) throw error;
      return data;
    },
  });

  // Add prize win mutation
  const addWinMutation = useMutation({
    mutationFn: async (win: typeof newWin) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("prize_wins").insert({
        ...win,
        machine_id: win.machine_id || null,
        location_id: win.location_id || null,
        verified_by: win.verified ? user?.id : null,
        verified_at: win.verified ? new Date().toISOString() : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Prize win recorded");
      setIsAddDialogOpen(false);
      setNewWin({
        prize_name: "",
        prize_value: 0,
        prize_type: "standard",
        machine_id: "",
        location_id: "",
        notes: "",
        verified: true,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-prize-wins"] });
    },
    onError: (error) => {
      toast.error("Failed to record win: " + error.message);
    },
  });

  // Verify/unverify mutation
  const verifyMutation = useMutation({
    mutationFn: async ({ id, verified }: { id: string; verified: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("prize_wins")
        .update({
          verified,
          verified_by: verified ? user?.id : null,
          verified_at: verified ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Win verification updated");
      queryClient.invalidateQueries({ queryKey: ["admin-prize-wins"] });
    },
    onError: (error) => {
      toast.error("Failed to update: " + error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("prize_wins").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Win deleted");
      setSelectedWin(null);
      queryClient.invalidateQueries({ queryKey: ["admin-prize-wins"] });
    },
    onError: (error) => {
      toast.error("Failed to delete: " + error.message);
    },
  });

  // Filter wins by search term
  const filteredWins = wins?.filter(win => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      win.prize_name.toLowerCase().includes(term) ||
      win.profile?.full_name?.toLowerCase().includes(term) ||
      win.profile?.email?.toLowerCase().includes(term) ||
      win.machine?.name?.toLowerCase().includes(term) ||
      win.location?.city?.toLowerCase().includes(term)
    );
  });

  // Export to CSV
  const exportToCSV = () => {
    if (!filteredWins) return;
    
    let csv = "Date,Prize,Type,Value,User,Machine,Location,Verified\n";
    filteredWins.forEach(win => {
      csv += `"${format(new Date(win.created_at), "yyyy-MM-dd HH:mm")}","${win.prize_name}","${win.prize_type}",${win.prize_value},"${win.profile?.full_name || win.profile?.email || ""}","${win.machine?.name || ""}","${win.location?.name || win.location?.city || ""}",${win.verified}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `prize-wins-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    toast.success("Exported to CSV");
  };

  // Stats
  const stats = {
    total: wins?.length || 0,
    verified: wins?.filter(w => w.verified).length || 0,
    unverified: wins?.filter(w => !w.verified).length || 0,
    jackpots: wins?.filter(w => w.prize_type === "jackpot").length || 0,
    totalValue: wins?.reduce((sum, w) => sum + (w.prize_value || 0), 0) || 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            Prize Wins Manager
          </h2>
          <p className="text-muted-foreground">
            Track and verify arcade prize wins
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Record Win
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record Prize Win</DialogTitle>
                <DialogDescription>
                  Manually record a prize win for tracking
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Prize Name *</Label>
                  <Input
                    value={newWin.prize_name}
                    onChange={(e) => setNewWin({ ...newWin, prize_name: e.target.value })}
                    placeholder="e.g., Giant Teddy Bear"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Prize Type</Label>
                    <Select
                      value={newWin.prize_type}
                      onValueChange={(v) => setNewWin({ ...newWin, prize_type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="bonus">Bonus</SelectItem>
                        <SelectItem value="jackpot">Jackpot</SelectItem>
                        <SelectItem value="grand">Grand</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Ticket Value</Label>
                    <Input
                      type="number"
                      value={newWin.prize_value}
                      onChange={(e) => setNewWin({ ...newWin, prize_value: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Machine</Label>
                  <Select
                    value={newWin.machine_id}
                    onValueChange={(v) => {
                      const machine = machines?.find(m => m.id === v);
                      setNewWin({ 
                        ...newWin, 
                        machine_id: v,
                        location_id: machine?.location_id || newWin.location_id
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select machine" />
                    </SelectTrigger>
                    <SelectContent>
                      {machines?.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name || m.machine_code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Location</Label>
                  <Select
                    value={newWin.location_id}
                    onValueChange={(v) => setNewWin({ ...newWin, location_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations?.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name || l.city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={newWin.notes}
                    onChange={(e) => setNewWin({ ...newWin, notes: e.target.value })}
                    placeholder="Optional notes..."
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Mark as Verified</Label>
                  <Switch
                    checked={newWin.verified}
                    onCheckedChange={(v) => setNewWin({ ...newWin, verified: v })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => addWinMutation.mutate(newWin)}
                  disabled={!newWin.prize_name || addWinMutation.isPending}
                >
                  Record Win
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Wins</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Verified</p>
            <p className="text-2xl font-bold text-green-500">{stats.verified}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold text-amber-500">{stats.unverified}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Jackpots</p>
            <p className="text-2xl font-bold text-yellow-500">{stats.jackpots}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Value</p>
            <p className="text-2xl font-bold">{stats.totalValue.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Wins Table */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle>All Prize Wins</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search..."
                    className="pl-9 w-[200px]"
                  />
                </div>
                <Select value={filterVerified} onValueChange={setFilterVerified}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="unverified">Pending</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="bonus">Bonus</SelectItem>
                    <SelectItem value="jackpot">Jackpot</SelectItem>
                    <SelectItem value="grand">Grand</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : (
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Prize</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Machine</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWins?.map((win) => (
                      <TableRow key={win.id}>
                        <TableCell className="text-sm">
                          {format(new Date(win.created_at), "MMM d, HH:mm")}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{win.prize_name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {win.prize_type}
                            </Badge>
                            {win.prize_value > 0 && `${win.prize_value} tickets`}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm truncate max-w-[100px]">
                              {win.profile?.full_name || win.profile?.email?.split("@")[0] || "—"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {win.machine?.name || "—"}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {win.location?.name || win.location?.city || "—"}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {win.verified ? (
                            <Badge variant="outline" className="bg-green-500/10 text-green-500">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Verified
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-500">
                              <XCircle className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!win.verified ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => verifyMutation.mutate({ id: win.id, verified: true })}
                              >
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => verifyMutation.mutate({ id: win.id, verified: false })}
                              >
                                <XCircle className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            )}
                            {win.photo_url && (
                              <Button size="sm" variant="ghost" asChild>
                                <a href={win.photo_url} target="_blank" rel="noopener noreferrer">
                                  <Image className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredWins?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No prize wins found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Live Feed Preview */}
        <div className="space-y-4">
          <PrizeWinsFeed limit={5} compact />
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Public Feed Preview</CardTitle>
              <CardDescription>
                This is what users see on the arcade page
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PrizeWinsManager;
