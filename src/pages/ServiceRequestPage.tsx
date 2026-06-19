import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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

const SERVICE_PACKAGES = [
  { value: "", label: "— None (custom request)" },
  { value: "diagnostic_visit", label: "Diagnostic Visit" },
  { value: "monitor_repair", label: "Monitor / Display Repair" },
  { value: "board_repair", label: "PCB / Board Repair" },
  { value: "full_restoration", label: "Full Restoration" },
  { value: "delivery_setup", label: "Delivery & Setup" },
  { value: "tune_up", label: "Annual Tune-Up" },
];

const MONITOR_TYPES = [
  { value: "", label: "— Unknown" },
  { value: "crt_standard", label: "CRT – Standard Res" },
  { value: "crt_medium", label: "CRT – Medium Res" },
  { value: "crt_high", label: "CRT – High Res / VGA" },
  { value: "lcd", label: "LCD" },
  { value: "led", label: "LED" },
  { value: "oled", label: "OLED" },
  { value: "dmd_pinball", label: "Pinball DMD" },
  { value: "lcd_pinball", label: "Pinball LCD" },
];

const CONTROL_TYPES = [
  { value: "", label: "— Unknown" },
  { value: "joystick_buttons", label: "Joystick + Buttons" },
  { value: "trackball", label: "Trackball" },
  { value: "spinner", label: "Spinner / Dial" },
  { value: "steering_wheel", label: "Steering Wheel" },
  { value: "light_gun", label: "Light Gun" },
  { value: "fight_stick", label: "Fight Stick" },
  { value: "pinball_flippers", label: "Pinball Flippers" },
  { value: "other", label: "Other" },
];

const POWER_TYPES = [
  { value: "", label: "— Unknown" },
  { value: "120v_standard", label: "Standard 120V Outlet" },
  { value: "220v", label: "220V Outlet" },
  { value: "isolation_transformer", label: "Isolation Transformer" },
];

const LOCATION_TYPES = [
  { value: "in_home", label: "Private Home / Residence" },
  { value: "business", label: "Business / Commercial" },
  { value: "warehouse", label: "Warehouse / Storage" },
  { value: "other", label: "Other" },
];

const schema = z.object({
  intake_company_name: z.string().trim().min(1, "Company / Household required").max(200),
  intake_contact_name: z.string().trim().min(1, "Your name required").max(120),
  intake_contact_email: z.string().trim().email("Valid email required").max(255),
  intake_contact_phone: z.string().trim().min(5, "Phone required").max(40),
  intake_address: z.string().trim().max(300).optional(),
  intake_machine_type: z.string().trim().min(1, "Machine type required"),
  intake_machine_description: z.string().trim().max(500).optional(),
  subject: z.string().trim().min(3, "Subject required").max(200),
  description: z.string().trim().min(10, "Please describe the issue").max(4000),
  priority: z.string(),
  service_package: z.string().optional(),
  service_location_type: z.string().optional(),
  access_notes: z.string().trim().max(500).optional(),
  has_stairs: z.boolean().optional(),
  preferred_contact_time: z.string().trim().max(120).optional(),
  arcade_cabinet_brand: z.string().trim().max(120).optional(),
  arcade_cabinet_model: z.string().trim().max(120).optional(),
  arcade_game_title: z.string().trim().max(120).optional(),
  arcade_monitor_type: z.string().optional(),
  arcade_control_type: z.string().optional(),
  arcade_power_type: z.string().optional(),
  arcade_year_manufactured: z.string().optional(),
});

const isArcadeType = (t: string) =>
  ["arcade_home", "arcade_commercial", "pinball", "redemption", "claw_crane"].includes(t);

const ServiceRequestPage = () => {
  useSEO({
    title: "Request Machine Service — VendX",
    description: "Technician service for vending, coin-op, arcade, pinball, bowling pinsetters, in-home arcades and more. Submit a request and our team will respond.",
  });

  const [params] = useSearchParams();
  const prefMachine = params.get("machine") || "";
  const prefPackage = params.get("package") || "";

  const [form, setForm] = useState({
    intake_company_name: "", intake_contact_name: "", intake_contact_email: "",
    intake_contact_phone: "", intake_address: "",
    intake_machine_type: prefMachine, intake_machine_description: "",
    subject: "", description: "", priority: "normal",
    service_package: prefPackage,
    service_location_type: prefMachine === "arcade_home" ? "in_home" : "",
    access_notes: "", has_stairs: false, preferred_contact_time: "",
    arcade_cabinet_brand: "", arcade_cabinet_model: "", arcade_game_title: "",
    arcade_monitor_type: "", arcade_control_type: "", arcade_power_type: "",
    arcade_year_manufactured: "",
  });
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (prefMachine) setForm(f => ({ ...f, intake_machine_type: prefMachine, service_location_type: prefMachine === "arcade_home" ? "in_home" : f.service_location_type }));
    if (prefPackage) setForm(f => ({ ...f, service_package: prefPackage }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefMachine, prefPackage]);

  const showArcade = isArcadeType(form.intake_machine_type);
  const showInHome = form.service_location_type === "in_home" || form.intake_machine_type === "arcade_home";

  const submit = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    setBusy(true);
    const payload: any = { ...parsed.data, source: "public_intake", status: "new" };
    // normalise empty strings -> null and parse year
    payload.arcade_year_manufactured = payload.arcade_year_manufactured ? parseInt(payload.arcade_year_manufactured, 10) || null : null;
    Object.keys(payload).forEach(k => { if (payload[k] === "") payload[k] = null; });
    const { data, error } = await supabase.from("vendx_external_service_tickets" as any)
      .insert(payload)
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
            We service vending, coin-op, arcade, pinball, bowling pinsetters, in-home arcade machines and more. Tell us what's going on and we'll be in touch.
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
              <div className="md:col-span-2"><Label>Company / Household *</Label><Input value={form.intake_company_name} onChange={e => setForm({ ...form, intake_company_name: e.target.value })} placeholder="Company name or 'Smith Residence'" /></div>
              <div><Label>Your Name *</Label><Input value={form.intake_contact_name} onChange={e => setForm({ ...form, intake_contact_name: e.target.value })} /></div>
              <div><Label>Phone *</Label><Input value={form.intake_contact_phone} onChange={e => setForm({ ...form, intake_contact_phone: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Email *</Label><Input type="email" value={form.intake_contact_email} onChange={e => setForm({ ...form, intake_contact_email: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Machine Location / Address</Label><Input value={form.intake_address} onChange={e => setForm({ ...form, intake_address: e.target.value })} /></div>

              <div>
                <Label>Machine Type *</Label>
                <SearchableSelect value={form.intake_machine_type} onValueChange={v => setForm({ ...form, intake_machine_type: v, service_location_type: v === "arcade_home" ? "in_home" : form.service_location_type })}
                  options={MACHINE_TYPES} placeholder="Select machine type" searchPlaceholder="Search types..." />
              </div>
              <div>
                <Label>Service Location</Label>
                <SearchableSelect value={form.service_location_type} onValueChange={v => setForm({ ...form, service_location_type: v })}
                  options={LOCATION_TYPES} placeholder="Where is the machine?" searchPlaceholder="Search..." />
              </div>

              <div>
                <Label>Service Package</Label>
                <SearchableSelect value={form.service_package} onValueChange={v => setForm({ ...form, service_package: v })}
                  options={SERVICE_PACKAGES} placeholder="Optional preset" searchPlaceholder="Search packages..." />
              </div>
              <div>
                <Label>Priority</Label>
                <SearchableSelect value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}
                  options={[{ value: "low", label: "Low" }, { value: "normal", label: "Normal" }, { value: "high", label: "High" }, { value: "critical", label: "Critical / Down" }]}
                  placeholder="Priority" searchPlaceholder="Search..." />
              </div>

              <div className="md:col-span-2"><Label>Machine (make, model, etc.)</Label><Input value={form.intake_machine_description} onChange={e => setForm({ ...form, intake_machine_description: e.target.value })} /></div>

              {showArcade && (
                <>
                  <div className="md:col-span-2 pt-2 mt-2 border-t">
                    <p className="text-sm font-semibold">Arcade / Cabinet Details</p>
                    <p className="text-xs text-muted-foreground">Help us bring the right parts on the first visit.</p>
                  </div>
                  <div><Label>Cabinet Brand</Label><Input value={form.arcade_cabinet_brand} onChange={e => setForm({ ...form, arcade_cabinet_brand: e.target.value })} placeholder="Bally, Williams, Sega, Arcade1Up..." /></div>
                  <div><Label>Cabinet Model</Label><Input value={form.arcade_cabinet_model} onChange={e => setForm({ ...form, arcade_cabinet_model: e.target.value })} placeholder="Vewlix-L, Naomi, Cocktail..." /></div>
                  <div><Label>Game Title</Label><Input value={form.arcade_game_title} onChange={e => setForm({ ...form, arcade_game_title: e.target.value })} placeholder="Pac-Man, Street Fighter II..." /></div>
                  <div><Label>Year Manufactured</Label><Input type="number" value={form.arcade_year_manufactured} onChange={e => setForm({ ...form, arcade_year_manufactured: e.target.value })} placeholder="1982" /></div>
                  <div>
                    <Label>Monitor Type</Label>
                    <SearchableSelect value={form.arcade_monitor_type} onValueChange={v => setForm({ ...form, arcade_monitor_type: v })}
                      options={MONITOR_TYPES} placeholder="Monitor" searchPlaceholder="Search..." />
                  </div>
                  <div>
                    <Label>Control Type</Label>
                    <SearchableSelect value={form.arcade_control_type} onValueChange={v => setForm({ ...form, arcade_control_type: v })}
                      options={CONTROL_TYPES} placeholder="Controls" searchPlaceholder="Search..." />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Power</Label>
                    <SearchableSelect value={form.arcade_power_type} onValueChange={v => setForm({ ...form, arcade_power_type: v })}
                      options={POWER_TYPES} placeholder="Power source" searchPlaceholder="Search..." />
                  </div>
                </>
              )}

              {showInHome && (
                <>
                  <div className="md:col-span-2 pt-2 mt-2 border-t">
                    <p className="text-sm font-semibold">In-Home Service Details</p>
                  </div>
                  <div className="md:col-span-2 flex items-center gap-2">
                    <Checkbox id="stairs" checked={form.has_stairs} onCheckedChange={(v) => setForm({ ...form, has_stairs: !!v })} />
                    <Label htmlFor="stairs" className="cursor-pointer">Machine is up or down stairs</Label>
                  </div>
                  <div className="md:col-span-2"><Label>Access Notes</Label><Textarea rows={2} value={form.access_notes} onChange={e => setForm({ ...form, access_notes: e.target.value })} placeholder="Narrow doorway, basement install, pets in home, gate code..." /></div>
                  <div className="md:col-span-2"><Label>Preferred Contact / Visit Time</Label><Input value={form.preferred_contact_time} onChange={e => setForm({ ...form, preferred_contact_time: e.target.value })} placeholder="Weekday evenings, Saturday morning..." /></div>
                </>
              )}

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
