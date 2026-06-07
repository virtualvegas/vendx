import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useSEO } from "@/hooks/useSEO";
import { toast } from "sonner";
import { CheckCircle, Wrench } from "lucide-react";

const MACHINE_TYPES = [
  { value: "vending_snack", label: "Vending – Snack" },
  { value: "vending_beverage", label: "Vending – Beverage" },
  { value: "vending_combo", label: "Vending – Combo" },
  { value: "vending_fresh", label: "Vending – Fresh / Cold Food" },
  { value: "coin_operated", label: "Coin-Operated Machine" },
  { value: "arcade_commercial", label: "Arcade – Commercial" },
  { value: "arcade_home", label: "Arcade – In-Home" },
  { value: "pinball", label: "Pinball Machine" },
  { value: "bowling_pinsetter", label: "Bowling Lane Pinsetter" },
  { value: "redemption", label: "Redemption / Ticket Game" },
  { value: "claw_crane", label: "Claw / Crane" },
  { value: "jukebox", label: "Jukebox" },
  { value: "pool_table", label: "Pool / Billiards Table" },
  { value: "atm", label: "ATM" },
  { value: "kiosk", label: "Self-Service Kiosk" },
  { value: "other", label: "Other" },
];

const schema = z.object({
  intake_company_name: z.string().trim().min(1, "Company required").max(200),
  intake_contact_name: z.string().trim().min(1, "Your name required").max(120),
  intake_contact_email: z.string().trim().email("Valid email required").max(255),
  intake_contact_phone: z.string().trim().min(5, "Phone required").max(40),
  intake_address: z.string().trim().max(300).optional(),
  intake_machine_type: z.string().trim().min(1, "Machine type required"),
  intake_machine_description: z.string().trim().max(500).optional(),
  subject: z.string().trim().min(3, "Subject required").max(200),
  description: z.string().trim().min(10, "Please describe the issue").max(4000),
  priority: z.string(),
});

const ServiceRequestPage = () => {
  useSEO({
    title: "Request Machine Service — VendX",
    description: "Technician service for vending, coin-op, arcade, pinball, bowling pinsetters, in-home arcades and more. Submit a request and our team will respond.",
  });

  const [form, setForm] = useState({
    intake_company_name: "", intake_contact_name: "", intake_contact_email: "",
    intake_contact_phone: "", intake_address: "",
    intake_machine_type: "", intake_machine_description: "",
    subject: "", description: "", priority: "normal",
  });
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    setBusy(true);
    const { data, error } = await supabase.from("vendx_external_service_tickets" as any)
      .insert({ ...parsed.data, source: "public_intake", status: "new" })
      .select("ticket_number").single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setSubmitted((data as any).ticket_number);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />
      <main className="flex-1 container max-w-2xl mx-auto px-4 py-12">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary mb-3">
            <Wrench className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-bold">Machine Service Request</h1>
          <p className="text-muted-foreground mt-2">
            Got a vending, kiosk, or arcade machine that needs servicing? Our technicians can help. Tell us what's going on and we'll be in touch.
          </p>
        </div>

        {submitted ? (
          <Card className="p-8 text-center">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
            <h2 className="text-xl font-bold">Request received</h2>
            <p className="text-muted-foreground mt-2">Your ticket number is</p>
            <p className="font-mono text-lg mt-1">{submitted}</p>
            <p className="text-sm text-muted-foreground mt-4">We'll reach out via email or phone within 1 business day.</p>
            <Button className="mt-6" variant="outline" onClick={() => { setSubmitted(null); setForm({ ...form, subject: "", description: "" }); }}>
              Submit another
            </Button>
          </Card>
        ) : (
          <Card className="p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2"><Label>Company *</Label><Input value={form.intake_company_name} onChange={e => setForm({ ...form, intake_company_name: e.target.value })} /></div>
              <div><Label>Your Name *</Label><Input value={form.intake_contact_name} onChange={e => setForm({ ...form, intake_contact_name: e.target.value })} /></div>
              <div><Label>Phone *</Label><Input value={form.intake_contact_phone} onChange={e => setForm({ ...form, intake_contact_phone: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Email *</Label><Input type="email" value={form.intake_contact_email} onChange={e => setForm({ ...form, intake_contact_email: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Machine Location / Address</Label><Input value={form.intake_address} onChange={e => setForm({ ...form, intake_address: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Machine (make, model, etc.)</Label><Input value={form.intake_machine_description} onChange={e => setForm({ ...form, intake_machine_description: e.target.value })} /></div>
              <div>
                <Label>Priority</Label>
                <SearchableSelect value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}
                  options={[{ value: "low", label: "Low" }, { value: "normal", label: "Normal" }, { value: "high", label: "High" }, { value: "critical", label: "Critical / Down" }]}
                  placeholder="Priority" searchPlaceholder="Search..." />
              </div>
              <div className="md:col-span-2"><Label>Subject *</Label><Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="Coin mech jammed, screen black, etc." /></div>
              <div className="md:col-span-2"><Label>Describe the issue *</Label><Textarea rows={5} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            </div>
            <Button className="w-full mt-6" disabled={busy} onClick={submit}>
              {busy ? "Submitting..." : "Submit Request"}
            </Button>
            <p className="text-xs text-muted-foreground mt-3 text-center">
              Time + parts are invoiced per our standard rates. We'll confirm the scope before any chargeable work.
            </p>
          </Card>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default ServiceRequestPage;
