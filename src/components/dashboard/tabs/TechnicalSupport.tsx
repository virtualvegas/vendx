import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, AlertTriangle, Trash2, Edit, CheckCircle } from "lucide-react";

interface SupportTicket {
  id: string;
  ticket_number: string;
  machine_id: string;
  location: string;
  issue_type: string;
  priority: string;
  status: string;
  description: string;
  resolution: string | null;
  created_at: string;
  resolved_at: string | null;
}

const TechnicalSupport = () => {
  const [open, setOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<SupportTicket | null>(null);
  const [formData, setFormData] = useState({
    machine_id: "",
    location: "",
    issue_type: "",
    priority: "medium",
    description: "",
    resolution: "",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["support-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SupportTicket[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const ticketNumber = `TKT-${Date.now()}`;
      const { error } = await supabase.from("support_tickets").insert([{
        ...data,
        ticket_number: ticketNumber,
        status: "open",
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      toast({ title: "Success", description: "Ticket created successfully" });
      setOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> & { status?: string } }) => {
      const updateData: any = { ...data };
      if (data.status === "resolved") {
        updateData.resolved_at = new Date().toISOString();
      }
      const { error } = await supabase.from("support_tickets").update(updateData).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      toast({ title: "Success", description: "Ticket updated successfully" });
      setOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("support_tickets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      toast({ title: "Success", description: "Ticket deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      machine_id: "",
      location: "",
      issue_type: "",
      priority: "medium",
      description: "",
      resolution: "",
    });
    setEditingTicket(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTicket) {
      updateMutation.mutate({ id: editingTicket.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (ticket: SupportTicket) => {
    setEditingTicket(ticket);
    setFormData({
      machine_id: ticket.machine_id,
      location: ticket.location,
      issue_type: ticket.issue_type,
      priority: ticket.priority,
      description: ticket.description,
      resolution: ticket.resolution || "",
    });
    setOpen(true);
  };

  const handleResolve = (ticket: SupportTicket) => {
    const resolution = prompt("Enter resolution notes:");
    if (resolution) {
      updateMutation.mutate({
        id: ticket.id,
        data: { status: "resolved", resolution },
      });
    }
  };

  const openTickets = tickets?.filter((t) => t.status === "open") || [];
  const criticalTickets = tickets?.filter((t) => t.priority === "critical" && t.status === "open") || [];

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground mb-2">Technical Support</h2>
          <p className="text-muted-foreground">Monitor support tickets and machine issues</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              Create Ticket
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingTicket ? "Edit Ticket" : "Create New Ticket"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="machine_id">Machine ID</Label>
                  <Input
                    id="machine_id"
                    value={formData.machine_id}
                    onChange={(e) => setFormData({ ...formData, machine_id: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="issue_type">Issue Type</Label>
                  <Input
                    id="issue_type"
                    value={formData.issue_type}
                    onChange={(e) => setFormData({ ...formData, issue_type: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  rows={4}
                />
              </div>
              {editingTicket && (
                <div>
                  <Label htmlFor="resolution">Resolution</Label>
                  <Textarea
                    id="resolution"
                    value={formData.resolution}
                    onChange={(e) => setFormData({ ...formData, resolution: e.target.value })}
                    rows={3}
                  />
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit">{editingTicket ? "Update" : "Create"} Ticket</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Open Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{openTickets.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{tickets?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Critical Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-destructive">{criticalTickets.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Resolved</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-500">
              {tickets?.filter((t) => t.status === "resolved").length || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {criticalTickets.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Critical Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {criticalTickets.map((ticket) => (
                <div key={ticket.id} className="flex items-center justify-between border-b border-border pb-3">
                  <div>
                    <p className="font-medium text-foreground">{ticket.issue_type}</p>
                    <p className="text-sm text-muted-foreground">
                      {ticket.ticket_number} • {ticket.machine_id} • {ticket.location}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => handleResolve(ticket)}>
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Resolve
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Support Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {tickets?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No tickets found</p>
            ) : (
              tickets?.map((ticket) => (
                <div key={ticket.id} className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-medium text-foreground">{ticket.issue_type}</h3>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        ticket.priority === "critical" ? "bg-destructive/10 text-destructive" :
                        ticket.priority === "high" ? "bg-orange-500/10 text-orange-500" :
                        ticket.priority === "medium" ? "bg-yellow-500/10 text-yellow-500" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {ticket.priority}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        ticket.status === "resolved" ? "bg-green-500/10 text-green-500" :
                        "bg-blue-500/10 text-blue-500"
                      }`}>
                        {ticket.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {ticket.ticket_number} • {ticket.machine_id} • {ticket.location} • {new Date(ticket.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {ticket.status === "open" && (
                      <Button variant="outline" size="sm" onClick={() => handleResolve(ticket)}>
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => handleEdit(ticket)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => deleteMutation.mutate(ticket.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TechnicalSupport;