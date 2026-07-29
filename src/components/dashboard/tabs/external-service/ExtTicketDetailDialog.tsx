import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Switch } from "@/components/ui/switch";
import { Calendar, CheckCircle2, MessageSquare, RotateCcw, DollarSign, Clock, User, CalendarPlus, Link2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { formatDisplayDate } from "@/lib/dateUtils";

interface Props {
  ticketId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const STATUS = ["new","scheduled","in_progress","on_hold","completed","invoiced","cancelled"];

const ExtTicketDetailDialog = ({ ticketId, open, onOpenChange }: Props) => {
  const qc = useQueryClient();
  const [tab, setTab] = useState("overview");
  const [reschedDate, setReschedDate] = useState("");
  const [reschedTime, setReschedTime] = useState("");
  const [reschedReason, setReschedReason] = useState("");
  const [resolution, setResolution] = useState("");
  const [techNotes, setTechNotes] = useState("");
  const [laborHours, setLaborHours] = useState<string>("");
  const [laborCost, setLaborCost] = useState<string>("");
  const [partsCost, setPartsCost] = useState<string>("");
  const [actualDur, setActualDur] = useState<string>("");
  const [newComment, setNewComment] = useState("");
  const [commentInternal, setCommentInternal] = useState(true);
  const [fuDate, setFuDate] = useState("");
  const [fuTime, setFuTime] = useState("");
  const [fuSubject, setFuSubject] = useState("");
  const [fuNotes, setFuNotes] = useState("");

  const { data: t } = useQuery({
    queryKey: ["ext-ticket-detail", ticketId],
    queryFn: async () => {
      if (!ticketId) return null;
      const { data } = await supabase.from("vendx_external_service_tickets" as any)
        .select("*, client:vendx_external_clients(id,company_name,contact_name), location:vendx_external_locations(name), machine:vendx_external_machines(asset_label)")
        .eq("id", ticketId).maybeSingle();
      return data as any;
    },
    enabled: !!ticketId && open,
  });

  const { data: updates = [] } = useQuery({
    queryKey: ["ext-ticket-updates", ticketId],
    queryFn: async () => {
      const { data } = await supabase.from("vendx_external_service_ticket_updates" as any)
        .select("*").eq("ticket_id", ticketId).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!ticketId && open,
  });

  const { data: techs = [] } = useQuery({
    queryKey: ["ext-techs"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,full_name,email").order("full_name");
      return data || [];
    },
    enabled: open,
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ["ext-schedules-for-ticket", t?.client_id],
    queryFn: async () => {
      let q = supabase.from("vendx_external_service_schedules" as any).select("id,title,frequency,next_run_date,client_id").order("next_run_date", { ascending: true, nullsFirst: false });
      if (t?.client_id) q = q.eq("client_id", t.client_id);
      const { data } = await q;
      return data || [];
    },
    enabled: !!t && open,
  });

  const { data: followUps = [] } = useQuery({
    queryKey: ["ext-ticket-followups", ticketId],
    queryFn: async () => {
      const { data } = await supabase.from("vendx_external_service_tickets" as any)
        .select("id,ticket_number,subject,status,scheduled_date,scheduled_time")
        .eq("parent_ticket_id", ticketId).order("scheduled_date", { ascending: true, nullsFirst: false });
      return data || [];
    },
    enabled: !!ticketId && open,
  });

  const { data: parent } = useQuery({
    queryKey: ["ext-ticket-parent", t?.parent_ticket_id],
    queryFn: async () => {
      if (!t?.parent_ticket_id) return null;
      const { data } = await supabase.from("vendx_external_service_tickets" as any)
        .select("id,ticket_number,subject").eq("id", t.parent_ticket_id).maybeSingle();
      return data as any;
    },
    enabled: !!t?.parent_ticket_id && open,
  });

  useEffect(() => {
    if (t) {
      setResolution(t.resolution || "");
      setTechNotes(t.technician_notes || "");
      setLaborHours(t.labor_hours?.toString() || "");
      setLaborCost(t.labor_cost?.toString() || "");
      setPartsCost(t.parts_cost?.toString() || "");
      setActualDur(t.actual_duration_minutes?.toString() || "");
      setReschedDate(t.scheduled_date || "");
      setReschedTime(t.scheduled_time || "");
      setReschedReason("");
    }
  }, [t?.id]);

  if (!t) return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent /></Dialog>;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["ext-ticket-detail", ticketId] });
    qc.invalidateQueries({ queryKey: ["ext-ticket-updates", ticketId] });
    qc.invalidateQueries({ queryKey: ["ext-tickets"] });
  };

  const doReschedule = async () => {
    if (!reschedDate) { toast.error("Pick a date"); return; }
    const { error } = await supabase.from("vendx_external_service_tickets" as any)
      .update({ scheduled_date: reschedDate, scheduled_time: reschedTime || null, status: t.status === "new" ? "scheduled" : t.status })
      .eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    if (reschedReason) {
      await supabase.from("vendx_external_service_ticket_updates" as any).insert({
        ticket_id: t.id, message: `Reschedule reason: ${reschedReason}`, is_internal: true, status_change: "rescheduled",
      });
    }
    toast.success("Rescheduled");
    invalidate();
  };

  const setStatus = async (status: string) => {
    const { error } = await supabase.from("vendx_external_service_tickets" as any).update({ status }).eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success(`Status → ${status}`);
    invalidate();
  };

  const assign = async (uid: string) => {
    const { error } = await supabase.from("vendx_external_service_tickets" as any)
      .update({ assigned_technician_id: uid || null }).eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("Technician assigned");
    invalidate();
  };

  const saveResolution = async (markComplete: boolean) => {
    const payload: any = {
      resolution, technician_notes: techNotes,
      labor_hours: laborHours ? Number(laborHours) : null,
      labor_cost: laborCost ? Number(laborCost) : null,
      parts_cost: partsCost ? Number(partsCost) : null,
      actual_duration_minutes: actualDur ? parseInt(actualDur, 10) : null,
    };
    if (markComplete) payload.status = "completed";
    const { error } = await supabase.from("vendx_external_service_tickets" as any).update(payload).eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success(markComplete ? "Marked completed" : "Resolution saved");
    invalidate();
  };

  const postComment = async () => {
    if (!newComment.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("vendx_external_service_ticket_updates" as any).insert({
      ticket_id: t.id, message: newComment.trim(), is_internal: commentInternal, author_id: user?.id,
    });
    if (error) return toast.error(error.message);
    setNewComment("");
    qc.invalidateQueries({ queryKey: ["ext-ticket-updates", ticketId] });
  };

  const linkSchedule = async (scheduleId: string) => {
    const { error } = await supabase.from("vendx_external_service_tickets" as any)
      .update({ schedule_id: scheduleId || null }).eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success(scheduleId ? "Linked to schedule" : "Unlinked from schedule");
    invalidate();
  };

  const createFollowUp = async () => {
    if (!fuSubject.trim()) { toast.error("Subject required"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const payload: any = {
      parent_ticket_id: t.id,
      client_id: t.client_id, location_id: t.location_id, machine_id: t.machine_id,
      subject: fuSubject.trim(),
      description: fuNotes.trim() || `Follow-up to ${t.ticket_number}`,
      priority: t.priority, status: fuDate ? "scheduled" : "new", source: "admin",
      scheduled_date: fuDate || null, scheduled_time: fuTime || null,
      assigned_technician_id: t.assigned_technician_id,
      service_package: t.service_package, service_location_type: t.service_location_type,
      access_notes: t.access_notes, has_stairs: t.has_stairs,
      created_by: user?.id,
    };
    const { error } = await supabase.from("vendx_external_service_tickets" as any).insert(payload);
    if (error) return toast.error(error.message);
    await supabase.from("vendx_external_service_ticket_updates" as any).insert({
      ticket_id: t.id, message: `Follow-up visit scheduled${fuDate ? ` for ${fuDate}` : ""}: ${fuSubject}`,
      is_internal: true, status_change: "follow_up_created", author_id: user?.id,
    });
    toast.success("Follow-up created");
    setFuDate(""); setFuTime(""); setFuSubject(""); setFuNotes("");
    qc.invalidateQueries({ queryKey: ["ext-ticket-followups", ticketId] });
    qc.invalidateQueries({ queryKey: ["ext-tickets"] });
    invalidate();
  };

  const totalCost = (Number(t.labor_cost || 0) + Number(t.parts_cost || 0)).toFixed(2);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs">{t.ticket_number}</span>
            <span>{t.subject}</span>
            <Badge>{t.status}</Badge>
            <Badge variant="outline">{t.priority}</Badge>
            {t.reschedule_count > 0 && <Badge variant="secondary" className="gap-1"><RotateCcw className="w-3 h-3" /> {t.reschedule_count}× rescheduled</Badge>}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {t.client?.company_name || t.client?.contact_name || t.intake_company_name || "Unassigned"}
            {t.location?.name && ` · ${t.location.name}`}
            {t.machine?.asset_label && ` · ${t.machine.asset_label}`}
          </p>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 pb-3 border-b">
          {STATUS.filter(s => s !== t.status).map(s => (
            <Button key={s} size="sm" variant="outline" onClick={() => setStatus(s)}>{s}</Button>
          ))}
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-5">
            <TabsTrigger value="overview"><Calendar className="w-3.5 h-3.5 mr-1" /> Overview</TabsTrigger>
            <TabsTrigger value="reschedule"><RotateCcw className="w-3.5 h-3.5 mr-1" /> Reschedule</TabsTrigger>
            <TabsTrigger value="resolve"><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Resolve</TabsTrigger>
            <TabsTrigger value="followups"><CalendarPlus className="w-3.5 h-3.5 mr-1" /> Follow-ups ({followUps.length})</TabsTrigger>
            <TabsTrigger value="activity"><MessageSquare className="w-3.5 h-3.5 mr-1" /> Activity ({updates.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-3 pt-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <StatBox icon={<Calendar className="w-3 h-3" />} label="Scheduled" value={t.scheduled_date ? formatDisplayDate(t.scheduled_date) : "—"} sub={t.scheduled_time || undefined} />
              <StatBox icon={<Clock className="w-3 h-3" />} label="Est. duration" value={t.estimated_duration_minutes ? `${t.estimated_duration_minutes} min` : "—"} />
              <StatBox icon={<Clock className="w-3 h-3" />} label="Actual" value={t.actual_duration_minutes ? `${t.actual_duration_minutes} min` : "—"} />
              <StatBox icon={<DollarSign className="w-3 h-3" />} label="Total cost" value={`$${totalCost}`} />
            </div>
            {t.original_scheduled_date && t.original_scheduled_date !== t.scheduled_date && (
              <p className="text-xs text-muted-foreground">Originally scheduled: {formatDisplayDate(t.original_scheduled_date)}</p>
            )}
            <div>
              <Label className="text-xs">Assigned technician</Label>
              <SearchableSelect value={t.assigned_technician_id || ""} onValueChange={assign}
                options={[{ value: "", label: "Unassigned" }, ...techs.map((u: any) => ({ value: u.id, label: u.full_name || u.email }))]}
                placeholder="Assign" searchPlaceholder="Search staff..." />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1"><Link2 className="w-3 h-3" /> Linked recurring schedule</Label>
              <SearchableSelect value={t.schedule_id || ""} onValueChange={linkSchedule}
                options={[{ value: "", label: "— Not linked" }, ...schedules.map((s: any) => ({ value: s.id, label: `${s.title} (${s.frequency}${s.next_run_date ? ` · next ${formatDisplayDate(s.next_run_date)}` : ""})` }))]}
                placeholder="Link to a schedule" searchPlaceholder="Search schedules..." />
              {schedules.length === 0 && <p className="text-[10px] text-muted-foreground mt-1">No schedules for this client yet.</p>}
            </div>
            {parent && (
              <div className="text-xs bg-muted/40 rounded p-2 flex items-center justify-between gap-2">
                <span>Follow-up of <span className="font-mono">{parent.ticket_number}</span> — {parent.subject}</span>
                <Button size="sm" variant="ghost" onClick={() => { onOpenChange(false); setTimeout(() => window.dispatchEvent(new CustomEvent("open-ext-ticket", { detail: parent.id })), 100); }}>
                  <ExternalLink className="w-3 h-3" />
                </Button>
              </div>
            )}
            {t.description && <div><Label className="text-xs">Description</Label><p className="text-sm whitespace-pre-wrap">{t.description}</p></div>}
            {t.access_notes && <div><Label className="text-xs">Access notes</Label><p className="text-sm whitespace-pre-wrap">{t.access_notes}</p></div>}
            {t.resolution && <div><Label className="text-xs">Resolution</Label><p className="text-sm whitespace-pre-wrap">{t.resolution}</p></div>}
          </TabsContent>

          <TabsContent value="followups" className="space-y-3 pt-3">
            <Card className="p-3 space-y-3">
              <p className="text-xs font-semibold flex items-center gap-1"><CalendarPlus className="w-3.5 h-3.5" /> Schedule a follow-up visit</p>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Date</Label><Input type="date" value={fuDate} onChange={e => setFuDate(e.target.value)} /></div>
                <div><Label className="text-xs">Time</Label><Input type="time" value={fuTime} onChange={e => setFuTime(e.target.value)} /></div>
              </div>
              <div><Label className="text-xs">Subject *</Label><Input value={fuSubject} onChange={e => setFuSubject(e.target.value)} placeholder="Return visit — replace part" /></div>
              <div><Label className="text-xs">Notes</Label><Textarea rows={2} value={fuNotes} onChange={e => setFuNotes(e.target.value)} placeholder="What needs to happen on the follow-up" /></div>
              <Button size="sm" onClick={createFollowUp}><CalendarPlus className="w-4 h-4 mr-1" /> Create follow-up ticket</Button>
            </Card>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Existing follow-ups</p>
              {followUps.length === 0 && <p className="text-sm text-muted-foreground">No follow-up visits yet.</p>}
              {followUps.map((f: any) => (
                <Card key={f.id} className="p-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs">{f.ticket_number}</span>
                      <Badge variant="outline" className="text-[10px]">{f.status}</Badge>
                      {f.scheduled_date && <span className="text-[11px] text-muted-foreground">{formatDisplayDate(f.scheduled_date)}{f.scheduled_time ? ` @ ${f.scheduled_time.slice(0,5)}` : ""}</span>}
                    </div>
                    <p className="text-sm truncate">{f.subject}</p>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="reschedule" className="space-y-3 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>New date</Label><Input type="date" value={reschedDate} onChange={e => setReschedDate(e.target.value)} /></div>
              <div><Label>Time (optional)</Label><Input type="time" value={reschedTime} onChange={e => setReschedTime(e.target.value)} /></div>
            </div>
            <div><Label>Reason (logged to activity)</Label><Textarea rows={2} value={reschedReason} onChange={e => setReschedReason(e.target.value)} placeholder="Customer requested / technician unavailable / parts delayed..." /></div>
            <Button onClick={doReschedule}><RotateCcw className="w-4 h-4 mr-2" /> Reschedule ticket</Button>
          </TabsContent>

          <TabsContent value="resolve" className="space-y-3 pt-3">
            <div><Label>Resolution / what was done *</Label><Textarea rows={4} value={resolution} onChange={e => setResolution(e.target.value)} placeholder="Replaced power supply, cleaned board, tested all inputs..." /></div>
            <div><Label>Technician notes (internal)</Label><Textarea rows={2} value={techNotes} onChange={e => setTechNotes(e.target.value)} /></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><Label className="text-xs">Actual minutes</Label><Input type="number" value={actualDur} onChange={e => setActualDur(e.target.value)} /></div>
              <div><Label className="text-xs">Labor hours</Label><Input type="number" step="0.25" value={laborHours} onChange={e => setLaborHours(e.target.value)} /></div>
              <div><Label className="text-xs">Labor cost</Label><Input type="number" step="0.01" value={laborCost} onChange={e => setLaborCost(e.target.value)} /></div>
              <div><Label className="text-xs">Parts cost</Label><Input type="number" step="0.01" value={partsCost} onChange={e => setPartsCost(e.target.value)} /></div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => saveResolution(false)}>Save draft</Button>
              <Button onClick={() => saveResolution(true)}><CheckCircle2 className="w-4 h-4 mr-2" /> Save & mark completed</Button>
            </div>
          </TabsContent>

          <TabsContent value="activity" className="space-y-3 pt-3">
            <div className="space-y-2">
              <Textarea rows={2} value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Add an update..." />
              <div className="flex items-center gap-3 justify-between flex-wrap">
                <div className="flex items-center gap-2">
                  <Switch checked={commentInternal} onCheckedChange={setCommentInternal} id="internal-toggle" />
                  <Label htmlFor="internal-toggle" className="text-xs cursor-pointer">Internal only (hidden from client)</Label>
                </div>
                <Button size="sm" onClick={postComment}>Post update</Button>
              </div>
            </div>
            <div className="space-y-1.5">
              {updates.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
              {updates.map((u: any) => (
                <Card key={u.id} className={`p-2.5 ${u.is_internal ? "border-amber-500/30 bg-amber-500/5" : ""}`}>
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      {u.status_change && <Badge variant="outline" className="text-[10px] mb-1">{u.status_change}</Badge>}
                      <p className="text-sm whitespace-pre-wrap">{u.message}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{formatDisplayDate(u.created_at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                  </div>
                  {u.is_internal && <span className="text-[10px] text-amber-500">Internal</span>}
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const StatBox = ({ icon, label, value, sub }: any) => (
  <Card className="p-2">
    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">{icon} {label}</div>
    <div className="text-sm font-semibold">{value}</div>
    {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
  </Card>
);

export default ExtTicketDetailDialog;
