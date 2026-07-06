import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, DollarSign, Users } from "lucide-react";
import { format } from "date-fns";
import { logAuditEvent } from "@/hooks/useAuditLog";

const FranchisesManager = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selected, setSelected] = useState<any | null>(null);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutForm, setPayoutForm] = useState({ period_start: "", period_end: "", gross_sales: 0 });

  const { data: franchises, isLoading } = useQuery({
    queryKey: ["admin-franchises"],
    queryFn: async () => {
      const { data } = await supabase.from("vendx_franchises" as any).select("*").order("created_at", { ascending: false });
      return (data || []) as any[];
    },
  });

  const update = async (id: string, patch: Record<string, any>, action: string) => {
    const { error } = await supabase.from("vendx_franchises" as any).update(patch).eq("id", id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    await logAuditEvent({ action, entity_type: "vendx_franchises", entity_id: id, details: patch });
    toast({ title: "Updated" });
    qc.invalidateQueries({ queryKey: ["admin-franchises"] });
  };

  const grantRole = async (userId: string) => {
    // Assign franchise_owner role
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "franchise_owner" as any });
    if (error && !error.message.includes("duplicate")) {
      toast({ title: "Role grant failed", description: error.message, variant: "destructive" });
    }
  };

  const approve = async (f: any) => {
    await grantRole(f.user_id);
    await update(f.id, { status: "active" }, "franchise.approve");
  };

  const createPayout = async () => {
    if (!selected) return;
    const gross = Number(payoutForm.gross_sales);
    const commission = +(gross * Number(selected.commission_pct) / 100).toFixed(2);
    const net = +(gross - commission).toFixed(2);
    const { error } = await supabase.from("vendx_franchise_payouts" as any).insert({
      franchise_id: selected.id,
      period_start: payoutForm.period_start,
      period_end: payoutForm.period_end,
      gross_sales: gross,
      commission_pct: selected.commission_pct,
      commission_amount: commission,
      net_payout: net,
    } as any);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Payout period created" });
    setPayoutOpen(false);
    setPayoutForm({ period_start: "", period_end: "", gross_sales: 0 });
  };

  if (isLoading) return <div className="p-6"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6" />Franchise Program</h2>
        <p className="text-sm text-muted-foreground">Review applications, approve franchisees, and track commission payouts.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>All Franchises ({franchises?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {!franchises?.length ? <p className="text-sm text-muted-foreground">No applications yet.</p> :
            <div className="space-y-2">
              {franchises.map((f: any) => (
                <div key={f.id} className="p-4 border rounded-lg space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{f.business_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {f.contact_email} {f.contact_phone && `• ${f.contact_phone}`} • Applied {format(new Date(f.created_at), "PP")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Ownership: {f.machine_ownership_model} • Setup ${Number(f.setup_fee_amount).toLocaleString()} {f.setup_fee_paid ? "✓ paid" : "unpaid"} • {f.commission_pct}% commission
                      </div>
                    </div>
                    <Badge variant={f.status === "active" ? "default" : f.status === "pending" ? "secondary" : "destructive"}>{f.status}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {f.status === "pending" && <Button size="sm" onClick={() => approve(f)}><CheckCircle2 className="h-4 w-4 mr-1" />Approve & Grant Role</Button>}
                    {f.status === "active" && !f.setup_fee_paid && <Button size="sm" variant="outline" onClick={() => update(f.id, { setup_fee_paid: true, setup_fee_paid_at: new Date().toISOString() }, "franchise.mark_setup_paid")}><DollarSign className="h-4 w-4 mr-1" />Mark Setup Paid</Button>}
                    {f.status !== "suspended" && <Button size="sm" variant="ghost" onClick={() => update(f.id, { status: "suspended" }, "franchise.suspend")}>Suspend</Button>}
                    {f.status === "suspended" && <Button size="sm" variant="outline" onClick={() => update(f.id, { status: "active" }, "franchise.reactivate")}>Reactivate</Button>}
                    {f.status === "active" && <Button size="sm" variant="outline" onClick={() => { setSelected(f); setPayoutOpen(true); }}>New Payout Period</Button>}
                  </div>
                </div>
              ))}
            </div>
          }
        </CardContent>
      </Card>

      <Dialog open={payoutOpen} onOpenChange={setPayoutOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Payout Period{selected && ` — ${selected.business_name}`}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Period Start</Label><Input type="date" value={payoutForm.period_start} onChange={(e) => setPayoutForm({ ...payoutForm, period_start: e.target.value })} /></div>
              <div><Label>Period End</Label><Input type="date" value={payoutForm.period_end} onChange={(e) => setPayoutForm({ ...payoutForm, period_end: e.target.value })} /></div>
            </div>
            <div><Label>Gross Route Sales ($)</Label><Input type="number" step="0.01" value={payoutForm.gross_sales} onChange={(e) => setPayoutForm({ ...payoutForm, gross_sales: Number(e.target.value) })} /></div>
            {selected && (
              <div className="text-sm space-y-1 p-3 bg-muted rounded">
                <div>VendX commission ({selected.commission_pct}%): <strong>${(payoutForm.gross_sales * selected.commission_pct / 100).toFixed(2)}</strong></div>
                <div>Net to franchisee: <strong className="text-green-500">${(payoutForm.gross_sales - payoutForm.gross_sales * selected.commission_pct / 100).toFixed(2)}</strong></div>
              </div>
            )}
            <Button onClick={createPayout} className="w-full">Create Payout</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FranchisesManager;
