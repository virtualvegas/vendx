import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/hooks/useAuditLog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Gift, Plus, Copy, Check, Search } from "lucide-react";
import { format } from "date-fns";

const generateCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "VXG-";
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    if (i < 3) code += "-";
  }
  return code;
};

const GiftCardManager = () => {
  const [showCreate, setShowCreate] = useState(false);
  const [newValue, setNewValue] = useState("25");
  const [newCode, setNewCode] = useState(generateCode());
  const [newNotes, setNewNotes] = useState("");
  const [newExpiry, setNewExpiry] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [bulkCount, setBulkCount] = useState("1");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: giftCards = [], isLoading } = useQuery({
    queryKey: ["admin-gift-cards"],
    queryFn: async () => {
      const client = supabase as any;
      const { data, error } = await client
        .from("gift_cards")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (cards: { code: string; value: number; notes: string; expires_at: string | null }[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      const client = supabase as any;
      const rows = cards.map(c => ({
        code: c.code,
        value: c.value,
        remaining_value: c.value,
        status: "active",
        created_by: user?.id,
        notes: c.notes || null,
        expires_at: c.expires_at || null,
      }));
      const { error } = await client.from("gift_cards").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-gift-cards"] });
      setShowCreate(false);
      setNewCode(generateCode());
      setNewNotes("");
      setNewExpiry("");
      toast({ title: "Gift Card(s) Created", description: "New gift card codes are now active." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const client = supabase as any;
      const { error } = await client.from("gift_cards").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-gift-cards"] });
      toast({ title: "Status Updated" });
    },
  });

  const handleCreate = () => {
    const count = parseInt(bulkCount) || 1;
    const value = parseFloat(newValue);
    if (!value || value <= 0) {
      toast({ title: "Invalid value", variant: "destructive" });
      return;
    }
    const cards = [];
    for (let i = 0; i < count; i++) {
      cards.push({
        code: i === 0 ? newCode : generateCode(),
        value,
        notes: newNotes,
        expires_at: newExpiry || null,
      });
    }
    createMutation.mutate(cards);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const filtered = giftCards.filter((gc: any) => {
    if (filterStatus !== "all" && gc.status !== filterStatus) return false;
    if (search && !gc.code.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const statusColor = (s: string) => {
    switch (s) {
      case "active": return "bg-green-500/20 text-green-400";
      case "inactive": return "bg-muted text-muted-foreground";
      case "fully_redeemed": return "bg-primary/20 text-primary";
      case "expired": return "bg-destructive/20 text-destructive";
      default: return "";
    }
  };

  const stats = {
    total: giftCards.length,
    active: giftCards.filter((g: any) => g.status === "active").length,
    totalValue: giftCards.filter((g: any) => g.status === "active").reduce((s: number, g: any) => s + Number(g.remaining_value), 0),
    redeemed: giftCards.filter((g: any) => g.status === "fully_redeemed").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Gift Cards</h2>
          <p className="text-muted-foreground">Create and manage VendX gift card codes</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Create Gift Card
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center">
          <p className="text-sm text-muted-foreground">Total Cards</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-sm text-muted-foreground">Active</p>
          <p className="text-2xl font-bold text-green-500">{stats.active}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-sm text-muted-foreground">Active Value</p>
          <p className="text-2xl font-bold">${stats.totalValue.toFixed(2)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-sm text-muted-foreground">Redeemed</p>
          <p className="text-2xl font-bold text-primary">{stats.redeemed}</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by code..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="fully_redeemed">Redeemed</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Remaining</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Redeemed By</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No gift cards found</TableCell></TableRow>
              ) : filtered.map((gc: any) => (
                <TableRow key={gc.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono">{gc.code}</code>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyCode(gc.code)}>
                        {copied === gc.code ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>${Number(gc.value).toFixed(2)}</TableCell>
                  <TableCell>${Number(gc.remaining_value).toFixed(2)}</TableCell>
                  <TableCell><Badge className={statusColor(gc.status)}>{gc.status}</Badge></TableCell>
                  <TableCell>{gc.expires_at ? format(new Date(gc.expires_at), "MMM d, yyyy") : "—"}</TableCell>
                  <TableCell>{gc.redeemed_at ? format(new Date(gc.redeemed_at), "MMM d, yyyy") : "—"}</TableCell>
                  <TableCell className="max-w-[150px] truncate">{gc.notes || "—"}</TableCell>
                  <TableCell>
                    {gc.status === "active" && (
                      <Button variant="outline" size="sm" onClick={() => updateStatusMutation.mutate({ id: gc.id, status: "inactive" })}>
                        Deactivate
                      </Button>
                    )}
                    {gc.status === "inactive" && (
                      <Button variant="outline" size="sm" onClick={() => updateStatusMutation.mutate({ id: gc.id, status: "active" })}>
                        Activate
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Gift className="w-5 h-5 text-primary" /> Create Gift Card</DialogTitle>
            <DialogDescription>Generate new gift card codes for VendX wallet loading.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Card Value ($)</Label>
                <Input type="number" min="1" value={newValue} onChange={e => setNewValue(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input type="number" min="1" max="50" value={bulkCount} onChange={e => setBulkCount(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Code (auto-generated)</Label>
              <div className="flex gap-2">
                <Input value={newCode} onChange={e => setNewCode(e.target.value)} className="font-mono" />
                <Button variant="outline" size="icon" onClick={() => setNewCode(generateCode())}><Gift className="w-4 h-4" /></Button>
              </div>
              {parseInt(bulkCount) > 1 && <p className="text-xs text-muted-foreground">Additional cards will use auto-generated codes</p>}
            </div>
            <div className="space-y-2">
              <Label>Expiry Date (optional)</Label>
              <Input type="date" value={newExpiry} onChange={e => setNewExpiry(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Internal notes..." />
            </div>
            <Button onClick={handleCreate} disabled={createMutation.isPending} className="w-full">
              {createMutation.isPending ? "Creating..." : `Create ${parseInt(bulkCount) > 1 ? parseInt(bulkCount) + " Cards" : "Gift Card"}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GiftCardManager;
