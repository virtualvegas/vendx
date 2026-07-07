import { useState } from "react";
import { useMyFranchise } from "@/hooks/useMyFranchise";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, MessageCircle, Send } from "lucide-react";
import { format } from "date-fns";

const priorityColor: Record<string, any> = { low: "outline", normal: "secondary", high: "default", urgent: "destructive" };

const FranchiseSupport = () => {
  const { data: franchise } = useMyFranchise();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [reply, setReply] = useState("");
  const [form, setForm] = useState({ subject: "", description: "", priority: "normal", category: "general" });

  const tickets = useQuery({
    queryKey: ["franchise-tickets", franchise?.id],
    enabled: !!franchise?.id,
    queryFn: async () => {
      const { data } = await supabase.from("vendx_franchise_support_tickets" as any)
        .select("*").eq("franchise_id", franchise.id).order("created_at", { ascending: false });
      return (data || []) as any[];
    },
  });

  const messages = useQuery({
    queryKey: ["franchise-ticket-messages", selected?.id],
    enabled: !!selected?.id,
    queryFn: async () => {
      const { data } = await supabase.from("vendx_franchise_support_messages" as any)
        .select("*").eq("ticket_id", selected.id).order("created_at");
      return (data || []) as any[];
    },
  });

  const createTicket = async () => {
    if (!franchise?.id || !form.subject.trim()) return toast({ title: "Subject required", variant: "destructive" });
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("vendx_franchise_support_tickets" as any).insert({
      franchise_id: franchise.id, created_by: user?.id,
      subject: form.subject, description: form.description, priority: form.priority, category: form.category, status: "open",
    });
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Ticket created" });
    setOpen(false); setForm({ subject: "", description: "", priority: "normal", category: "general" });
    qc.invalidateQueries({ queryKey: ["franchise-tickets"] });
  };

  const sendReply = async () => {
    if (!selected?.id || !reply.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("vendx_franchise_support_messages" as any).insert({
      ticket_id: selected.id, sender_id: user?.id, sender_type: "franchise", message: reply,
    });
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    setReply("");
    qc.invalidateQueries({ queryKey: ["franchise-ticket-messages", selected.id] });
  };

  if (!franchise) return <div className="p-6 text-muted-foreground">Complete your franchise application first.</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Franchise Support</h1>
          <p className="text-sm text-muted-foreground">Get help from your VendX franchise team.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />New Ticket</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Open Support Ticket</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Subject *</Label><Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Category</Label>
                  <select className="w-full border rounded-md p-2 bg-background" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                    <option value="general">General</option><option value="machine">Machine / Hardware</option><option value="orders">Orders / Restocking</option>
                    <option value="payouts">Payouts / Billing</option><option value="territory">Territory</option><option value="onboarding">Onboarding</option>
                  </select>
                </div>
                <div><Label>Priority</Label>
                  <select className="w-full border rounded-md p-2 bg-background" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                    <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div><Label>Description</Label><Textarea rows={5} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <Button onClick={createTicket} className="w-full">Submit</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>Your Tickets</CardTitle></CardHeader>
        <CardContent>
          {tickets.isLoading ? <Loader2 className="animate-spin" /> :
            !tickets.data?.length ? <p className="text-sm text-muted-foreground">No tickets yet.</p> :
              <div className="space-y-1">
                {tickets.data.map((t: any) => (
                  <button key={t.id} onClick={() => setSelected(t)} className="w-full flex items-center justify-between p-3 rounded border hover:bg-muted text-left">
                    <div>
                      <div className="font-medium">{t.subject}</div>
                      <div className="text-xs text-muted-foreground">{t.category} · {format(new Date(t.created_at), "PP")}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={priorityColor[t.priority] || "outline"}>{t.priority}</Badge>
                      <Badge variant={t.status === "closed" ? "outline" : t.status === "resolved" ? "default" : "secondary"}>{t.status}</Badge>
                    </div>
                  </button>
                ))}
              </div>}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={o => { if (!o) { setSelected(null); setReply(""); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><MessageCircle className="h-5 w-5" />{selected?.subject}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground border-b pb-2">{selected.description || <em>No description.</em>}</div>
              <div className="max-h-[300px] overflow-y-auto space-y-2">
                {messages.isLoading ? <Loader2 className="animate-spin" /> :
                  (messages.data || []).map((m: any) => (
                    <div key={m.id} className={`p-2 rounded text-sm ${m.sender_type === "franchise" ? "bg-primary/10 ml-8" : "bg-muted mr-8"}`}>
                      <div className="text-xs text-muted-foreground mb-1">{m.sender_type === "franchise" ? "You" : "VendX Support"} · {format(new Date(m.created_at), "PPp")}</div>
                      <div className="whitespace-pre-wrap">{m.message}</div>
                    </div>
                  ))}
              </div>
              {selected.status !== "closed" && (
                <div className="flex gap-2">
                  <Textarea rows={2} value={reply} onChange={e => setReply(e.target.value)} placeholder="Type a reply..." />
                  <Button onClick={sendReply} disabled={!reply.trim()}><Send className="h-4 w-4" /></Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FranchiseSupport;
