import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, Pause, Play, X, RefreshCw, Gift, AlertTriangle, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const statusColor = (s: string) => ({
  active: "bg-green-500/15 text-green-500 border-green-500/30",
  paused: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  past_due: "bg-orange-500/15 text-orange-500 border-orange-500/30",
  cancelled: "bg-muted text-muted-foreground border-border",
  pending: "bg-blue-500/15 text-blue-500 border-blue-500/30",
}[s] || "bg-muted text-muted-foreground border-border");

export default function SubscriptionsAdmin() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [eventsFor, setEventsFor] = useState<any | null>(null);
  const [compFor, setCompFor] = useState<any | null>(null);
  const [compAmount, setCompAmount] = useState("");

  const { data: subs, isLoading } = useQuery({
    queryKey: ["admin-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_subscriptions")
        .select("*, product:store_products(name, subscription_price, price, subscription_interval), profile:profiles!store_subscriptions_user_id_fkey(email, full_name)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    if (!subs) return [];
    const q = search.trim().toLowerCase();
    return subs.filter((s: any) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (providerFilter !== "all" && s.provider !== providerFilter) return false;
      if (!q) return true;
      return (
        s.profile?.email?.toLowerCase().includes(q) ||
        s.profile?.full_name?.toLowerCase().includes(q) ||
        s.product?.name?.toLowerCase().includes(q) ||
        s.stripe_subscription_id?.toLowerCase().includes(q) ||
        s.paypal_subscription_id?.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
      );
    });
  }, [subs, search, statusFilter, providerFilter]);

  const stats = useMemo(() => {
    const arr = subs || [];
    return {
      total: arr.length,
      active: arr.filter((s: any) => s.status === "active").length,
      pastDue: arr.filter((s: any) => s.status === "past_due").length,
      paused: arr.filter((s: any) => s.status === "paused").length,
      cancelled: arr.filter((s: any) => s.status === "cancelled").length,
    };
  }, [subs]);

  const act = useMutation({
    mutationFn: async ({ subscriptionId, action, reason, compAmount }: any) => {
      const { data, error } = await supabase.functions.invoke("subscription-manage", {
        body: { subscriptionId, action, reason, compAmount },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (d) => {
      toast({ title: d?.message || "Done" });
      qc.invalidateQueries({ queryKey: ["admin-subscriptions"] });
      setCompFor(null); setCompAmount("");
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const { data: events } = useQuery({
    queryKey: ["sub-events", eventsFor?.id],
    enabled: !!eventsFor,
    queryFn: async () => {
      const { data } = await supabase.from("store_subscription_events")
        .select("*").eq("subscription_id", eventsFor.id).order("created_at", { ascending: false }).limit(100);
      return data || [];
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Subscriptions</h2>
        <p className="text-sm text-muted-foreground">Manage every customer subscription across Stripe and PayPal.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total", value: stats.total },
          { label: "Active", value: stats.active, color: "text-green-500" },
          { label: "Past due", value: stats.pastDue, color: "text-orange-500" },
          { label: "Paused", value: stats.paused, color: "text-yellow-500" },
          { label: "Cancelled", value: stats.cancelled, color: "text-muted-foreground" },
        ].map((s) => (
          <Card key={s.label}><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color || ""}`}>{s.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search by email, product, sub ID..." className="pl-8"
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="past_due">Past due</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All providers</SelectItem>
                <SelectItem value="stripe">Stripe</SelectItem>
                <SelectItem value="paypal">PayPal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Next billing</TableHead>
                    <TableHead>Failures</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s: any) => {
                    const price = Number(s.product?.subscription_price || s.product?.price || 0);
                    return (
                      <TableRow key={s.id}>
                        <TableCell>
                          <div className="text-sm">{s.profile?.full_name || s.profile?.email || s.user_id}</div>
                          <div className="text-xs text-muted-foreground">{s.profile?.email}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{s.product?.name || "—"}</div>
                          <div className="text-xs text-muted-foreground">${price.toFixed(2)} / {s.product?.subscription_interval || "month"}</div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className={statusColor(s.status)}>{s.status}</Badge></TableCell>
                        <TableCell><span className="text-xs uppercase">{s.provider}</span></TableCell>
                        <TableCell className="text-xs">{s.current_period_end ? format(new Date(s.current_period_end), "MMM d, yyyy") : "—"}</TableCell>
                        <TableCell>
                          {s.failed_payment_count > 0 ? (
                            <Badge variant="outline" className="gap-1 text-orange-500 border-orange-500/30">
                              <AlertTriangle className="h-3 w-3" /> {s.failed_payment_count}
                            </Badge>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {s.status === "past_due" && (
                              <Button size="sm" variant="ghost" onClick={() => act.mutate({ subscriptionId: s.id, action: "retry_payment" })}>
                                <RefreshCw className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {s.status === "active" && (
                              <Button size="sm" variant="ghost" onClick={() => act.mutate({ subscriptionId: s.id, action: "pause" })}>
                                <Pause className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {s.status === "paused" && (
                              <Button size="sm" variant="ghost" onClick={() => act.mutate({ subscriptionId: s.id, action: "resume" })}>
                                <Play className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {s.status !== "cancelled" && (
                              <Button size="sm" variant="ghost" className="text-destructive"
                                onClick={() => act.mutate({ subscriptionId: s.id, action: "cancel_immediate", reason: "Cancelled by support" })}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => setCompFor(s)}>
                              <Gift className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEventsFor(s)}>
                              <History className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No subscriptions match.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Events drawer */}
      <Dialog open={!!eventsFor} onOpenChange={(o) => !o && setEventsFor(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Subscription history</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {(events || []).map((e: any) => (
              <div key={e.id} className="border rounded-md p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{e.event_type}</span>
                  <Badge variant="outline">{e.source}</Badge>
                </div>
                {e.message && <p className="text-xs text-muted-foreground mt-1">{e.message}</p>}
                <p className="text-xs text-muted-foreground mt-1">{format(new Date(e.created_at), "MMM d, yyyy HH:mm")}</p>
              </div>
            ))}
            {events && events.length === 0 && <p className="text-center text-muted-foreground py-6">No events recorded yet.</p>}
          </div>
        </DialogContent>
      </Dialog>

      {/* Comp credit dialog */}
      <Dialog open={!!compFor} onOpenChange={(o) => { if (!o) { setCompFor(null); setCompAmount(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add complimentary credit</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              For {compFor?.profile?.email || "this customer"}. Credit reduces their next invoice.
            </p>
            <Input type="number" step="0.01" min="0.01" placeholder="Amount (USD)"
              value={compAmount} onChange={(e) => setCompAmount(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompFor(null)}>Cancel</Button>
            <Button onClick={() => act.mutate({ subscriptionId: compFor.id, action: "comp_credit", compAmount: Number(compAmount), reason: "Goodwill credit" })}>
              Add credit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
