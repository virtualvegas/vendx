import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Mail, Package, Truck, CheckCircle2, AlertCircle, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { formatDisplayDate } from "@/lib/dateUtils";

interface Order {
  id: string;
  order_number: string;
  status: string;
  fulfillment_status: string;
  tracking_number: string | null;
  tracking_url: string | null;
  carrier: string | null;
  estimated_delivery: string | null;
  admin_notes: string | null;
  customer_visible_note: string | null;
  customer_notified_at: string | null;
  customer_email: string | null;
  customer_name: string | null;
}

const CARRIERS = ["UPS", "USPS", "FedEx", "DHL", "Canada Post", "Local Courier", "Other"];

const eventIcon = (type: string) => {
  if (type === "order_created") return <Package className="w-4 h-4" />;
  if (type === "tracking_added") return <Truck className="w-4 h-4" />;
  if (type === "fulfillment_changed") return <CheckCircle2 className="w-4 h-4" />;
  return <AlertCircle className="w-4 h-4" />;
};

interface Props {
  orderId: string;
  onSaved?: () => void;
}

export const OrderTimelinePanel = ({ orderId, onSaved }: Props) => {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<Order>>({});
  const [noteCustomerVisible, setNoteCustomerVisible] = useState(true);
  const [eventNote, setEventNote] = useState("");

  const { data: order, isLoading } = useQuery({
    queryKey: ["store-order-detail", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_orders")
        .select("id, order_number, status, fulfillment_status, tracking_number, tracking_url, carrier, estimated_delivery, admin_notes, customer_visible_note, customer_notified_at, customer_email, customer_name")
        .eq("id", orderId)
        .single();
      if (error) throw error;
      return data as Order;
    },
  });

  const { data: events } = useQuery({
    queryKey: ["store-order-events", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_order_events")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => { if (order) setForm(order); }, [order]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("store_orders")
        .update({
          status: form.status,
          fulfillment_status: form.fulfillment_status,
          carrier: form.carrier,
          tracking_number: form.tracking_number,
          tracking_url: form.tracking_url,
          estimated_delivery: form.estimated_delivery,
          admin_notes: form.admin_notes,
          customer_visible_note: form.customer_visible_note,
        })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store-order-detail", orderId] });
      qc.invalidateQueries({ queryKey: ["store-order-events", orderId] });
      onSaved?.();
      toast.success("Order updated");
    },
    onError: (e: any) => toast.error("Failed", { description: e.message }),
  });

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("store_order_events").insert({
        order_id: orderId,
        event_type: "note_added",
        status: form.status,
        note: eventNote,
        customer_visible: noteCustomerVisible,
        actor_id: user?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store-order-events", orderId] });
      setEventNote("");
      toast.success("Note added to timeline");
    },
  });

  const notifyMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("store_orders")
        .update({ customer_notified_at: new Date().toISOString() })
        .eq("id", orderId);
      if (error) throw error;
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("store_order_events").insert({
        order_id: orderId,
        event_type: "customer_notified",
        status: form.status,
        note: "Customer notification sent",
        customer_visible: false,
        actor_id: user?.id || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store-order-detail", orderId] });
      qc.invalidateQueries({ queryKey: ["store-order-events", orderId] });
      toast.success("Marked as notified");
    },
  });

  if (isLoading || !order) return <Loader2 className="animate-spin mx-auto my-8" />;

  return (
    <div className="space-y-6">
      {/* Status + Fulfillment */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Order Status</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Fulfillment</Label>
          <Select value={form.fulfillment_status} onValueChange={(v) => setForm({ ...form, fulfillment_status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unfulfilled">Unfulfilled</SelectItem>
              <SelectItem value="picking">Picking</SelectItem>
              <SelectItem value="packed">Packed</SelectItem>
              <SelectItem value="handed_to_carrier">Handed to Carrier</SelectItem>
              <SelectItem value="in_transit">In Transit</SelectItem>
              <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="returned">Returned</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Shipping */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Carrier</Label>
          <Select value={form.carrier || ""} onValueChange={(v) => setForm({ ...form, carrier: v })}>
            <SelectTrigger><SelectValue placeholder="Select carrier..." /></SelectTrigger>
            <SelectContent>{CARRIERS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Estimated Delivery</Label>
          <Input type="date" value={form.estimated_delivery || ""} onChange={e => setForm({ ...form, estimated_delivery: e.target.value })} />
        </div>
        <div>
          <Label>Tracking Number</Label>
          <Input value={form.tracking_number || ""} onChange={e => setForm({ ...form, tracking_number: e.target.value })} />
        </div>
        <div>
          <Label>Tracking URL</Label>
          <Input value={form.tracking_url || ""} onChange={e => setForm({ ...form, tracking_url: e.target.value })} placeholder="https://..." />
        </div>
      </div>

      {/* Notes */}
      <div className="grid gap-3">
        <div>
          <Label>Internal Notes (admins only)</Label>
          <Textarea value={form.admin_notes || ""} onChange={e => setForm({ ...form, admin_notes: e.target.value })} />
        </div>
        <div>
          <Label>Customer-Visible Note</Label>
          <Textarea value={form.customer_visible_note || ""} onChange={e => setForm({ ...form, customer_visible_note: e.target.value })} placeholder="Shown to the customer in their order page" />
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="flex-1">
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
        </Button>
        <Button variant="outline" onClick={() => notifyMutation.mutate()} disabled={notifyMutation.isPending}>
          <Mail className="w-4 h-4 mr-2" />
          {order.customer_notified_at ? "Re-notify" : "Mark Notified"}
        </Button>
      </div>
      {order.customer_notified_at && (
        <p className="text-xs text-muted-foreground">Last notified: {formatDisplayDate(order.customer_notified_at)}</p>
      )}

      {/* Add note to timeline */}
      <Card className="border-primary/30">
        <CardContent className="p-4 space-y-3">
          <Label>Add timeline note</Label>
          <Textarea value={eventNote} onChange={e => setEventNote(e.target.value)} placeholder="e.g. Called customer to confirm address" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch checked={noteCustomerVisible} onCheckedChange={setNoteCustomerVisible} />
              <Label className="text-sm">Visible to customer</Label>
            </div>
            <Button size="sm" onClick={() => addNoteMutation.mutate()} disabled={!eventNote || addNoteMutation.isPending}>
              <Send className="w-3 h-3 mr-2" />Add Note
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <div>
        <h3 className="font-semibold mb-3">Timeline</h3>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {events?.length ? events.map((ev: any) => (
            <div key={ev.id} className="flex gap-3 p-3 rounded-lg border border-border bg-card/50">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                {eventIcon(ev.event_type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium capitalize text-sm">{ev.event_type.replace(/_/g, " ")}</span>
                  {ev.status && <Badge variant="outline" className="text-xs">{ev.status}</Badge>}
                  {ev.customer_visible && <Badge className="text-[10px] bg-blue-500/20 text-blue-400 border-blue-500/30">Customer sees</Badge>}
                </div>
                {ev.note && <p className="text-sm text-muted-foreground mt-1">{ev.note}</p>}
                <p className="text-xs text-muted-foreground mt-1">{formatDisplayDate(ev.created_at)}</p>
              </div>
            </div>
          )) : <p className="text-sm text-muted-foreground text-center py-4">No events yet</p>}
        </div>
      </div>
    </div>
  );
};
