import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyFranchise } from "@/hooks/useMyFranchise";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, MapPinPlus, Clock, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";

const emptyForm = {
  name: "", address: "", city: "", state: "", country: "", postal_code: "",
  location_type: "", contact_name: "", contact_phone: "", contact_email: "",
  monthly_foot_traffic: "", notes: "",
};

const FranchiseLocationRequest = () => {
  const { data: franchise } = useMyFranchise();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const requests = useQuery({
    queryKey: ["franchise-location-requests", franchise?.id],
    enabled: !!franchise?.id,
    queryFn: async () => {
      const { data } = await supabase.from("location_change_requests" as any)
        .select("*, locations(name, city, country)")
        .eq("requested_by", franchise!.user_id)
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!form.name || !form.city) throw new Error("Location name and city are required");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("location_change_requests" as any).insert({
        requested_by: user.id,
        request_type: "franchise_new_location",
        description: `Franchise "${franchise?.business_name}" requests new location: ${form.name}`,
        details: {
          source: "franchise",
          franchise_id: franchise?.id,
          franchise_name: franchise?.business_name,
          proposed_location: form,
        },
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Request submitted", description: "An admin will review your location proposal." });
      setForm(emptyForm); setOpen(false);
      qc.invalidateQueries({ queryKey: ["franchise-location-requests"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  if (!franchise) return <div className="p-6 text-muted-foreground">Complete your franchise application first.</div>;

  const statusIcon = (s: string) => {
    if (s === "approved" || s === "completed") return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (s === "rejected") return <XCircle className="h-4 w-4 text-destructive" />;
    return <Clock className="h-4 w-4 text-yellow-500" />;
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><MapPinPlus className="h-6 w-6" />Location Requests</h1>
          <p className="text-sm text-muted-foreground">Propose new sites for your franchise territory. Admins review and add approved locations to the network.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />New Request</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Propose a New Location</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Location Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Location Type</Label><Input placeholder="e.g. Gym, Office, Retail" value={form.location_type} onChange={(e) => setForm({ ...form, location_type: e.target.value })} /></div>
              </div>
              <div><Label>Street Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>City *</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                <div><Label>State / Region</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
                <div><Label>Postal Code</Label><Input value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} /></div>
              </div>
              <div><Label>Country</Label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Site Contact Name</Label><Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></div>
                <div><Label>Site Contact Phone</Label><Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Site Contact Email</Label><Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></div>
                <div><Label>Est. Monthly Foot Traffic</Label><Input type="number" value={form.monthly_foot_traffic} onChange={(e) => setForm({ ...form, monthly_foot_traffic: e.target.value })} /></div>
              </div>
              <div><Label>Notes / Justification</Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Why is this a strong location? Machine type recommended, agreement status, etc." /></div>
              <Button className="w-full" onClick={() => submit.mutate()} disabled={submit.isPending}>
                {submit.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Submit for Review
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>My Requests ({requests.data?.length ?? 0})</CardTitle><CardDescription>Track the status of proposals you've submitted.</CardDescription></CardHeader>
        <CardContent>
          {requests.isLoading ? <Loader2 className="animate-spin" /> :
            !requests.data?.length ? <p className="text-sm text-muted-foreground">No requests yet. Submit one to get started.</p> :
              <div className="space-y-2">
                {requests.data.map((r: any) => {
                  const p = r.details?.proposed_location || {};
                  return (
                    <div key={r.id} className="border rounded p-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium flex items-center gap-2">{statusIcon(r.status)}{p.name || r.description}</div>
                        <Badge variant={r.status === "approved" || r.status === "completed" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>{r.status}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {[p.address, p.city, p.state, p.country].filter(Boolean).join(", ")}
                        {p.location_type && ` • ${p.location_type}`}
                      </div>
                      <div className="text-xs text-muted-foreground">Submitted {format(new Date(r.created_at), "PPP")}</div>
                      {r.admin_notes && (
                        <div className="text-xs bg-muted rounded p-2 mt-1"><strong>Admin note:</strong> {r.admin_notes}</div>
                      )}
                    </div>
                  );
                })}
              </div>}
        </CardContent>
      </Card>
    </div>
  );
};

export default FranchiseLocationRequest;
