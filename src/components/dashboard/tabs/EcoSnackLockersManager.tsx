import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Leaf, Lock, Copy, Search, RefreshCw, AlertTriangle,
  KeyRound, PackageCheck, Eye, Loader2, CheckCircle, XCircle, Clock,
} from "lucide-react";

const EcoSnackLockersManager = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null);
  const [editCodeDialog, setEditCodeDialog] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [restockDialog, setRestockDialog] = useState(false);
  const [restockMachineId, setRestockMachineId] = useState<string | null>(null);
  const [restockNotes, setRestockNotes] = useState("");

  // Fetch all EcoSnack purchases
  const { data: purchases, isLoading } = useQuery({
    queryKey: ["ecosnack-purchases", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("ecosnack_locker_purchases")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (statusFilter !== "all") {
        query = query.eq("payment_status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch EcoSnack machines for restock
  const { data: ecosnackMachines } = useQuery({
    queryKey: ["ecosnack-machines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendx_machines")
        .select("id, name, machine_code, location:locations(name, city)")
        .eq("machine_type", "ecosnack")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Update locker code mutation
  const updateCode = useMutation({
    mutationFn: async ({ purchaseId, code }: { purchaseId: string; code: string }) => {
      if (!/^\d{3}$/.test(code)) throw new Error("Code must be exactly 3 digits");
      const { error } = await supabase
        .from("ecosnack_locker_purchases")
        .update({ locker_code: code })
        .eq("id", purchaseId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Locker code updated");
      queryClient.invalidateQueries({ queryKey: ["ecosnack-purchases"] });
      setEditCodeDialog(false);
      setNewCode("");
      setSelectedPurchase(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Bulk regenerate codes for a machine (restock scenario)
  const regenerateCodes = useMutation({
    mutationFn: async (machineCode: string) => {
      // Get all active (non-redeemed, non-expired) purchases for this machine
      const { data: activePurchases, error: fetchErr } = await supabase
        .from("ecosnack_locker_purchases")
        .select("id")
        .eq("machine_code", machineCode)
        .eq("payment_status", "completed")
        .is("redeemed_at", null)
        .gt("expires_at", new Date().toISOString());

      if (fetchErr) throw fetchErr;

      // Update each with a new random 3-digit code
      for (const p of activePurchases || []) {
        const newCode = String(Math.floor(100 + Math.random() * 900));
        await supabase
          .from("ecosnack_locker_purchases")
          .update({ locker_code: newCode })
          .eq("id", p.id);
      }

      return (activePurchases || []).length;
    },
    onSuccess: (count) => {
      toast.success(`${count} locker code(s) regenerated for restocking`);
      queryClient.invalidateQueries({ queryKey: ["ecosnack-purchases"] });
      setRestockDialog(false);
      setRestockMachineId(null);
      setRestockNotes("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Code copied!");
  };

  const filtered = (purchases || []).filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.machine_code?.toLowerCase().includes(q) ||
      p.item_name?.toLowerCase().includes(q) ||
      p.locker_number?.toLowerCase().includes(q) ||
      p.locker_code?.toLowerCase().includes(q)
    );
  });

  const getStatusBadge = (status: string, redeemedAt: string | null, expiresAt: string) => {
    if (redeemedAt) return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"><CheckCircle className="h-3 w-3 mr-1" />Redeemed</Badge>;
    if (new Date(expiresAt) < new Date()) return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Expired</Badge>;
    if (status === "completed") return <Badge className="bg-accent/20 text-accent border-accent/30"><Clock className="h-3 w-3 mr-1" />Active</Badge>;
    if (status === "pending") return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Pending</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  // Stats
  const totalActive = (purchases || []).filter(p => p.payment_status === "completed" && !p.redeemed_at && new Date(p.expires_at) > new Date()).length;
  const totalRedeemed = (purchases || []).filter(p => p.redeemed_at).length;
  const totalExpired = (purchases || []).filter(p => !p.redeemed_at && new Date(p.expires_at) < new Date()).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
            <Leaf className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">EcoSnack Lockers</h2>
            <p className="text-sm text-muted-foreground">Manage locker codes, purchases & restocking</p>
          </div>
        </div>
        <Button
          onClick={() => setRestockDialog(true)}
          variant="outline"
          className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Restock Machine
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border-border bg-card">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase">Total Purchases</p>
            <p className="text-2xl font-bold text-foreground">{(purchases || []).length}</p>
          </CardContent>
        </Card>
        <Card className="border-accent/30 bg-card">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-accent uppercase">Active Codes</p>
            <p className="text-2xl font-bold text-accent">{totalActive}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/30 bg-card">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-emerald-400 uppercase">Redeemed</p>
            <p className="text-2xl font-bold text-emerald-400">{totalRedeemed}</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/30 bg-card">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-destructive uppercase">Expired</p>
            <p className="text-2xl font-bold text-destructive">{totalExpired}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by machine, item, locker, or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Purchases Table */}
      <Card className="border-border bg-card">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-accent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Lock className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No locker purchases found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Machine</TableHead>
                  <TableHead>Locker</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((purchase) => (
                  <TableRow key={purchase.id}>
                    <TableCell className="font-mono text-xs">{purchase.machine_code}</TableCell>
                    <TableCell>
                      <Badge variant="outline">#{purchase.locker_number.padStart(2, "0")}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{purchase.item_name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-accent tracking-wider">
                          {purchase.locker_code}
                        </span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyCode(purchase.locker_code)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>${purchase.amount.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{purchase.payment_method}</Badge>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(purchase.payment_status, purchase.redeemed_at, purchase.expires_at)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(purchase.created_at), "MMM d, h:mm a")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setSelectedPurchase(purchase);
                            setNewCode(purchase.locker_code);
                            setEditCodeDialog(true);
                          }}
                          title="Edit locker code"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setSelectedPurchase(purchase)}
                          title="View details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Code Dialog */}
      <Dialog open={editCodeDialog} onOpenChange={(open) => { setEditCodeDialog(open); if (!open) setSelectedPurchase(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-accent" />
              Set Locker Code
            </DialogTitle>
          </DialogHeader>
          {selectedPurchase && (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Machine</span>
                  <span className="font-mono">{selectedPurchase.machine_code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Locker</span>
                  <span>#{selectedPurchase.locker_number.padStart(2, "0")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Item</span>
                  <span className="font-medium">{selectedPurchase.item_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Code</span>
                  <span className="font-mono font-bold text-accent tracking-wider">{selectedPurchase.locker_code}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>New 3-Digit Code</Label>
                <Input
                  value={newCode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 3);
                    setNewCode(val);
                  }}
                  placeholder="Enter 3-digit code (e.g. 472)"
                  maxLength={3}
                  className="text-center text-2xl font-mono tracking-[0.3em]"
                />
                <p className="text-xs text-muted-foreground">
                  Must be exactly 3 digits. This is the code the customer uses to open the locker.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCodeDialog(false)}>Cancel</Button>
            <Button
              onClick={() => selectedPurchase && updateCode.mutate({ purchaseId: selectedPurchase.id, code: newCode })}
              disabled={newCode.length !== 3 || updateCode.isPending}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {updateCode.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
              Update Code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restock Dialog */}
      <Dialog open={restockDialog} onOpenChange={setRestockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-400" />
              Restock Machine — Change Locker Codes
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 text-sm text-orange-300 space-y-2">
              <p className="font-semibold flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Important: Restocking Procedure
              </p>
              <ul className="list-disc list-inside space-y-1 text-orange-300/80">
                <li>Set physical locker dials to new combinations</li>
                <li>This will regenerate codes for all <strong>active, unredeemed</strong> purchases</li>
                <li>Customers with active purchases will need to check their updated codes</li>
                <li>Expired and redeemed purchases are not affected</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label>Select Machine to Restock</Label>
              <Select value={restockMachineId || ""} onValueChange={setRestockMachineId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose EcoSnack machine..." />
                </SelectTrigger>
                <SelectContent>
                  {(ecosnackMachines || []).map((m: any) => (
                    <SelectItem key={m.id} value={m.machine_code}>
                      {m.name} ({m.machine_code}) — {(m.location as any)?.name || (m.location as any)?.city || "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Restock Notes (optional)</Label>
              <Textarea
                value={restockNotes}
                onChange={(e) => setRestockNotes(e.target.value)}
                placeholder="e.g. Refilled lockers 1-6, replaced trail mix..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestockDialog(false)}>Cancel</Button>
            <Button
              onClick={() => restockMachineId && regenerateCodes.mutate(restockMachineId)}
              disabled={!restockMachineId || regenerateCodes.isPending}
              className="bg-orange-500 text-white hover:bg-orange-600"
            >
              {regenerateCodes.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Regenerate All Codes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail View (when purchase selected but not editing code) */}
      {selectedPurchase && !editCodeDialog && (
        <Dialog open={!!selectedPurchase} onOpenChange={(open) => { if (!open) setSelectedPurchase(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Purchase Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="bg-muted rounded-lg p-4 space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Purchase ID</span><span className="font-mono text-xs">{selectedPurchase.id.slice(0, 8)}...</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Machine</span><span className="font-mono">{selectedPurchase.machine_code}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Locker</span><span>#{selectedPurchase.locker_number.padStart(2, "0")}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Item</span><span className="font-medium">{selectedPurchase.item_name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="text-accent font-bold">${selectedPurchase.amount.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Payment</span><span className="capitalize">{selectedPurchase.payment_method}</span></div>
              </div>
              <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase mb-1">Locker Code</p>
                <p className="text-4xl font-mono font-bold text-accent tracking-[0.3em]">{selectedPurchase.locker_code}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><span className="text-muted-foreground">Created</span><p>{format(new Date(selectedPurchase.created_at), "MMM d, yyyy h:mm a")}</p></div>
                <div><span className="text-muted-foreground">Expires</span><p>{format(new Date(selectedPurchase.expires_at), "MMM d, yyyy h:mm a")}</p></div>
                {selectedPurchase.redeemed_at && (
                  <div><span className="text-muted-foreground">Redeemed</span><p>{format(new Date(selectedPurchase.redeemed_at), "MMM d, yyyy h:mm a")}</p></div>
                )}
                {selectedPurchase.user_id && (
                  <div><span className="text-muted-foreground">User ID</span><p className="font-mono">{selectedPurchase.user_id.slice(0, 8)}...</p></div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedPurchase(null)}>Close</Button>
              <Button
                onClick={() => {
                  setNewCode(selectedPurchase.locker_code);
                  setEditCodeDialog(true);
                }}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <KeyRound className="h-4 w-4 mr-2" />
                Change Code
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default EcoSnackLockersManager;
