import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Gamepad2, Eye, Trash2, Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { formatDisplayDate } from "@/lib/dateUtils";

const STATUSES = ["new", "reviewing", "quoted", "accepted", "declined", "completed"];
const statusColor: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  reviewing: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  quoted: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  accepted: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  declined: "bg-rose-500/20 text-rose-300 border-rose-500/40",
  completed: "bg-primary/20 text-primary border-primary/40",
};

const BLANK = {
  isNew: true,
  full_name: "", email: "", phone: "", country: "USA",
  address_line1: "", address_line2: "", city: "", state: "", postal_code: "",
  cabinet_style: "upright", cabinet_size: "full", control_layout: "2p",
  monitor_size: "32", artwork_theme: "", trackball: false, spinner: false, light_gun: false,
  preferred_platforms: [] as string[], approx_game_count: "", preferred_games: "",
  online_play: false, in_home_setup: false, financing_interest: false,
  budget_range: "", target_delivery_date: "", additional_notes: "",
  status: "new", admin_notes: "", quoted_price: "",
};

const CustomArcadeRequestsPanel = () => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["custom-arcade-requests", statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("vendx_custom_arcade_requests")
        .select("*, reference_product:store_products(name, slug)")
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const openCreate = () => { setEditing({ ...BLANK }); setOpen(true); };
  const openEdit = (row: any) => { setEditing({ ...row, isNew: false }); setOpen(true); };

  const save = async () => {
    if (!editing) return;
    if (editing.isNew) {
      if (!editing.full_name?.trim() || !editing.email?.trim()) {
        return toast.error("Name and email are required");
      }
      const { isNew, quoted_price, target_delivery_date, approx_game_count, ...rest } = editing;
      const { data: { user } } = await supabase.auth.getUser();
      const payload: any = {
        ...rest,
        user_id: user?.id || null,
        quoted_price: quoted_price ? Number(quoted_price) : null,
        target_delivery_date: target_delivery_date || null,
        approx_game_count: approx_game_count ? Number(approx_game_count) : null,
        quoted_at: rest.status === "quoted" ? new Date().toISOString() : null,
      };
      const { error } = await supabase.from("vendx_custom_arcade_requests").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Request created");
    } else {
      const { error } = await supabase
        .from("vendx_custom_arcade_requests")
        .update({
          status: editing.status,
          admin_notes: editing.admin_notes,
          quoted_price: editing.quoted_price ? Number(editing.quoted_price) : null,
          quoted_at: editing.status === "quoted" ? new Date().toISOString() : editing.quoted_at,
        })
        .eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Saved");
    }
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["custom-arcade-requests"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this request?")) return;
    const { error } = await supabase.from("vendx_custom_arcade_requests").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["custom-arcade-requests"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Gamepad2 className="w-5 h-5 text-primary" /> Custom Arcade Requests</h2>
          <p className="text-sm text-muted-foreground">Inquiries submitted from the public custom multicade request form.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={openCreate} className="gap-1"><Plus className="w-4 h-4" /> New Request</Button>
        </div>
      </div>

      {isLoading ? (
        <Card className="p-8 text-center text-muted-foreground">Loading...</Card>
      ) : !data?.length ? (
        <Card className="p-8 text-center text-muted-foreground">No requests yet.</Card>
      ) : (
        <div className="space-y-2">
          {data.map((r: any) => (
            <Card key={r.id} className="p-4 hover:border-primary/40 transition-colors">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-mono text-xs text-muted-foreground">{r.request_number}</span>
                    <Badge className={`capitalize ${statusColor[r.status] || ""}`}>{r.status}</Badge>
                    {r.reference_product && (
                      <Badge variant="outline" className="text-xs">ref: {r.reference_product.name}</Badge>
                    )}
                  </div>
                  <div className="font-semibold">{r.full_name} · <span className="text-muted-foreground font-normal">{r.email}</span></div>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>{r.cabinet_style} · {r.cabinet_size} · {r.control_layout} · {r.monitor_size}"</span>
                    <span>Budget: {r.budget_range}</span>
                    {r.city && <span>{r.city}, {r.state}</span>}
                    <span>{formatDisplayDate(r.created_at, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(r)} className="gap-1"><Eye className="w-3.5 h-3.5" /> View</Button>
                  <Button size="sm" variant="outline" onClick={() => remove(r.id)} className="gap-1 text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request {editing?.request_number}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <Info label="Name" v={editing.full_name} />
                <Info label="Email" v={editing.email} />
                <Info label="Phone" v={editing.phone} />
                <Info label="Country" v={editing.country} />
                <Info label="Address" v={[editing.address_line1, editing.address_line2, editing.city, editing.state, editing.postal_code].filter(Boolean).join(", ")} />
              </div>
              <div className="border-t pt-3 grid md:grid-cols-2 gap-4 text-sm">
                <Info label="Cabinet" v={`${editing.cabinet_style} / ${editing.cabinet_size}`} />
                <Info label="Controls" v={`${editing.control_layout}${editing.trackball ? " + trackball" : ""}${editing.spinner ? " + spinner" : ""}${editing.light_gun ? " + light gun" : ""}`} />
                <Info label="Monitor" v={`${editing.monitor_size}"`} />
                <Info label="Artwork theme" v={editing.artwork_theme} />
                <Info label="Platforms" v={(editing.preferred_platforms || []).join(", ")} />
                <Info label="Approx games" v={editing.approx_game_count} />
                <Info label="Online play" v={editing.online_play ? "Yes" : "No"} />
                <Info label="In-home setup" v={editing.in_home_setup ? "Yes" : "No"} />
                <Info label="Financing" v={editing.financing_interest ? "Yes" : "No"} />
                <Info label="Budget" v={editing.budget_range} />
                <Info label="Target delivery" v={editing.target_delivery_date} />
              </div>
              {editing.preferred_games && (
                <div className="text-sm">
                  <div className="text-muted-foreground mb-1">Must-have games / notes</div>
                  <div className="whitespace-pre-wrap p-3 bg-muted/40 rounded">{editing.preferred_games}</div>
                </div>
              )}
              {editing.additional_notes && (
                <div className="text-sm">
                  <div className="text-muted-foreground mb-1">Additional notes</div>
                  <div className="whitespace-pre-wrap p-3 bg-muted/40 rounded">{editing.additional_notes}</div>
                </div>
              )}

              <div className="border-t pt-4 grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1.5 block">Status</Label>
                  <Select value={editing.status} onValueChange={v => setEditing({ ...editing, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 block">Quoted price ($)</Label>
                  <Input type="number" step="0.01" value={editing.quoted_price ?? ""} onChange={e => setEditing({ ...editing, quoted_price: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Label className="mb-1.5 block">Admin notes</Label>
                  <Textarea rows={4} value={editing.admin_notes ?? ""} onChange={e => setEditing({ ...editing, admin_notes: e.target.value })} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Info = ({ label, v }: { label: string; v: any }) => (
  <div>
    <div className="text-muted-foreground text-xs">{label}</div>
    <div className="font-medium">{v || "—"}</div>
  </div>
);

export default CustomArcadeRequestsPanel;
