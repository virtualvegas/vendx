import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, DollarSign, CheckCircle, Clock, XCircle } from "lucide-react";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  approved: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  paid: "bg-green-500/10 text-green-500 border-green-500/30",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
};

const ArtistPayoutsManager = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    artist_id: "",
    amount: "",
    period_start: "",
    period_end: "",
    payment_method: "bank_transfer",
    payment_reference: "",
    notes: "",
  });

  const { data: artists } = useQuery({
    queryKey: ["payout-artists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media_artists")
        .select("id, name, commission_rate")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: payouts, isLoading } = useQuery({
    queryKey: ["artist-payouts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("artist_payouts")
        .select("*, artist:media_artists(id, name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Get sales data for an artist in a period
  const { data: salesPreview } = useQuery({
    queryKey: ["artist-sales-preview", form.artist_id, form.period_start, form.period_end],
    queryFn: async () => {
      if (!form.artist_id || !form.period_start || !form.period_end) return null;
      // Count products sold for this artist (using media_shop_products linked to orders would be ideal,
      // but for now we show the product catalog summary)
      const { data, error } = await supabase
        .from("media_shop_products")
        .select("id, title, price, stock_quantity")
        .eq("artist_id", form.artist_id)
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!form.artist_id && !!form.period_start && !!form.period_end,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("artist_payouts").insert({
        artist_id: form.artist_id,
        amount: parseFloat(form.amount) || 0,
        period_start: form.period_start,
        period_end: form.period_end,
        payment_method: form.payment_method,
        payment_reference: form.payment_reference || null,
        notes: form.notes || null,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["artist-payouts"] });
      toast.success("Payout created");
      setDialogOpen(false);
      setForm({ artist_id: "", amount: "", period_start: "", period_end: "", payment_method: "bank_transfer", payment_reference: "", notes: "" });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const update: any = { status };
      if (status === "paid") {
        update.processed_at = new Date().toISOString();
      }
      const { error } = await supabase.from("artist_payouts").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["artist-payouts"] });
      toast.success("Payout updated");
    },
  });

  const totalPending = payouts?.filter((p: any) => p.status === "pending").reduce((s: number, p: any) => s + Number(p.amount), 0) || 0;
  const totalPaid = payouts?.filter((p: any) => p.status === "paid").reduce((s: number, p: any) => s + Number(p.amount), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Artist Payouts</h2>
          <p className="text-muted-foreground">Manage payouts to artists for merchandise & media sales</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Create Payout</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Artist Payout</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Artist</Label>
                <Select value={form.artist_id} onValueChange={(v) => setForm({ ...form, artist_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select artist" /></SelectTrigger>
                  <SelectContent>
                    {artists?.map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} ({((a.commission_rate || 0) * 100).toFixed(0)}% commission)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Period Start</Label>
                  <Input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} />
                </div>
                <div>
                  <Label>Period End</Label>
                  <Input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} />
                </div>
              </div>

              {salesPreview && salesPreview.length > 0 && (
                <Card className="bg-muted/50">
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground mb-1">Artist has {salesPreview.length} active products</p>
                    {salesPreview.slice(0, 5).map((p: any) => (
                      <div key={p.id} className="text-xs flex justify-between py-0.5">
                        <span>{p.title}</span>
                        <span className="text-muted-foreground">${Number(p.price).toFixed(2)}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Payout Amount ($)</Label>
                  <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div>
                  <Label>Payment Method</Label>
                  <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="paypal">PayPal</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Payment Reference</Label>
                <Input value={form.payment_reference} onChange={(e) => setForm({ ...form, payment_reference: e.target.value })} placeholder="Transaction ID, check number, etc." />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
              <Button onClick={() => createMutation.mutate()} disabled={!form.artist_id || !form.amount || createMutation.isPending} className="w-full">
                {createMutation.isPending ? "Creating..." : "Create Payout"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="bg-card/50"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Total Payouts</p>
          <p className="text-2xl font-bold">{payouts?.length || 0}</p>
        </CardContent></Card>
        <Card className="bg-card/50"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Pending</p>
          <p className="text-2xl font-bold text-yellow-500">${totalPending.toFixed(2)}</p>
        </CardContent></Card>
        <Card className="bg-card/50"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Paid</p>
          <p className="text-2xl font-bold text-green-500">${totalPaid.toFixed(2)}</p>
        </CardContent></Card>
      </div>

      {/* Payouts Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Artist</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : payouts && payouts.length > 0 ? (
                payouts.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.artist?.name || "Unknown"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(p.period_start), "MMM d")} – {format(new Date(p.period_end), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="font-semibold">${Number(p.amount).toFixed(2)}</TableCell>
                    <TableCell className="capitalize text-sm">{p.payment_method?.replace("_", " ")}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[p.status] || ""}>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {p.status === "pending" && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => updateStatus.mutate({ id: p.id, status: "paid" })} className="text-green-500 text-xs">
                              <CheckCircle className="w-4 h-4 mr-1" /> Pay
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => updateStatus.mutate({ id: p.id, status: "cancelled" })} className="text-destructive text-xs">
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No payouts yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ArtistPayoutsManager;
