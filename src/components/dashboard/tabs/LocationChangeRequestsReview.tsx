import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, CheckCircle2, XCircle, Send, MessageSquare, Building2 } from "lucide-react";

interface ChangeRequest {
  id: string;
  requested_by: string;
  location_id: string | null;
  request_type: string;
  description: string | null;
  details: Record<string, any>;
  status: string;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

const LocationChangeRequestsReview = () => {
  const [selectedRequest, setSelectedRequest] = useState<ChangeRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: requests, isLoading } = useQuery({
    queryKey: ["admin-change-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("location_change_requests" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ChangeRequest[];
    },
  });

  const { data: locations } = useQuery({
    queryKey: ["locations-lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("locations").select("id, name, city, country");
      return data || [];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles-lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email");
      return data || [];
    },
  });

  const updateRequestMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("location_change_requests" as any)
        .update({
          status,
          admin_notes: adminNotes || null,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-change-requests"] });
      toast({ title: `Request ${vars.status}` });
      setSelectedRequest(null);
      setAdminNotes("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const getLocationName = (locationId: string | null) => {
    if (!locationId) return "N/A";
    const loc = locations?.find(l => l.id === locationId);
    return loc?.name || `${loc?.city}, ${loc?.country}` || "Unknown";
  };

  const getRequesterName = (userId: string) => {
    const profile = profiles?.find(p => p.id === userId);
    return profile?.full_name || profile?.email || "Unknown";
  };

  const pendingCount = requests?.filter(r => r.status === "pending").length || 0;

  if (isLoading) return null;
  if (!requests || requests.length === 0) return null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Location Change Requests
            {pendingCount > 0 && (
              <Badge variant="destructive" className="ml-2">{pendingCount} pending</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-3">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => { setSelectedRequest(req); setAdminNotes(req.admin_notes || ""); }}
                >
                  <div className="flex items-center gap-3">
                    {req.status === "pending" ? (
                      <Clock className="w-4 h-4 text-yellow-500" />
                    ) : req.status === "approved" ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <div>
                      <p className="font-medium text-sm capitalize">{req.request_type.replace(/_/g, " ")}</p>
                      <p className="text-xs text-muted-foreground">
                        By {getRequesterName(req.requested_by)} · {new Date(req.created_at).toLocaleDateString()}
                        {req.location_id && ` · ${getLocationName(req.location_id)}`}
                      </p>
                    </div>
                  </div>
                  <Badge variant={req.status === "approved" ? "default" : req.status === "denied" ? "destructive" : "secondary"}>
                    {req.status}
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="capitalize">{selectedRequest?.request_type.replace(/_/g, " ")} Request</DialogTitle>
            <DialogDescription>
              From {selectedRequest && getRequesterName(selectedRequest.requested_by)} · {selectedRequest && new Date(selectedRequest.created_at).toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {selectedRequest?.location_id && (
              <div>
                <Label className="text-xs text-muted-foreground">Location</Label>
                <p className="font-medium flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  {getLocationName(selectedRequest.location_id)}
                </p>
              </div>
            )}

            <div>
              <Label className="text-xs text-muted-foreground">Description</Label>
              <p className="text-sm mt-1">{selectedRequest?.description || "No description provided"}</p>
            </div>

            {selectedRequest?.details && Object.keys(selectedRequest.details).length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">Details</Label>
                <div className="mt-1 p-3 bg-muted/50 rounded-lg space-y-1">
                  {Object.entries(selectedRequest.details).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}</span>
                      <span className="font-medium">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedRequest?.status === "pending" && (
              <div className="space-y-2">
                <Label>Admin Notes (optional)</Label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes for the business owner..."
                  rows={3}
                />
              </div>
            )}

            {selectedRequest?.admin_notes && selectedRequest.status !== "pending" && (
              <div>
                <Label className="text-xs text-muted-foreground">Admin Notes</Label>
                <p className="text-sm mt-1 p-3 bg-muted/50 rounded-lg">{selectedRequest.admin_notes}</p>
              </div>
            )}
          </div>

          {selectedRequest?.status === "pending" && (
            <DialogFooter className="gap-2">
              <Button
                variant="destructive"
                onClick={() => selectedRequest && updateRequestMutation.mutate({ id: selectedRequest.id, status: "denied" })}
                disabled={updateRequestMutation.isPending}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Deny
              </Button>
              <Button
                onClick={() => selectedRequest && updateRequestMutation.mutate({ id: selectedRequest.id, status: "approved" })}
                disabled={updateRequestMutation.isPending}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Approve
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LocationChangeRequestsReview;
