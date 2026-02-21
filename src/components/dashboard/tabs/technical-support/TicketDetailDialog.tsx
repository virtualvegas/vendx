import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Send, Clock, CheckCircle, User, Shield, MessageSquare } from "lucide-react";
import { formatDisplayDate } from "@/lib/dateUtils";

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
  assigned_to: string | null;
}

interface TicketResponse {
  id: string;
  ticket_id: string;
  responder_id: string;
  responder_name: string | null;
  responder_role: string | null;
  message: string;
  is_internal_note: boolean;
  created_at: string;
}

interface TicketDetailDialogProps {
  ticket: SupportTicket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TicketDetailDialog = ({ ticket, open, onOpenChange }: TicketDetailDialogProps) => {
  const [newMessage, setNewMessage] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch responses for this ticket
  const { data: responses, isLoading: responsesLoading } = useQuery({
    queryKey: ["ticket-responses", ticket?.id],
    queryFn: async () => {
      if (!ticket) return [];
      const { data, error } = await supabase
        .from("support_ticket_responses")
        .select("*")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as TicketResponse[];
    },
    enabled: !!ticket && open,
  });

  // Create response mutation
  const sendResponseMutation = useMutation({
    mutationFn: async ({ message, isInternal }: { message: string; isInternal: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !ticket) throw new Error("Not authenticated");

      // Get user profile for name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      const { error } = await supabase
        .from("support_ticket_responses")
        .insert({
          ticket_id: ticket.id,
          responder_id: user.id,
          responder_name: profile?.full_name || user.email || "Admin",
          responder_role: "admin",
          message,
          is_internal_note: isInternal,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-responses", ticket?.id] });
      setNewMessage("");
      toast({ title: "Response sent" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Update ticket status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      if (!ticket) return;
      const updateData: any = { status };
      if (status === "resolved") {
        updateData.resolved_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from("support_tickets")
        .update(updateData)
        .eq("id", ticket.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      toast({ title: "Status updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSendResponse = () => {
    if (!newMessage.trim()) return;
    sendResponseMutation.mutate({ message: newMessage, isInternal: isInternalNote });
  };

  const handleStatusChange = (status: string) => {
    setNewStatus(status);
    updateStatusMutation.mutate(status);
  };

  if (!ticket) return null;

  const priorityColor = ticket.priority === "critical" ? "destructive" :
    ticket.priority === "high" ? "secondary" : "outline";

  const statusColor = ticket.status === "resolved" ? "default" :
    ticket.status === "in_progress" ? "secondary" : "outline";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{ticket.ticket_number}</span>
            <Badge variant={priorityColor as any} className="capitalize">{ticket.priority}</Badge>
            <Badge variant={statusColor as any} className="capitalize">{ticket.status}</Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Ticket Info */}
        <div className="grid grid-cols-2 gap-3 text-sm border border-border rounded-lg p-4">
          <div>
            <span className="text-muted-foreground">Issue:</span>{" "}
            <span className="font-medium">{ticket.issue_type}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Machine:</span>{" "}
            <span className="font-medium">{ticket.machine_id}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Location:</span>{" "}
            <span className="font-medium">{ticket.location}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Created:</span>{" "}
            <span className="font-medium">{formatDisplayDate(ticket.created_at)}</span>
          </div>
          <div className="col-span-2">
            <span className="text-muted-foreground">Description:</span>
            <p className="mt-1">{ticket.description}</p>
          </div>
        </div>

        {/* Status Controls */}
        <div className="flex items-center gap-3">
          <Label className="text-sm whitespace-nowrap">Update Status:</Label>
          <Select value={newStatus || ticket.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Responses Thread */}
        <div className="flex items-center gap-2 text-sm font-medium">
          <MessageSquare className="w-4 h-4" />
          Responses ({responses?.length || 0})
        </div>

        <ScrollArea className="flex-1 min-h-[150px] max-h-[250px]">
          <div className="space-y-3 pr-3">
            {responsesLoading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
            ) : responses?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No responses yet. Add the first response below.</p>
            ) : (
              responses?.map((response) => (
                <div
                  key={response.id}
                  className={`rounded-lg p-3 text-sm ${
                    response.is_internal_note
                      ? "bg-yellow-500/10 border border-yellow-500/20"
                      : "bg-muted/50 border border-border"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-primary" />
                      <span className="font-medium">{response.responder_name || "Admin"}</span>
                      {response.is_internal_note && (
                        <Badge variant="outline" className="text-xs text-yellow-500 border-yellow-500/30">
                          Internal Note
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDisplayDate(response.created_at)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap">{response.message}</p>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <Separator />

        {/* New Response Input */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Label className="text-sm">New Response</Label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={isInternalNote}
                onChange={(e) => setIsInternalNote(e.target.checked)}
                className="rounded"
              />
              <span className="text-muted-foreground">Internal note</span>
            </label>
          </div>
          <div className="flex gap-2">
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={isInternalNote ? "Add an internal note..." : "Type your response..."}
              rows={2}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleSendResponse();
                }
              }}
            />
            <Button
              onClick={handleSendResponse}
              disabled={!newMessage.trim() || sendResponseMutation.isPending}
              className="self-end"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TicketDetailDialog;
