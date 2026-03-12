import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Calendar, MapPin, Trash2, Edit, Cpu, DollarSign, Users } from "lucide-react";
import { MachineAssignmentDialog } from "./shared/MachineAssignmentDialog";

interface EventRental {
  id: string;
  name: string;
  location: string;
  start_date: string;
  end_date: string;
  machines_deployed: number;
  status: string;
  revenue: number | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  event_type: string;
  rental_rate: number | null;
  deposit_amount: number | null;
  client_name: string | null;
  client_company: string | null;
}

const EventsRentals = () => {
  const [open, setOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventRental | null>(null);
  const [machineDialogEvent, setMachineDialogEvent] = useState<EventRental | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    start_date: "",
    end_date: "",
    machines_deployed: 0,
    status: "upcoming",
    revenue: 0,
    contact_email: "",
    contact_phone: "",
    notes: "",
    rental_rate: 0,
    deposit_amount: 0,
    client_name: "",
    client_company: "",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: events, isLoading } = useQuery({
    queryKey: ["event-rentals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("event_type", "rental")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data as EventRental[];
    },
  });

  // Fetch assignment counts
  const { data: assignmentCounts = {} } = useQuery({
    queryKey: ["event-machine-assignment-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_machine_assignments")
        .select("event_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data as any[]).forEach((r) => {
        counts[r.event_id] = (counts[r.event_id] || 0) + 1;
      });
      return counts;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("events").insert([{ ...data, event_type: "rental" }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-rentals"] });
      toast({ title: "Success", description: "Rental created" });
      setOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const { error } = await supabase.from("events").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-rentals"] });
      toast({ title: "Success", description: "Rental updated" });
      setOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-rentals"] });
      toast({ title: "Success", description: "Rental deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "", location: "", start_date: "", end_date: "",
      machines_deployed: 0, status: "upcoming", revenue: 0,
      contact_email: "", contact_phone: "", notes: "",
      rental_rate: 0, deposit_amount: 0, client_name: "", client_company: "",
    });
    setEditingEvent(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (event: EventRental) => {
    setEditingEvent(event);
    setFormData({
      name: event.name,
      location: event.location,
      start_date: event.start_date.split("T")[0],
      end_date: event.end_date.split("T")[0],
      machines_deployed: event.machines_deployed,
      status: event.status,
      revenue: event.revenue || 0,
      contact_email: event.contact_email || "",
      contact_phone: event.contact_phone || "",
      notes: event.notes || "",
      rental_rate: event.rental_rate || 0,
      deposit_amount: event.deposit_amount || 0,
      client_name: event.client_name || "",
      client_company: event.client_company || "",
    });
    setOpen(true);
  };

  const activeEvents = events?.filter((e) => e.status === "active") || [];
  const totalRevenue = events?.reduce((sum, e) => sum + (e.revenue || 0), 0) || 0;

  const statusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-500/10 text-green-500";
      case "upcoming": return "bg-blue-500/10 text-blue-500";
      case "completed": return "bg-muted text-muted-foreground";
      case "cancelled": return "bg-destructive/10 text-destructive";
      default: return "bg-muted text-muted-foreground";
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground mb-2">Private Event Rentals</h2>
          <p className="text-muted-foreground">Manage private event machine rentals (weddings, corporate, parties)</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              New Rental
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingEvent ? "Edit Rental" : "Create New Rental"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Event Name</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                </div>
                <div>
                  <Label>Location / Venue</Label>
                  <Input value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} required />
                </div>
                <div>
                  <Label>Client Name</Label>
                  <Input value={formData.client_name} onChange={(e) => setFormData({ ...formData, client_name: e.target.value })} />
                </div>
                <div>
                  <Label>Client Company</Label>
                  <Input value={formData.client_company} onChange={(e) => setFormData({ ...formData, client_company: e.target.value })} />
                </div>
                <div>
                  <Label>Start Date</Label>
                  <Input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} required />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} required />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Machines Deployed (manual count)</Label>
                  <Input type="number" value={formData.machines_deployed} onChange={(e) => setFormData({ ...formData, machines_deployed: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Rental Rate ($)</Label>
                  <Input type="number" step="0.01" value={formData.rental_rate} onChange={(e) => setFormData({ ...formData, rental_rate: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Deposit ($)</Label>
                  <Input type="number" step="0.01" value={formData.deposit_amount} onChange={(e) => setFormData({ ...formData, deposit_amount: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Revenue ($)</Label>
                  <Input type="number" step="0.01" value={formData.revenue} onChange={(e) => setFormData({ ...formData, revenue: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Contact Email</Label>
                  <Input type="email" value={formData.contact_email} onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label>Contact Phone</Label>
                  <Input value={formData.contact_phone} onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit">{editingEvent ? "Update" : "Create"} Rental</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Rentals</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-foreground">{events?.length || 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-green-500">{activeEvents.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Machines Assigned</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-foreground">{Object.values(assignmentCounts).reduce((a, b) => a + b, 0)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-foreground">${totalRevenue.toLocaleString()}</p></CardContent>
        </Card>
      </div>

      {/* Events List */}
      <Card>
        <CardHeader><CardTitle>All Rentals</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            {events?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No private event rentals yet.</p>
            ) : (
              events?.map((event) => (
                <div key={event.id} className="flex items-start justify-between border-b border-border pb-4 gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <h3 className="font-semibold text-foreground">{event.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(event.status)}`}>
                        {event.status}
                      </span>
                    </div>
                    {(event.client_name || event.client_company) && (
                      <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {[event.client_name, event.client_company].filter(Boolean).join(" — ")}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {event.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(event.start_date).toLocaleDateString()} – {new Date(event.end_date).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Cpu className="w-3.5 h-3.5" />
                        {assignmentCounts[event.id] || 0} assigned
                      </span>
                      {(event.revenue ?? 0) > 0 && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3.5 h-3.5" />
                          ${(event.revenue ?? 0).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => setMachineDialogEvent(event)} title="Assign machines">
                      <Cpu className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(event)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => deleteMutation.mutate(event.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Machine Assignment Dialog */}
      {machineDialogEvent && (
        <MachineAssignmentDialog
          open={!!machineDialogEvent}
          onOpenChange={(o) => !o && setMachineDialogEvent(null)}
          entityType="event"
          entityId={machineDialogEvent.id}
          entityName={machineDialogEvent.name}
        />
      )}
    </div>
  );
};

export default EventsRentals;
