import { useState } from "react";
import { useMyFranchise } from "@/hooks/useMyFranchise";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, Clock, DollarSign } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const FranchiseOnboarding = () => {
  const { data: franchise, isLoading } = useMyFranchise();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({ business_name: "", contact_email: "", contact_phone: "", machine_ownership_model: "franchisee" });
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!form.business_name.trim()) return toast({ title: "Business name required", variant: "destructive" });
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("vendx_franchises" as any).insert({
        user_id: user.id,
        business_name: form.business_name,
        contact_email: form.contact_email || user.email,
        contact_phone: form.contact_phone,
        machine_ownership_model: form.machine_ownership_model,
      } as any);
      if (error) throw error;
      toast({ title: "Application submitted", description: "We'll review and reach out shortly." });
      qc.invalidateQueries({ queryKey: ["my-franchise"] });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return <div className="p-6"><Loader2 className="animate-spin" /></div>;

  if (!franchise) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Become a VendX Franchise Owner</CardTitle>
            <CardDescription>
              Own and operate your own machine route through VendX. We supply the machines and product; you build and run the route.
              <ul className="list-disc ml-5 mt-3 space-y-1 text-sm">
                <li><strong>Setup fee:</strong> $8,000 one-time (invoiced on approval)</li>
                <li><strong>Revenue share:</strong> 10% of route sales to VendX</li>
                <li>All machines and restock inventory must be ordered through us</li>
              </ul>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Business / Franchise Name *</Label>
              <Input value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Contact Email</Label><Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} /></div>
            </div>
            <div>
              <Label>Machine Ownership Preference</Label>
              <select className="w-full border rounded-md p-2 bg-background" value={form.machine_ownership_model} onChange={(e) => setForm({ ...form, machine_ownership_model: e.target.value })}>
                <option value="franchisee">I want to own my machines (buy through VendX)</option>
                <option value="company">VendX owns, I operate (revenue share only)</option>
              </select>
            </div>
            <Button onClick={submit} disabled={submitting} className="w-full">
              {submitting && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
              Submit Application
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusColor = franchise.status === "active" ? "default" : franchise.status === "pending" ? "secondary" : "destructive";

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{franchise.business_name}</CardTitle>
              <CardDescription>Franchise application status</CardDescription>
            </div>
            <Badge variant={statusColor as any}>{franchise.status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            {franchise.setup_fee_paid ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Clock className="h-4 w-4 text-yellow-500" />}
            Setup fee: ${Number(franchise.setup_fee_amount).toLocaleString()} — {franchise.setup_fee_paid ? "Paid" : "Awaiting payment"}
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Revenue share to VendX: {franchise.commission_pct}%
          </div>
          <div>Machine ownership: <strong>{franchise.machine_ownership_model === "franchisee" ? "Franchisee-owned" : "Company-owned"}</strong></div>
          {franchise.status === "pending" && (
            <p className="text-muted-foreground text-sm pt-2 border-t">
              Your application is under review. A VendX representative will contact you at{" "}
              <strong>{franchise.contact_email}</strong> with next steps and the setup fee invoice.
            </p>
          )}
          {franchise.status === "active" && !franchise.setup_fee_paid && (
            <p className="text-yellow-600 text-sm pt-2 border-t">
              Your franchise is approved. Complete your setup fee payment to start ordering machines. Contact your VendX rep.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FranchiseOnboarding;
