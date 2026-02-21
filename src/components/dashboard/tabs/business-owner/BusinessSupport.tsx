import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Headphones, Plus, AlertCircle, Clock, CheckCircle2, Phone, Mail } from "lucide-react";
import { useBusinessOwnerData } from "./useBusinessOwnerData";

const VENDX_PHONE = "(781) 214-1806";
const VENDX_PHONE_TEL = "tel:+17812141806";
const VENDX_EMAIL = "partners@vendx.space";

const BusinessSupport = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { assignments, machines, supportRequests, isLoading } = useBusinessOwnerData();

  const [supportDialogOpen, setSupportDialogOpen] = useState(false);
  const [supportFormData, setSupportFormData] = useState({
    location_id: "",
    machine_id: "",
    request_type: "support",
    priority: "medium",
    subject: "",
    description: ""
  });

  // Create support request mutation
  const createSupportMutation = useMutation({
    mutationFn: async (formData: typeof supportFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      const { error } = await supabase
        .from("partner_support_requests")
        .insert({
          business_owner_id: user.id,
          location_id: formData.location_id && formData.location_id !== "none" ? formData.location_id : null,
          machine_id: formData.machine_id && formData.machine_id !== "none" ? formData.machine_id : null,
          request_type: formData.request_type,
          priority: formData.priority,
          subject: formData.subject,
          description: formData.description,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-owner-support-requests"] });
      setSupportDialogOpen(false);
      setSupportFormData({
        location_id: "",
        machine_id: "",
        request_type: "support",
        priority: "medium",
        subject: "",
        description: ""
      });
      toast({ title: "Request Submitted", description: "Our team will respond shortly." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "open": return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case "in_progress": return <Clock className="w-4 h-4 text-blue-500" />;
      case "resolved": return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      default: return <CheckCircle2 className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": case "high": return "destructive";
      case "medium": return "secondary";
      default: return "outline";
    }
  };

  const handleSupportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportFormData.subject || !supportFormData.description) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    createSupportMutation.mutate(supportFormData);
  };

  const filteredMachinesForForm = useMemo(() => {
    if (!supportFormData.location_id || supportFormData.location_id === "none" || !machines) return [];
    return machines.filter(m => m.location_id === supportFormData.location_id);
  }, [supportFormData.location_id, machines]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading support requests...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Support</h2>
          <p className="text-muted-foreground">Request help and track your support tickets</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={supportDialogOpen} onOpenChange={setSupportDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Request
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Submit Support Request</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSupportSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Request Type *</Label>
                    <Select 
                      value={supportFormData.request_type} 
                      onValueChange={(v) => setSupportFormData({...supportFormData, request_type: v})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="support">General Support</SelectItem>
                        <SelectItem value="service">Machine Service</SelectItem>
                        <SelectItem value="billing">Billing Question</SelectItem>
                        <SelectItem value="emergency">Emergency</SelectItem>
                        <SelectItem value="general">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select 
                      value={supportFormData.priority} 
                      onValueChange={(v) => setSupportFormData({...supportFormData, priority: v})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Location (Optional)</Label>
                    <Select 
                      value={supportFormData.location_id || "none"} 
                      onValueChange={(v) => setSupportFormData({...supportFormData, location_id: v === "none" ? "" : v, machine_id: ""})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">All Locations</SelectItem>
                        {assignments?.map((a: any) => (
                          <SelectItem key={a.location_id} value={a.location_id}>
                            {a.location?.name || `${a.location?.city}, ${a.location?.country}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Machine (Optional)</Label>
                    <Select 
                      value={supportFormData.machine_id || "none"} 
                      onValueChange={(v) => setSupportFormData({...supportFormData, machine_id: v === "none" ? "" : v})}
                      disabled={!supportFormData.location_id || supportFormData.location_id === "none"}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select machine" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">All Machines</SelectItem>
                        {filteredMachinesForForm.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name} ({m.machine_code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Subject *</Label>
                  <Input 
                    value={supportFormData.subject}
                    onChange={(e) => setSupportFormData({...supportFormData, subject: e.target.value})}
                    placeholder="Brief description of your request"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description *</Label>
                  <Textarea 
                    value={supportFormData.description}
                    onChange={(e) => setSupportFormData({...supportFormData, description: e.target.value})}
                    placeholder="Provide details about your request..."
                    rows={4}
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setSupportDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createSupportMutation.isPending}>
                    {createSupportMutation.isPending ? "Submitting..." : "Submit Request"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Button variant="outline" asChild>
            <a href={VENDX_PHONE_TEL}>
              <Phone className="w-4 h-4 mr-2" />
              Call Support
            </a>
          </Button>
        </div>
      </div>

      {/* Support Requests List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Headphones className="w-5 h-5" />
            Support Requests
          </CardTitle>
          <CardDescription>Track your service and support requests</CardDescription>
        </CardHeader>
        <CardContent>
          {!supportRequests || supportRequests.length === 0 ? (
            <div className="text-center py-8">
              <Headphones className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No support requests yet</p>
              <Button onClick={() => setSupportDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Request
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supportRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(request.status)}
                          <span className="capitalize">{request.status.replace("_", " ")}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{request.subject}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{request.description}</p>
                      </TableCell>
                      <TableCell className="capitalize">{request.request_type}</TableCell>
                      <TableCell>
                        <Badge variant={getPriorityColor(request.priority) as any} className="capitalize">
                          {request.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(request.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Contact Card */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h3 className="font-bold text-lg">Need Immediate Help?</h3>
              <p className="text-muted-foreground">Our partner support team is here to help 24/7</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <a href={VENDX_PHONE_TEL}>
                  <Phone className="w-4 h-4 mr-2" />
                  {VENDX_PHONE}
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href={`mailto:${VENDX_EMAIL}`}>
                  <Mail className="w-4 h-4 mr-2" />
                  Email Us
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BusinessSupport;
