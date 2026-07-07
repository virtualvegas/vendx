import { useState } from "react";
import { useMyFranchise } from "@/hooks/useMyFranchise";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckCircle2, Clock, DollarSign, FileSignature, CreditCard } from "lucide-react";

const AGREEMENT_TEXT = `VENDX FRANCHISE AGREEMENT — SUMMARY

1. GRANT: VendX grants Franchisee a non-transferable license to operate a VendX-branded vending & arcade route within the assigned territory.
2. FEES: A one-time setup fee of $8,000 is due upon approval. VendX retains 10% of gross route revenue as an ongoing royalty.
3. SUPPLY: All machines, hardware, and restock inventory must be ordered through the official VendX franchise storefront.
4. STANDARDS: Franchisee agrees to maintain VendX brand standards, uptime SLAs, and reporting obligations.
5. TERM: Initial term of 5 years, renewable at VendX's discretion. Either party may terminate for material breach on 30-day cure notice.
6. TERRITORY: Exclusivity, where granted, is documented in the Territory tab and may be revised by mutual agreement.

By signing below, Franchisee acknowledges reading and accepting the full Franchise Disclosure Document and this Agreement.`;

const FranchiseOnboarding = () => {
  const { data: franchise, isLoading } = useMyFranchise();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({ business_name: "", contact_email: "", contact_phone: "", machine_ownership_model: "franchisee" });
  const [submitting, setSubmitting] = useState(false);
  const [signName, setSignName] = useState("");
  const [agree, setAgree] = useState(false);
  const [signing, setSigning] = useState(false);
  const [paying, setPaying] = useState(false);

  const agreement = useQuery({
    queryKey: ["franchise-agreement", franchise?.id],
    enabled: !!franchise?.id,
    queryFn: async () => {
      const { data } = await supabase.from("vendx_franchise_documents" as any)
        .select("*").eq("franchise_id", franchise.id).eq("doc_type", "franchise_agreement").maybeSingle();
      return data as any;
    },
  });

  const submit = async () => {
    if (!form.business_name.trim()) return toast({ title: "Business name required", variant: "destructive" });
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("vendx_franchises" as any).insert({
        user_id: user.id, business_name: form.business_name,
        contact_email: form.contact_email || user.email, contact_phone: form.contact_phone,
        machine_ownership_model: form.machine_ownership_model,
      } as any);
      if (error) throw error;
      toast({ title: "Application submitted", description: "We'll review and reach out shortly." });
      qc.invalidateQueries({ queryKey: ["my-franchise"] });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  const signAgreement = async () => {
    if (!signName.trim() || !agree || !franchise?.id) return;
    setSigning(true);
    try {
      const { error } = await supabase.from("vendx_franchise_documents" as any).insert({
        franchise_id: franchise.id, doc_type: "franchise_agreement", title: "VendX Franchise Agreement",
        status: "signed", signature_name: signName, signed_at: new Date().toISOString(),
        metadata: { agreement_version: "1.0" },
      });
      if (error) throw error;
      await supabase.from("vendx_franchises" as any).update({ agreement_signed_at: new Date().toISOString() }).eq("id", franchise.id);
      toast({ title: "Agreement signed" });
      qc.invalidateQueries({ queryKey: ["franchise-agreement"] });
      qc.invalidateQueries({ queryKey: ["my-franchise"] });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally { setSigning(false); }
  };

  const paySetupFee = async () => {
    setPaying(true);
    try {
      const { data, error } = await supabase.functions.invoke("franchise-setup-checkout");
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally { setPaying(false); }
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
                <li><strong>Setup fee:</strong> $8,000 one-time (paid securely via Stripe on approval)</li>
                <li><strong>Revenue share:</strong> 10% of route sales to VendX</li>
                <li>All machines and restock inventory must be ordered through us</li>
              </ul>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div><Label>Business / Franchise Name *</Label><Input value={form.business_name} onChange={e => setForm({ ...form, business_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Contact Email</Label><Input type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} /></div>
            </div>
            <div>
              <Label>Machine Ownership Preference</Label>
              <select className="w-full border rounded-md p-2 bg-background" value={form.machine_ownership_model} onChange={e => setForm({ ...form, machine_ownership_model: e.target.value })}>
                <option value="franchisee">I want to own my machines (buy through VendX)</option>
                <option value="company">VendX owns, I operate (revenue share only)</option>
              </select>
            </div>
            <Button onClick={submit} disabled={submitting} className="w-full">
              {submitting && <Loader2 className="animate-spin mr-2 h-4 w-4" />}Submit Application
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusColor = franchise.status === "active" ? "default" : franchise.status === "pending" ? "secondary" : "destructive";
  const agreementSigned = !!agreement.data?.signed_at;
  const canPay = franchise.status === "active" && agreementSigned && !franchise.setup_fee_paid;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div><CardTitle>{franchise.business_name}</CardTitle><CardDescription>Franchise application status</CardDescription></div>
            <Badge variant={statusColor as any}>{franchise.status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            {franchise.setup_fee_paid ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Clock className="h-4 w-4 text-yellow-500" />}
            Setup fee: ${Number(franchise.setup_fee_amount).toLocaleString()} — {franchise.setup_fee_paid ? "Paid" : "Awaiting payment"}
          </div>
          <div className="flex items-center gap-2"><DollarSign className="h-4 w-4" />Revenue share to VendX: {franchise.commission_pct}%</div>
          <div>Machine ownership: <strong>{franchise.machine_ownership_model === "franchisee" ? "Franchisee-owned" : "Company-owned"}</strong></div>
        </CardContent>
      </Card>

      {franchise.status === "active" && (
        <>
          <Card className={agreementSigned ? "border-green-500/40" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileSignature className="h-5 w-5" />Step 1: Sign Franchise Agreement</CardTitle>
              <CardDescription>
                {agreementSigned
                  ? `Signed by ${agreement.data.signature_name} on ${new Date(agreement.data.signed_at).toLocaleDateString()}.`
                  : "Review and e-sign the franchise agreement to proceed."}
              </CardDescription>
            </CardHeader>
            {!agreementSigned && (
              <CardContent className="space-y-3">
                <Textarea readOnly value={AGREEMENT_TEXT} rows={10} className="font-mono text-xs" />
                <div className="flex items-start gap-2">
                  <Checkbox id="agree" checked={agree} onCheckedChange={(v) => setAgree(!!v)} />
                  <label htmlFor="agree" className="text-sm">I have read and accept the full VendX Franchise Agreement and Disclosure Document.</label>
                </div>
                <div><Label>Type your full legal name to sign *</Label><Input value={signName} onChange={e => setSignName(e.target.value)} placeholder="Full legal name" /></div>
                <Button onClick={signAgreement} disabled={!agree || !signName.trim() || signing} className="w-full">
                  {signing && <Loader2 className="animate-spin mr-2 h-4 w-4" />}Sign Agreement
                </Button>
              </CardContent>
            )}
          </Card>

          <Card className={franchise.setup_fee_paid ? "border-green-500/40" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" />Step 2: Pay $8,000 Setup Fee</CardTitle>
              <CardDescription>
                {franchise.setup_fee_paid
                  ? "Setup fee received. Your franchise is fully activated."
                  : agreementSigned
                    ? "Complete secure Stripe checkout to activate machine ordering."
                    : "Sign the agreement above first."}
              </CardDescription>
            </CardHeader>
            {!franchise.setup_fee_paid && (
              <CardContent>
                <Button onClick={paySetupFee} disabled={!canPay || paying} className="w-full">
                  {paying && <Loader2 className="animate-spin mr-2 h-4 w-4" />}Pay ${Number(franchise.setup_fee_amount).toLocaleString()} via Stripe
                </Button>
              </CardContent>
            )}
          </Card>
        </>
      )}

      {franchise.status === "pending" && (
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">
          Your application is under review. A VendX representative will contact you at <strong>{franchise.contact_email}</strong> with next steps.
        </CardContent></Card>
      )}
    </div>
  );
};

export default FranchiseOnboarding;
