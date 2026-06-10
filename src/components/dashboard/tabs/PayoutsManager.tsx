import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/hooks/useAuditLog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Wallet, Plus, Search, RefreshCw, Download, Eye, CheckCircle, XCircle,
  Calendar, Users, Music, Briefcase, Clock,
} from "lucide-react";
import { formatDisplayDate } from "@/lib/dateUtils";
import { format } from "date-fns";

interface PayoutsManagerProps {
  defaultTab?: "partners" | "artists" | "settings";
}

const STATUS_OPTIONS = ["pending", "processing", "paid", "failed"];
const ARTIST_STATUSES = ["pending", "approved", "paid", "cancelled"];

const statusColor = (s: string) => {
  switch (s) {
    case "paid": return "bg-green-500/15 text-green-500 border-green-500/30";
    case "pending": return "bg-yellow-500/15 text-yellow-500 border-yellow-500/30";
    case "processing": case "approved": return "bg-blue-500/15 text-blue-500 border-blue-500/30";
    case "failed": case "cancelled": return "bg-destructive/15 text-destructive border-destructive/30";
    default: return "";
  }
};

const downloadCsv = (rows: any[], filename: string) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map(r => headers.map(h => {
      const v = r[h];
      const s = v == null ? "" : String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    }).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

const PayoutsManager = ({ defaultTab = "partners" }: PayoutsManagerProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<string>(defaultTab);

  // ============== Shared filters ==============
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // ============== Partner (Business Owner) Payouts ==============
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<Set<string>>(new Set());
  const [detailsPayout, setDetailsPayout] = useState<any>(null);
  const [createPartnerOpen, setCreatePartnerOpen] = useState(false);
  const [partnerForm, setPartnerForm] = useState({
    business_owner_id: "", amount: "", gross_revenue: "", vendx_share: "",
    period_start: "", period_end: "", notes: "",
  });

  const { data: partnerPayouts, isLoading: partnerLoading } = useQuery({
    queryKey: ["admin-partner-payouts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payouts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const ids = Array.from(new Set((data || []).map(p => p.business_owner_id)));
      if (!ids.length) return [];
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      const map = new Map((profiles || []).map(p => [p.id, p]));
      return (data || []).map(p => ({ ...p, business_owner: map.get(p.business_owner_id) }));
    },
  });

  const { data: businessOwners } = useQuery({
    queryKey: ["business-owners-for-payouts"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "business_owner");
      if (!roles?.length) return [];
      const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", roles.map(r => r.user_id));
      return data || [];
    },
  });

  const { data: partnerItems } = useQuery({
    queryKey: ["partner-payout-items", detailsPayout?.id],
    enabled: !!detailsPayout && tab === "partners",
    queryFn: async () => {
      const { data } = await supabase.from("payout_line_items").select("*").eq("payout_id", detailsPayout.id);
      const machineIds = Array.from(new Set((data || []).map((i: any) => i.machine_id)));
      const locationIds = Array.from(new Set((data || []).map((i: any) => i.location_id)));
      const [machines, locations] = await Promise.all([
        machineIds.length ? supabase.from("vendx_machines").select("id, name, machine_code").in("id", machineIds) : Promise.resolve({ data: [] }),
        locationIds.length ? supabase.from("locations").select("id, name, city, country").in("id", locationIds) : Promise.resolve({ data: [] }),
      ]);
      const mm = new Map((machines.data || []).map((m: any) => [m.id, m]));
      const lm = new Map((locations.data || []).map((l: any) => [l.id, l]));
      return (data || []).map((i: any) => ({ ...i, machine: mm.get(i.machine_id), location: lm.get(i.location_id) }));
    },
  });

  const partnerMutation = useMutation({
    mutationFn: async ({ ids, status, payment_reference }: { ids: string[]; status: string; payment_reference?: string }) => {
      const update: any = { status };
      if (status === "paid") update.paid_at = new Date().toISOString();
      if (payment_reference) update.payment_reference = payment_reference;
      const { error } = await supabase.from("payouts").update(update).in("id", ids);
      if (error) throw error;
      return ids;
    },
    onSuccess: (ids, { status, payment_reference }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-partner-payouts"] });
      setSelectedPartnerIds(new Set());
      toast({ title: `Updated ${ids.length} payout${ids.length > 1 ? "s" : ""}` });
      ids.forEach(id => logAuditEvent({ action: "Updated Partner Payout", entity_type: "Payout", entity_id: id, details: { new_status: status, payment_reference } }));
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createPartnerMutation = useMutation({
    mutationFn: async () => {
      const gross = parseFloat(partnerForm.gross_revenue) || 0;
      const vendxShare = parseFloat(partnerForm.vendx_share) || 0;
      const amount = parseFloat(partnerForm.amount) || (gross - vendxShare);
      const { data, error } = await supabase.from("payouts").insert({
        business_owner_id: partnerForm.business_owner_id,
        amount, gross_revenue: gross, vendx_share: vendxShare,
        period_start: partnerForm.period_start, period_end: partnerForm.period_end,
        notes: partnerForm.notes || null, status: "pending",
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-partner-payouts"] });
      toast({ title: "Partner payout created" });
      setCreatePartnerOpen(false);
      setPartnerForm({ business_owner_id: "", amount: "", gross_revenue: "", vendx_share: "", period_start: "", period_end: "", notes: "" });
      if (data?.id) logAuditEvent({ action: "Created Partner Payout", entity_type: "Payout", entity_id: data.id });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ============== Artist Payouts ==============
  const [selectedArtistIds, setSelectedArtistIds] = useState<Set<string>>(new Set());
  const [createArtistOpen, setCreateArtistOpen] = useState(false);
  const [artistForm, setArtistForm] = useState({
    artist_id: "", amount: "", period_start: "", period_end: "",
    payment_method: "bank_transfer", payment_reference: "", notes: "",
  });

  const { data: artistPayouts, isLoading: artistLoading } = useQuery({
    queryKey: ["admin-artist-payouts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("artist_payouts")
        .select("*, artist:media_artists(id, name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: artists } = useQuery({
    queryKey: ["artists-for-payouts"],
    queryFn: async () => {
      const { data } = await supabase.from("media_artists").select("id, name, commission_rate").eq("is_active", true).order("name");
      return data || [];
    },
  });

  const artistMutation = useMutation({
    mutationFn: async ({ ids, status, payment_reference }: { ids: string[]; status: string; payment_reference?: string }) => {
      const update: any = { status };
      if (status === "paid") update.processed_at = new Date().toISOString();
      if (payment_reference) update.payment_reference = payment_reference;
      const { error } = await supabase.from("artist_payouts").update(update).in("id", ids);
      if (error) throw error;
      return ids;
    },
    onSuccess: (ids, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-artist-payouts"] });
      setSelectedArtistIds(new Set());
      toast({ title: `Updated ${ids.length} artist payout${ids.length > 1 ? "s" : ""}` });
      ids.forEach(id => logAuditEvent({ action: "Updated Artist Payout", entity_type: "ArtistPayout", entity_id: id, details: { new_status: status } }));
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createArtistMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("artist_payouts").insert({
        artist_id: artistForm.artist_id,
        amount: parseFloat(artistForm.amount) || 0,
        period_start: artistForm.period_start,
        period_end: artistForm.period_end,
        payment_method: artistForm.payment_method,
        payment_reference: artistForm.payment_reference || null,
        notes: artistForm.notes || null,
        status: "pending",
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-artist-payouts"] });
      toast({ title: "Artist payout created" });
      setCreateArtistOpen(false);
      setArtistForm({ artist_id: "", amount: "", period_start: "", period_end: "", payment_method: "bank_transfer", payment_reference: "", notes: "" });
      if (data?.id) logAuditEvent({ action: "Created Artist Payout", entity_type: "ArtistPayout", entity_id: data.id });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ============== Payout Settings (per-user payment method) ==============
  const { data: payoutSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ["all-payout-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payout_settings").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      const ids = Array.from(new Set((data || []).map((s: any) => s.user_id)));
      if (!ids.length) return [];
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      const map = new Map((profiles || []).map(p => [p.id, p]));
      return (data || []).map((s: any) => ({ ...s, profile: map.get(s.user_id) }));
    },
  });

  // ============== Derived ==============
  const inDateRange = (start: string, end: string) => {
    if (fromDate && end < fromDate) return false;
    if (toDate && start > toDate) return false;
    return true;
  };

  const filteredPartners = useMemo(() => {
    return (partnerPayouts || []).filter((p: any) => {
      const o = p.business_owner;
      const term = search.toLowerCase();
      const matchesSearch = !term || (o?.full_name?.toLowerCase().includes(term) || o?.email?.toLowerCase().includes(term) || p.payment_reference?.toLowerCase().includes(term));
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      return matchesSearch && matchesStatus && inDateRange(p.period_start, p.period_end);
    });
  }, [partnerPayouts, search, statusFilter, fromDate, toDate]);

  const filteredArtists = useMemo(() => {
    return (artistPayouts || []).filter((p: any) => {
      const term = search.toLowerCase();
      const matchesSearch = !term || p.artist?.name?.toLowerCase().includes(term) || p.payment_reference?.toLowerCase().includes(term);
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      return matchesSearch && matchesStatus && inDateRange(p.period_start, p.period_end);
    });
  }, [artistPayouts, search, statusFilter, fromDate, toDate]);

  const combinedStats = useMemo(() => {
    const all = [
      ...(partnerPayouts || []).map((p: any) => ({ amount: Number(p.amount), status: p.status })),
      ...(artistPayouts || []).map((p: any) => ({ amount: Number(p.amount), status: p.status })),
    ];
    const pendingAmt = all.filter(p => p.status === "pending" || p.status === "processing" || p.status === "approved").reduce((s, p) => s + p.amount, 0);
    const paidAmt = all.filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0);
    return { totalCount: all.length, pendingAmt, paidAmt };
  }, [partnerPayouts, artistPayouts]);

  // ============== Handlers ==============
  const togglePartner = (id: string) => setSelectedPartnerIds(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleArtist = (id: string) => setSelectedArtistIds(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const bulkMarkPartners = (status: string) => {
    if (!selectedPartnerIds.size) return;
    const ref = status === "paid" ? (prompt("Bulk payment reference (optional):") || undefined) : undefined;
    partnerMutation.mutate({ ids: Array.from(selectedPartnerIds), status, payment_reference: ref });
  };

  const bulkMarkArtists = (status: string) => {
    if (!selectedArtistIds.size) return;
    const ref = status === "paid" ? (prompt("Bulk payment reference (optional):") || undefined) : undefined;
    artistMutation.mutate({ ids: Array.from(selectedArtistIds), status, payment_reference: ref });
  };

  const exportPartners = () => downloadCsv(filteredPartners.map((p: any) => ({
    business_owner: p.business_owner?.full_name || "", email: p.business_owner?.email || "",
    period_start: p.period_start, period_end: p.period_end,
    gross_revenue: p.gross_revenue, vendx_share: p.vendx_share, amount: p.amount,
    status: p.status, payment_reference: p.payment_reference || "", paid_at: p.paid_at || "",
  })), `partner-payouts-${format(new Date(), "yyyy-MM-dd")}.csv`);

  const exportArtists = () => downloadCsv(filteredArtists.map((p: any) => ({
    artist: p.artist?.name || "", period_start: p.period_start, period_end: p.period_end,
    amount: p.amount, payment_method: p.payment_method, status: p.status,
    payment_reference: p.payment_reference || "", processed_at: p.processed_at || "",
  })), `artist-payouts-${format(new Date(), "yyyy-MM-dd")}.csv`);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="w-6 h-6 text-primary" /> Payouts Manager
          </h2>
          <p className="text-sm text-muted-foreground">Unified partner, artist & payout method management</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          queryClient.invalidateQueries({ queryKey: ["admin-partner-payouts"] });
          queryClient.invalidateQueries({ queryKey: ["admin-artist-payouts"] });
          queryClient.invalidateQueries({ queryKey: ["all-payout-settings"] });
        }}>
          <RefreshCw className="w-4 h-4 mr-2" />Refresh
        </Button>
      </div>

      {/* Combined Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Total Payouts</p>
          <p className="text-2xl font-bold">{combinedStats.totalCount}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Briefcase className="w-3 h-3" /> Partner Records</p>
          <p className="text-2xl font-bold">{partnerPayouts?.length || 0}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Music className="w-3 h-3" /> Artist Records</p>
          <p className="text-2xl font-bold">{artistPayouts?.length || 0}</p>
        </CardContent></Card>
        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Outstanding</p>
          <p className="text-2xl font-bold text-yellow-500">${combinedStats.pendingAmt.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
          <p className="text-xs text-muted-foreground mt-1">Paid: ${combinedStats.paidAmt.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
        </CardContent></Card>
      </div>

      {/* Shared Filters */}
      <Card><CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search name, email, reference…" value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {[...new Set([...STATUS_OPTIONS, ...ARTIST_STATUSES])].map(s => (
                <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} placeholder="From" />
            <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} placeholder="To" />
          </div>
        </div>
      </CardContent></Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-xl">
          <TabsTrigger value="partners" className="gap-1.5"><Briefcase className="w-4 h-4" /> Partners</TabsTrigger>
          <TabsTrigger value="artists" className="gap-1.5"><Music className="w-4 h-4" /> Artists</TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5"><Users className="w-4 h-4" /> Methods</TabsTrigger>
        </TabsList>

        {/* ===== PARTNERS TAB ===== */}
        <TabsContent value="partners" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="flex gap-2">
              <Dialog open={createPartnerOpen} onOpenChange={setCreatePartnerOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> New Partner Payout</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>Create Partner Payout</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label>Business Owner</Label>
                      <Select value={partnerForm.business_owner_id} onValueChange={v => setPartnerForm({ ...partnerForm, business_owner_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
                        <SelectContent>
                          {businessOwners?.map((o: any) => (
                            <SelectItem key={o.id} value={o.id}>{o.full_name || o.email}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Period Start</Label><Input type="date" value={partnerForm.period_start} onChange={e => setPartnerForm({ ...partnerForm, period_start: e.target.value })} /></div>
                      <div><Label>Period End</Label><Input type="date" value={partnerForm.period_end} onChange={e => setPartnerForm({ ...partnerForm, period_end: e.target.value })} /></div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div><Label>Gross Revenue</Label><Input type="number" step="0.01" value={partnerForm.gross_revenue} onChange={e => setPartnerForm({ ...partnerForm, gross_revenue: e.target.value })} /></div>
                      <div><Label>VendX Share</Label><Input type="number" step="0.01" value={partnerForm.vendx_share} onChange={e => setPartnerForm({ ...partnerForm, vendx_share: e.target.value })} /></div>
                      <div><Label>Payout Amt</Label><Input type="number" step="0.01" value={partnerForm.amount} onChange={e => setPartnerForm({ ...partnerForm, amount: e.target.value })} placeholder="auto" /></div>
                    </div>
                    <div><Label>Notes</Label><Textarea rows={2} value={partnerForm.notes} onChange={e => setPartnerForm({ ...partnerForm, notes: e.target.value })} /></div>
                    <Button onClick={() => createPartnerMutation.mutate()} disabled={!partnerForm.business_owner_id || !partnerForm.period_start || !partnerForm.period_end || createPartnerMutation.isPending} className="w-full">
                      {createPartnerMutation.isPending ? "Creating…" : "Create Payout"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Button size="sm" variant="outline" onClick={exportPartners}><Download className="w-4 h-4 mr-1" /> Export CSV</Button>
            </div>
            {selectedPartnerIds.size > 0 && (
              <div className="flex gap-2 items-center">
                <span className="text-sm text-muted-foreground">{selectedPartnerIds.size} selected</span>
                <Button size="sm" variant="outline" onClick={() => bulkMarkPartners("processing")}>Mark Processing</Button>
                <Button size="sm" onClick={() => bulkMarkPartners("paid")} className="bg-green-600 hover:bg-green-700"><CheckCircle className="w-4 h-4 mr-1" /> Mark Paid</Button>
                <Button size="sm" variant="destructive" onClick={() => bulkMarkPartners("failed")}>Mark Failed</Button>
              </div>
            )}
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Partner Payouts ({filteredPartners.length})</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">
                        <Checkbox
                          checked={filteredPartners.length > 0 && filteredPartners.every((p: any) => selectedPartnerIds.has(p.id))}
                          onCheckedChange={(v) => setSelectedPartnerIds(v ? new Set(filteredPartners.map((p: any) => p.id)) : new Set())}
                        />
                      </TableHead>
                      <TableHead>Business Owner</TableHead>
                      <TableHead className="hidden md:table-cell">Period</TableHead>
                      <TableHead className="hidden lg:table-cell">Gross</TableHead>
                      <TableHead className="hidden lg:table-cell">VendX</TableHead>
                      <TableHead>Payout</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partnerLoading ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                    ) : filteredPartners.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No payouts match filters</TableCell></TableRow>
                    ) : filteredPartners.map((p: any) => {
                      const o = p.business_owner;
                      return (
                        <TableRow key={p.id}>
                          <TableCell><Checkbox checked={selectedPartnerIds.has(p.id)} onCheckedChange={() => togglePartner(p.id)} /></TableCell>
                          <TableCell>
                            <p className="font-medium">{o?.full_name || "Unknown"}</p>
                            <p className="text-xs text-muted-foreground">{o?.email}</p>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm">{formatDisplayDate(p.period_start)} – {formatDisplayDate(p.period_end)}</TableCell>
                          <TableCell className="hidden lg:table-cell">${Number(p.gross_revenue).toLocaleString()}</TableCell>
                          <TableCell className="hidden lg:table-cell">${Number(p.vendx_share).toLocaleString()}</TableCell>
                          <TableCell className="font-bold text-green-500">${Number(p.amount).toLocaleString()}</TableCell>
                          <TableCell><Badge variant="outline" className={statusColor(p.status)}>{p.status}</Badge></TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => setDetailsPayout(p)}><Eye className="w-4 h-4" /></Button>
                              {p.status === "pending" && (
                                <Button size="icon" variant="ghost" title="Mark processing" onClick={() => partnerMutation.mutate({ ids: [p.id], status: "processing" })}>
                                  <Calendar className="w-4 h-4 text-blue-500" />
                                </Button>
                              )}
                              {(p.status === "pending" || p.status === "processing") && (
                                <Button size="icon" variant="ghost" title="Mark paid" onClick={() => {
                                  const ref = prompt("Payment reference (optional):") || undefined;
                                  partnerMutation.mutate({ ids: [p.id], status: "paid", payment_reference: ref });
                                }}>
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
        </TabsContent>

        {/* ===== ARTISTS TAB ===== */}
        <TabsContent value="artists" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="flex gap-2">
              <Dialog open={createArtistOpen} onOpenChange={setCreateArtistOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> New Artist Payout</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Create Artist Payout</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label>Artist</Label>
                      <Select value={artistForm.artist_id} onValueChange={v => setArtistForm({ ...artistForm, artist_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select artist" /></SelectTrigger>
                        <SelectContent>
                          {artists?.map((a: any) => (
                            <SelectItem key={a.id} value={a.id}>{a.name} ({((a.commission_rate || 0) * 100).toFixed(0)}%)</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Period Start</Label><Input type="date" value={artistForm.period_start} onChange={e => setArtistForm({ ...artistForm, period_start: e.target.value })} /></div>
                      <div><Label>Period End</Label><Input type="date" value={artistForm.period_end} onChange={e => setArtistForm({ ...artistForm, period_end: e.target.value })} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Amount ($)</Label><Input type="number" step="0.01" value={artistForm.amount} onChange={e => setArtistForm({ ...artistForm, amount: e.target.value })} /></div>
                      <div>
                        <Label>Method</Label>
                        <Select value={artistForm.payment_method} onValueChange={v => setArtistForm({ ...artistForm, payment_method: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                            <SelectItem value="paypal">PayPal</SelectItem>
                            <SelectItem value="stripe_connect">Stripe Connect</SelectItem>
                            <SelectItem value="check">Check</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div><Label>Reference</Label><Input value={artistForm.payment_reference} onChange={e => setArtistForm({ ...artistForm, payment_reference: e.target.value })} /></div>
                    <div><Label>Notes</Label><Textarea rows={2} value={artistForm.notes} onChange={e => setArtistForm({ ...artistForm, notes: e.target.value })} /></div>
                    <Button onClick={() => createArtistMutation.mutate()} disabled={!artistForm.artist_id || !artistForm.amount || createArtistMutation.isPending} className="w-full">
                      {createArtistMutation.isPending ? "Creating…" : "Create Payout"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Button size="sm" variant="outline" onClick={exportArtists}><Download className="w-4 h-4 mr-1" /> Export CSV</Button>
            </div>
            {selectedArtistIds.size > 0 && (
              <div className="flex gap-2 items-center">
                <span className="text-sm text-muted-foreground">{selectedArtistIds.size} selected</span>
                <Button size="sm" variant="outline" onClick={() => bulkMarkArtists("approved")}>Approve</Button>
                <Button size="sm" onClick={() => bulkMarkArtists("paid")} className="bg-green-600 hover:bg-green-700"><CheckCircle className="w-4 h-4 mr-1" /> Mark Paid</Button>
                <Button size="sm" variant="destructive" onClick={() => bulkMarkArtists("cancelled")}>Cancel</Button>
              </div>
            )}
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Artist Payouts ({filteredArtists.length})</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">
                        <Checkbox
                          checked={filteredArtists.length > 0 && filteredArtists.every((p: any) => selectedArtistIds.has(p.id))}
                          onCheckedChange={(v) => setSelectedArtistIds(v ? new Set(filteredArtists.map((p: any) => p.id)) : new Set())}
                        />
                      </TableHead>
                      <TableHead>Artist</TableHead>
                      <TableHead className="hidden md:table-cell">Period</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead className="hidden md:table-cell">Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {artistLoading ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                    ) : filteredArtists.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No artist payouts</TableCell></TableRow>
                    ) : filteredArtists.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell><Checkbox checked={selectedArtistIds.has(p.id)} onCheckedChange={() => toggleArtist(p.id)} /></TableCell>
                        <TableCell className="font-medium">{p.artist?.name || "Unknown"}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm">{formatDisplayDate(p.period_start)} – {formatDisplayDate(p.period_end)}</TableCell>
                        <TableCell className="font-bold text-green-500">${Number(p.amount).toFixed(2)}</TableCell>
                        <TableCell className="hidden md:table-cell capitalize text-sm">{p.payment_method?.replace(/_/g, " ")}</TableCell>
                        <TableCell><Badge variant="outline" className={statusColor(p.status)}>{p.status}</Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {(p.status === "pending" || p.status === "approved") && (
                              <Button size="icon" variant="ghost" title="Mark paid" onClick={() => {
                                const ref = prompt("Payment reference (optional):") || undefined;
                                artistMutation.mutate({ ids: [p.id], status: "paid", payment_reference: ref });
                              }}>
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              </Button>
                            )}
                            {p.status === "pending" && (
                              <Button size="icon" variant="ghost" title="Cancel" onClick={() => artistMutation.mutate({ ids: [p.id], status: "cancelled" })}>
                                <XCircle className="w-4 h-4 text-destructive" />
                              </Button>
                            )}
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

        {/* ===== METHODS TAB ===== */}
        <TabsContent value="settings" className="mt-4 space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">User Payout Methods ({payoutSettings?.length || 0})</CardTitle>
              <p className="text-xs text-muted-foreground">Bank / Stripe Connect details and payout frequency configured by users</p>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="hidden md:table-cell">Bank / Account</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Min Payout</TableHead>
                      <TableHead className="hidden lg:table-cell">Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {settingsLoading ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                    ) : !payoutSettings?.length ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No payout methods configured yet</TableCell></TableRow>
                    ) : payoutSettings.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <p className="font-medium">{s.profile?.full_name || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">{s.profile?.email}</p>
                        </TableCell>
                        <TableCell className="capitalize text-sm">{s.payment_method?.replace(/_/g, " ")}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm">
                          {s.bank_name ? `${s.bank_name} •••${s.bank_account_last4 || "----"}` : s.stripe_account_id ? `Stripe ${s.stripe_account_id.slice(-6)}` : "—"}
                        </TableCell>
                        <TableCell className="capitalize text-sm">{s.payout_frequency?.replace(/_/g, " ")}</TableCell>
                        <TableCell>${Number(s.minimum_payout_amount || 0).toFixed(2)}</TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{formatDisplayDate(s.updated_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Partner Details Dialog */}
      <Dialog open={!!detailsPayout} onOpenChange={(o) => !o && setDetailsPayout(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Partner Payout Details</DialogTitle></DialogHeader>
          {detailsPayout && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><p className="text-xs text-muted-foreground">Business Owner</p><p className="font-medium">{detailsPayout.business_owner?.full_name}</p></div>
                <div><p className="text-xs text-muted-foreground">Period</p><p className="font-medium text-sm">{formatDisplayDate(detailsPayout.period_start)} – {formatDisplayDate(detailsPayout.period_end)}</p></div>
                <div><p className="text-xs text-muted-foreground">Payout</p><p className="font-bold text-green-500">${Number(detailsPayout.amount).toLocaleString()}</p></div>
                <div><p className="text-xs text-muted-foreground">Status</p><Badge variant="outline" className={statusColor(detailsPayout.status)}>{detailsPayout.status}</Badge></div>
              </div>
              {detailsPayout.payment_reference && (
                <div><p className="text-xs text-muted-foreground">Reference</p><p className="font-mono text-sm">{detailsPayout.payment_reference}</p></div>
              )}
              {detailsPayout.notes && (
                <div><p className="text-xs text-muted-foreground">Notes</p><p className="text-sm">{detailsPayout.notes}</p></div>
              )}
              <div>
                <h3 className="font-semibold mb-2">Machine Breakdown</h3>
                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Machine</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Gross</TableHead>
                        <TableHead>VendX %</TableHead>
                        <TableHead>VendX</TableHead>
                        <TableHead>Owner</TableHead>
                        <TableHead>Tx</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!partnerItems?.length ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No line items recorded</TableCell></TableRow>
                      ) : partnerItems.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <p className="font-medium">{item.machine?.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{item.machine?.machine_code}</p>
                          </TableCell>
                          <TableCell className="text-sm">{item.location?.name || `${item.location?.city || ""}, ${item.location?.country || ""}`}</TableCell>
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
