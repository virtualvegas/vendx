import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Ticket, Plus, Search, Gift, Edit2, Trash2, CheckCircle, 
  XCircle, Clock, Package, RefreshCw, MapPin 
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Prize {
  id: string;
  name: string;
  description: string | null;
  ticket_cost: number;
  category: string;
  image_url: string | null;
  is_active: boolean;
  requires_approval: boolean;
  requires_shipping: boolean;
  min_age: number | null;
  created_at: string;
}

interface Redemption {
  id: string;
  tickets_spent: number;
  status: string;
  redemption_type: string;
  redemption_code: string;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
  approved_at: string | null;
  completed_at: string | null;
  prize: { name: string } | null;
  location: { name: string | null; city: string } | null;
  profile: { full_name: string | null; email: string } | null;
}

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-500",
  approved: "bg-blue-500/20 text-blue-500",
  completed: "bg-green-500/20 text-green-500",
  rejected: "bg-red-500/20 text-red-500",
  cancelled: "bg-muted text-muted-foreground",
};

const TicketPrizesManager = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingPrize, setEditingPrize] = useState<Prize | null>(null);
  const [prizeForm, setPrizeForm] = useState({
    name: "",
    description: "",
    ticket_cost: 100,
    category: "general",
    image_url: "",
    is_active: true,
    requires_approval: false,
    requires_shipping: false,
    min_age: null as number | null,
  });

  // Fetch prizes
  const { data: prizes, isLoading: prizesLoading, refetch: refetchPrizes } = useQuery({
    queryKey: ["admin-ticket-prizes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_prizes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Prize[];
    },
  });

  // Fetch redemptions
  const { data: redemptions, isLoading: redemptionsLoading, refetch: refetchRedemptions } = useQuery({
    queryKey: ["admin-ticket-redemptions", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("ticket_redemptions")
        .select(`
          *,
          prize:ticket_prizes(name),
          location:locations(name, city),
          profile:profiles(full_name, email)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Redemption[];
    },
  });

  // Create/update prize mutation
  const savePrizeMutation = useMutation({
    mutationFn: async () => {
      if (editingPrize) {
        const { error } = await supabase
          .from("ticket_prizes")
          .update(prizeForm)
          .eq("id", editingPrize.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ticket_prizes")
          .insert(prizeForm);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingPrize ? "Prize updated" : "Prize created");
      setIsAddDialogOpen(false);
      setEditingPrize(null);
      resetForm();
      refetchPrizes();
    },
    onError: (error) => {
      toast.error("Failed: " + error.message);
    },
  });

  // Delete prize mutation
  const deletePrizeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ticket_prizes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Prize deleted");
      refetchPrizes();
    },
    onError: (error) => {
      toast.error("Failed: " + error.message);
    },
  });

  // Update redemption status mutation
  const updateRedemptionMutation = useMutation({
    mutationFn: async ({ id, status, rejection_reason }: { id: string; status: string; rejection_reason?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const updates: Record<string, unknown> = { status };
      
      if (status === "approved") {
        updates.approved_by = user?.id;
        updates.approved_at = new Date().toISOString();
      } else if (status === "completed") {
        updates.completed_by = user?.id;
        updates.completed_at = new Date().toISOString();
        if (!updates.approved_at) {
          updates.approved_by = user?.id;
          updates.approved_at = new Date().toISOString();
        }
      } else if (status === "rejected") {
        updates.rejection_reason = rejection_reason;
      }

      const { error } = await supabase
        .from("ticket_redemptions")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Redemption updated");
      refetchRedemptions();
    },
    onError: (error) => {
      toast.error("Failed: " + error.message);
    },
  });

  const resetForm = () => {
    setPrizeForm({
      name: "",
      description: "",
      ticket_cost: 100,
      category: "general",
      image_url: "",
      is_active: true,
      requires_approval: false,
      requires_shipping: false,
      min_age: null,
    });
  };

  const openEditDialog = (prize: Prize) => {
    setEditingPrize(prize);
    setPrizeForm({
      name: prize.name,
      description: prize.description || "",
      ticket_cost: prize.ticket_cost,
      category: prize.category,
      image_url: prize.image_url || "",
      is_active: prize.is_active,
      requires_approval: prize.requires_approval,
      requires_shipping: prize.requires_shipping,
      min_age: prize.min_age,
    });
    setIsAddDialogOpen(true);
  };

  // Filter prizes
  const filteredPrizes = prizes?.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Stats
  const stats = {
    totalPrizes: prizes?.length || 0,
    activePrizes: prizes?.filter(p => p.is_active).length || 0,
    pendingRedemptions: redemptions?.filter(r => r.status === "pending").length || 0,
    completedToday: redemptions?.filter(r => 
      r.status === "completed" && 
      new Date(r.completed_at || "").toDateString() === new Date().toDateString()
    ).length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Ticket className="h-6 w-6 text-primary" />
            Ticket Prizes & Redemptions
          </h2>
          <p className="text-muted-foreground">
            Manage prizes and process ticket redemptions
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => { refetchPrizes(); refetchRedemptions(); }}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) { setEditingPrize(null); resetForm(); }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Prize
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingPrize ? "Edit Prize" : "Add New Prize"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Prize Name *</Label>
                  <Input
                    value={prizeForm.name}
                    onChange={(e) => setPrizeForm({ ...prizeForm, name: e.target.value })}
                    placeholder="e.g., Giant Teddy Bear"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={prizeForm.description}
                    onChange={(e) => setPrizeForm({ ...prizeForm, description: e.target.value })}
                    placeholder="Prize description..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Ticket Cost *</Label>
                    <Input
                      type="number"
                      value={prizeForm.ticket_cost}
                      onChange={(e) => setPrizeForm({ ...prizeForm, ticket_cost: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select
                      value={prizeForm.category}
                      onValueChange={(v) => setPrizeForm({ ...prizeForm, category: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="toys">Toys</SelectItem>
                        <SelectItem value="electronics">Electronics</SelectItem>
                        <SelectItem value="candy">Candy</SelectItem>
                        <SelectItem value="plush">Plush</SelectItem>
                        <SelectItem value="games">Games</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Image URL</Label>
                  <Input
                    value={prizeForm.image_url}
                    onChange={(e) => setPrizeForm({ ...prizeForm, image_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <Label>Active</Label>
                    <Switch
                      checked={prizeForm.is_active}
                      onCheckedChange={(v) => setPrizeForm({ ...prizeForm, is_active: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Requires Approval</Label>
                    <Switch
                      checked={prizeForm.requires_approval}
                      onCheckedChange={(v) => setPrizeForm({ ...prizeForm, requires_approval: v })}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Requires Shipping</Label>
                  <Switch
                    checked={prizeForm.requires_shipping}
                    onCheckedChange={(v) => setPrizeForm({ ...prizeForm, requires_shipping: v })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => savePrizeMutation.mutate()}
                  disabled={!prizeForm.name || prizeForm.ticket_cost <= 0 || savePrizeMutation.isPending}
                >
                  {editingPrize ? "Update" : "Create"} Prize
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Prizes</p>
            <p className="text-2xl font-bold">{stats.totalPrizes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Active</p>
            <p className="text-2xl font-bold text-green-500">{stats.activePrizes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Pending Redemptions</p>
            <p className="text-2xl font-bold text-amber-500">{stats.pendingRedemptions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Completed Today</p>
            <p className="text-2xl font-bold text-primary">{stats.completedToday}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="prizes">
        <TabsList>
          <TabsTrigger value="prizes"><Gift className="h-4 w-4 mr-2" />Prizes</TabsTrigger>
          <TabsTrigger value="redemptions">
            <Package className="h-4 w-4 mr-2" />
            Redemptions
            {stats.pendingRedemptions > 0 && (
              <Badge variant="destructive" className="ml-2">{stats.pendingRedemptions}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="prizes" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search prizes..."
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Prize</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center">Flags</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPrizes?.map((prize) => (
                      <TableRow key={prize.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                              {prize.image_url ? (
                                <img src={prize.image_url} alt="" className="h-full w-full object-cover rounded" />
                              ) : (
                                <Gift className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{prize.name}</p>
                              {prize.description && (
                                <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {prize.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono">{prize.ticket_cost.toLocaleString()}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{prize.category}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={prize.is_active ? "default" : "secondary"}>
                            {prize.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-1">
                            {prize.requires_approval && (
                              <Badge variant="outline" className="text-xs">Approval</Badge>
                            )}
                            {prize.requires_shipping && (
                              <Badge variant="outline" className="text-xs">Shipping</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => openEditDialog(prize)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                if (confirm("Delete this prize?")) {
                                  deletePrizeMutation.mutate(prize.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="redemptions" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-4">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Prize</TableHead>
                      <TableHead>Tickets</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {redemptions?.map((redemption) => (
                      <TableRow key={redemption.id}>
                        <TableCell className="text-sm">
                          {format(new Date(redemption.created_at), "MMM d, HH:mm")}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm truncate max-w-[100px] block">
                            {redemption.profile?.full_name || redemption.profile?.email?.split("@")[0] || "—"}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">
                          {redemption.prize?.name || "—"}
                        </TableCell>
                        <TableCell className="font-mono">
                          {redemption.tickets_spent.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {redemption.redemption_type === "in_person" ? (
                              <><MapPin className="h-3 w-3 mr-1" />In-Person</>
                            ) : (
                              "Online"
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {redemption.redemption_code}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={statusColors[redemption.status]}>
                            {redemption.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {redemption.status === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => updateRedemptionMutation.mutate({ id: redemption.id, status: "approved" })}
                                >
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    const reason = prompt("Rejection reason:");
                                    if (reason) {
                                      updateRedemptionMutation.mutate({ id: redemption.id, status: "rejected", rejection_reason: reason });
                                    }
                                  }}
                                >
                                  <XCircle className="h-4 w-4 text-destructive" />
                                </Button>
                              </>
                            )}
                            {redemption.status === "approved" && (
                              <Button
                                size="sm"
                                onClick={() => updateRedemptionMutation.mutate({ id: redemption.id, status: "completed" })}
                              >
                                Complete
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!redemptions?.length && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No redemptions found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TicketPrizesManager;
