import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Wallet, Plus, Search, RefreshCw, DollarSign, Users, 
  Calendar, Download, Eye, CheckCircle, XCircle 
} from "lucide-react";

const PayoutsManager = () => {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedPayout, setSelectedPayout] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all payouts
  const { data: payouts, isLoading } = useQuery({
    queryKey: ["admin-payouts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payouts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      
      // Fetch profile info for each payout
      const payoutsWithOwners = await Promise.all(
        (data || []).map(async (payout) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .eq("id", payout.business_owner_id)
            .single();
          return { ...payout, business_owner: profile };
        })
      );
      
      return payoutsWithOwners;
    },
  });

  // Fetch business owners (users with business_owner role)
  const { data: businessOwners } = useQuery({
    queryKey: ["business-owners"],
    queryFn: async () => {
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "business_owner");
      if (error) throw error;
      
      if (!roles || roles.length === 0) return [];
      
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", roles.map(r => r.user_id));
      
      return profiles || [];
    },
  });

  // Fetch payout line items for selected payout
  const { data: payoutItems } = useQuery({
    queryKey: ["payout-items", selectedPayout?.id],
    queryFn: async () => {
      if (!selectedPayout) return [];
      const { data, error } = await supabase
        .from("payout_line_items")
        .select("*")
        .eq("payout_id", selectedPayout.id);
      if (error) throw error;
      
      // Fetch machine and location info
      const itemsWithDetails = await Promise.all(
        (data || []).map(async (item) => {
          const [machineRes, locationRes] = await Promise.all([
            supabase.from("vendx_machines").select("name, machine_code").eq("id", item.machine_id).single(),
            supabase.from("locations").select("name, city, country").eq("id", item.location_id).single()
          ]);
          return { ...item, machine: machineRes.data, location: locationRes.data };
        })
      );
      
      return itemsWithDetails;
    },
    enabled: !!selectedPayout,
  });

  // Update payout status mutation
  const updatePayoutMutation = useMutation({
    mutationFn: async ({ id, status, payment_reference }: { id: string; status: string; payment_reference?: string }) => {
      const updateData: any = { status };
      if (status === "paid") {
        updateData.paid_at = new Date().toISOString();
      }
      if (payment_reference) {
        updateData.payment_reference = payment_reference;
      }
      
      const { error } = await supabase.from("payouts").update(updateData).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-payouts"] });
      toast({ title: "Payout updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Stats
  const stats = useMemo(() => {
    if (!payouts) return { pending: 0, processing: 0, paid: 0, totalPending: 0 };
    
    return {
      pending: payouts.filter(p => p.status === "pending").length,
      processing: payouts.filter(p => p.status === "processing").length,
      paid: payouts.filter(p => p.status === "paid").length,
      totalPending: payouts
        .filter(p => p.status === "pending" || p.status === "processing")
        .reduce((sum, p) => sum + Number(p.amount), 0),
    };
  }, [payouts]);

  // Filter payouts
  const filteredPayouts = useMemo(() => {
    return (payouts || []).filter(payout => {
      const ownerName = (payout.business_owner as any)?.full_name || "";
      const ownerEmail = (payout.business_owner as any)?.email || "";
      const matchesSearch = 
        ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ownerEmail.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || payout.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [payouts, searchTerm, statusFilter]);

  const handleMarkAsPaid = (payout: any) => {
    const reference = prompt("Enter payment reference (optional):");
    updatePayoutMutation.mutate({ id: payout.id, status: "paid", payment_reference: reference || undefined });
  };

  const handleMarkAsProcessing = (payout: any) => {
    updatePayoutMutation.mutate({ id: payout.id, status: "processing" });
  };

  const openDetails = (payout: any) => {
    setSelectedPayout(payout);
    setShowDetailsDialog(true);
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="w-6 h-6 text-primary" />
          Payouts Manager
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-payouts"] })}>
            <RefreshCw className="w-4 h-4 mr-2" />Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 lg:p-6">
            <p className="text-xs lg:text-sm text-muted-foreground">Pending Payouts</p>
            <p className="text-xl lg:text-2xl font-bold text-yellow-500">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 lg:p-6">
            <p className="text-xs lg:text-sm text-muted-foreground">Processing</p>
            <p className="text-xl lg:text-2xl font-bold text-blue-500">{stats.processing}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 lg:p-6">
            <p className="text-xs lg:text-sm text-muted-foreground">Completed</p>
            <p className="text-xl lg:text-2xl font-bold text-green-500">{stats.paid}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5">
          <CardContent className="p-4 lg:p-6">
            <p className="text-xs lg:text-sm text-muted-foreground">Total Pending</p>
            <p className="text-xl lg:text-2xl font-bold text-yellow-500">${stats.totalPending.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by business owner..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Payouts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payouts ({filteredPayouts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business Owner</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Gross Revenue</TableHead>
                  <TableHead>VendX Share</TableHead>
                  <TableHead>Owner Payout</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayouts.map((payout) => {
                  const owner = payout.business_owner as any;
                  return (
                    <TableRow key={payout.id}>
                      <TableCell>
                        <p className="font-medium">{owner?.full_name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{owner?.email}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">
                          {new Date(payout.period_start).toLocaleDateString()} - {new Date(payout.period_end).toLocaleDateString()}
                        </p>
                      </TableCell>
                      <TableCell>${Number(payout.gross_revenue).toLocaleString()}</TableCell>
                      <TableCell>${Number(payout.vendx_share).toLocaleString()}</TableCell>
                      <TableCell className="font-bold text-green-500">
                        ${Number(payout.amount).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          payout.status === "paid" ? "default" :
                          payout.status === "pending" ? "secondary" :
                          payout.status === "processing" ? "outline" : "destructive"
                        }>
                          {payout.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openDetails(payout)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          {payout.status === "pending" && (
                            <Button size="icon" variant="ghost" onClick={() => handleMarkAsProcessing(payout)}>
                              <Calendar className="w-4 h-4 text-blue-500" />
                            </Button>
                          )}
                          {(payout.status === "pending" || payout.status === "processing") && (
                            <Button size="icon" variant="ghost" onClick={() => handleMarkAsPaid(payout)}>
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Payout Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payout Details</DialogTitle>
          </DialogHeader>
          {selectedPayout && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Business Owner</p>
                  <p className="font-medium">{(selectedPayout.business_owner as any)?.full_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Period</p>
                  <p className="font-medium">
                    {new Date(selectedPayout.period_start).toLocaleDateString()} - {new Date(selectedPayout.period_end).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Payout Amount</p>
                  <p className="font-bold text-green-500">${Number(selectedPayout.amount).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge>{selectedPayout.status}</Badge>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Machine Breakdown</h3>
                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Machine</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Gross Revenue</TableHead>
                        <TableHead>VendX %</TableHead>
                        <TableHead>VendX Share</TableHead>
                        <TableHead>Owner Share</TableHead>
                        <TableHead>Transactions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payoutItems?.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <p className="font-medium">{item.machine?.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{item.machine?.machine_code}</p>
                          </TableCell>
                          <TableCell>{item.location?.name || `${item.location?.city}, ${item.location?.country}`}</TableCell>
                          <TableCell>${Number(item.gross_revenue).toLocaleString()}</TableCell>
                          <TableCell>{item.vendx_percentage}%</TableCell>
                          <TableCell>${Number(item.vendx_share).toLocaleString()}</TableCell>
                          <TableCell className="text-green-500">${Number(item.owner_share).toLocaleString()}</TableCell>
                          <TableCell>{item.transaction_count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PayoutsManager;
