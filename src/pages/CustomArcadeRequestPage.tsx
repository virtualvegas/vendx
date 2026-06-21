import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import StarField from "@/components/StarField";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Gamepad2, Cpu, Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useSEO } from "@/hooks/useSEO";

const CABINET_STYLES = [
  { v: "upright", l: "Upright" },
  { v: "cocktail", l: "Cocktail" },
  { v: "pedestal", l: "Pedestal" },
  { v: "bartop", l: "Bartop" },
  { v: "sit_down", l: "Sit-Down" },
];
const SIZES = [
  { v: "full", l: "Full Size" }, { v: "mid", l: "Mid Size" }, { v: "mini", l: "Mini" },
];
const CONTROLS = [
  { v: "1p", l: "1 Player" }, { v: "2p", l: "2 Player" }, { v: "4p", l: "4 Player" },
];
const MONITORS = ["19", "24", "27", "32", "43"];
const BUDGETS = [
  { v: "under_2k", l: "Under $2,000" },
  { v: "2k_4k", l: "$2,000 – $4,000" },
  { v: "4k_7k", l: "$4,000 – $7,000" },
  { v: "7k_10k", l: "$7,000 – $10,000" },
  { v: "10k_plus", l: "$10,000+" },
];
const PLATFORMS = [
  "MAME", "NES", "SNES", "Sega Genesis", "Neo Geo", "N64", "PS1", "Atomiswave", "Naomi", "Dreamcast", "PC", "Daphne",
];

const empty = {
  full_name: "", email: "", phone: "",
  address_line1: "", address_line2: "", city: "", state: "", postal_code: "", country: "US",
  cabinet_style: "upright", cabinet_size: "full", artwork_theme: "",
  control_layout: "2p", trackball: false, spinner: false, light_gun: false, monitor_size: "32",
  preferred_games: "", approx_game_count: "" as string | number, online_play: false,
  budget_range: "4k_7k", target_delivery_date: "", financing_interest: false, in_home_setup: true,
  reference_product_id: "" as string | null,
  additional_notes: "",
};

const CustomArcadeRequestPage = () => {
  const [params] = useSearchParams();
  const [form, setForm] = useState({ ...empty });
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useSEO({
    title: "Custom Multicade Arcade Machine Request | VendX",
    description: "Design a custom multicade arcade cabinet for your home. Choose cabinet style, controls, monitor, and games — get a personalized quote.",
  });

  const { data: catalog } = useQuery({
    queryKey: ["arcade-sales-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_products")
        .select("id, name, slug, short_description, price, images, category")
        .in("category", ["arcade_sales", "arcade_refurbished"])
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Prefill from query / auth
  useEffect(() => {
    const ref = params.get("ref");
    if (ref) setForm(f => ({ ...f, reference_product_id: ref }));
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (u) setForm(f => ({
        ...f,
        email: f.email || u.email || "",
        full_name: f.full_name || (u.user_metadata as any)?.full_name || "",
      }));
    });
  }, [params]);

  const togglePlatform = (p: string) =>
    setPlatforms(arr => arr.includes(p) ? arr.filter(x => x !== p) : [...arr, p]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setSubmitting(true);
    const { data: u } = await supabase.auth.getUser();
    const payload: any = {
      ...form,
      preferred_platforms: platforms,
      approx_game_count: form.approx_game_count ? Number(form.approx_game_count) : null,
      target_delivery_date: form.target_delivery_date || null,
      reference_product_id: form.reference_product_id || null,
      user_id: u.user?.id ?? null,
    };
    const { data, error } = await supabase
      .from("vendx_custom_arcade_requests")
      .insert(payload)
      .select("request_number")
      .single();
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Request submitted!");
    setDone(data.request_number);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (done) {
    return (
      <div className="relative min-h-screen bg-background">
        <StarField />
        <Navigation />
        <div className="relative z-10 pt-32 pb-20 container mx-auto px-4 max-w-2xl">
          <Card className="bg-card/60 border-primary/40 text-center">
            <CardContent className="p-10">
              <CheckCircle2 className="w-16 h-16 text-primary mx-auto mb-4" />
              <h1 className="text-3xl font-bold mb-2">Request Received</h1>
              <p className="text-muted-foreground mb-2">Reference: <span className="font-mono text-foreground">{done}</span></p>
              <p className="text-muted-foreground mb-6">
                Our arcade build team will review your specs and reach out within 1–2 business days with a personalized quote.
              </p>
              <div className="flex gap-2 justify-center">
                <Link to="/store?category=arcade_sales"><Button variant="outline">Browse Prebuilt Machines</Button></Link>
                <Link to="/"><Button>Back Home</Button></Link>
              </div>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background">
      <StarField />
      <Navigation />
      <div className="relative z-10 pt-32 pb-20">
        <div className="container mx-auto px-4 max-w-5xl">
          {/* Hero */}
          <div className="text-center mb-10">
            <Badge className="mb-3 bg-primary/20 text-primary border-primary/40">Built To Order</Badge>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 flex items-center justify-center gap-3">
              <Gamepad2 className="w-10 h-10 text-primary" />
              Custom Multicade Arcade Request
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Design your dream home arcade. Pick cabinet style, controls, monitor, and games — we'll build, test, and deliver.
            </p>
          </div>

          {/* Catalog gallery */}
          {catalog && catalog.length > 0 && (
            <div className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" /> Start From A Prebuilt
                </h2>
                <Link to="/store?category=arcade_sales" className="text-sm text-primary hover:underline">View all →</Link>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Buy as-is from the store, or pick one below as a starting reference for your custom build.
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {catalog.slice(0, 6).map((p: any) => {
                  const selected = form.reference_product_id === p.id;
                  return (
                    <Card
                      key={p.id}
                      className={`bg-card/50 border transition-all cursor-pointer ${selected ? "border-primary ring-2 ring-primary/40" : "border-border/50 hover:border-primary/40"}`}
                      onClick={() => setForm(f => ({ ...f, reference_product_id: selected ? "" : p.id }))}
                    >
                      <div className="h-40 bg-muted rounded-t-lg overflow-hidden flex items-center justify-center">
                        {p.images?.[0] ? (
                          <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <Cpu className="w-12 h-12 text-muted-foreground/30" />
                        )}
                      </div>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="font-semibold leading-tight">{p.name}</h3>
                          <Badge variant="outline" className="capitalize text-[10px]">
                            {p.category === "arcade_refurbished" ? "Refurb" : "New"}
                          </Badge>
                        </div>
                        {p.short_description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{p.short_description}</p>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="font-bold">${Number(p.price).toFixed(2)}</span>
                          <div className="flex gap-2">
                            <Link to={`/store/${p.slug}`} onClick={(e) => e.stopPropagation()}>
                              <Button size="sm" variant="outline">Buy</Button>
                            </Link>
                            <Button size="sm" variant={selected ? "default" : "secondary"}>
                              {selected ? "Selected" : "Use as ref"}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={submit} className="space-y-6">
            <Section title="Contact & Delivery">
              <Grid2>
                <Field label="Full name *"><Input required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></Field>
                <Field label="Email *"><Input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
                <Field label="Phone"><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></Field>
                <Field label="Country"><Input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} /></Field>
                <Field label="Address line 1" className="md:col-span-2"><Input value={form.address_line1} onChange={e => setForm({ ...form, address_line1: e.target.value })} /></Field>
                <Field label="Address line 2" className="md:col-span-2"><Input value={form.address_line2} onChange={e => setForm({ ...form, address_line2: e.target.value })} /></Field>
                <Field label="City"><Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></Field>
                <Field label="State"><Input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} /></Field>
                <Field label="Postal code"><Input value={form.postal_code} onChange={e => setForm({ ...form, postal_code: e.target.value })} /></Field>
              </Grid2>
            </Section>

            <Section title="Cabinet Preferences">
              <Grid2>
                <Field label="Cabinet style">
                  <Select value={form.cabinet_style} onValueChange={v => setForm({ ...form, cabinet_style: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CABINET_STYLES.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Size">
                  <Select value={form.cabinet_size} onValueChange={v => setForm({ ...form, cabinet_size: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SIZES.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Control layout">
                  <Select value={form.control_layout} onValueChange={v => setForm({ ...form, control_layout: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CONTROLS.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Monitor size (inches)">
                  <Select value={form.monitor_size} onValueChange={v => setForm({ ...form, monitor_size: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{MONITORS.map(s => <SelectItem key={s} value={s}>{s}"</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Artwork theme" className="md:col-span-2">
                  <Input placeholder="e.g. Street Fighter, Tron, custom logo, retro neon..." value={form.artwork_theme} onChange={e => setForm({ ...form, artwork_theme: e.target.value })} />
                </Field>
              </Grid2>
              <div className="flex flex-wrap gap-6 mt-4">
                <Toggle label="Trackball" v={form.trackball} on={v => setForm({ ...form, trackball: v })} />
                <Toggle label="Spinner" v={form.spinner} on={v => setForm({ ...form, spinner: v })} />
                <Toggle label="Light Gun" v={form.light_gun} on={v => setForm({ ...form, light_gun: v })} />
              </div>
            </Section>

            <Section title="Games & Software">
              <Label className="mb-2 block">Preferred platforms</Label>
              <div className="flex flex-wrap gap-2 mb-4">
                {PLATFORMS.map(p => (
                  <Badge
                    key={p}
                    onClick={() => togglePlatform(p)}
                    className={`cursor-pointer ${platforms.includes(p) ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/70"}`}
                  >{p}</Badge>
                ))}
              </div>
              <Grid2>
                <Field label="Approx. # of games">
                  <Input type="number" min={0} value={form.approx_game_count} onChange={e => setForm({ ...form, approx_game_count: e.target.value })} />
                </Field>
                <div className="flex items-end">
                  <Toggle label="Online multiplayer support" v={form.online_play} on={v => setForm({ ...form, online_play: v })} />
                </div>
                <Field label="Must-have games / notes" className="md:col-span-2">
                  <Textarea rows={3} placeholder="List specific games or genres you want loaded..." value={form.preferred_games} onChange={e => setForm({ ...form, preferred_games: e.target.value })} />
                </Field>
              </Grid2>
            </Section>

            <Section title="Budget, Timeline & Extras">
              <Grid2>
                <Field label="Budget range">
                  <Select value={form.budget_range} onValueChange={v => setForm({ ...form, budget_range: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{BUDGETS.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Target delivery date">
                  <Input type="date" value={form.target_delivery_date} onChange={e => setForm({ ...form, target_delivery_date: e.target.value })} />
                </Field>
              </Grid2>
              <div className="flex flex-wrap gap-6 mt-4">
                <Toggle label="Interested in financing" v={form.financing_interest} on={v => setForm({ ...form, financing_interest: v })} />
                <Toggle label="Add in-home delivery & setup" v={form.in_home_setup} on={v => setForm({ ...form, in_home_setup: v })} />
              </div>
              <Field label="Additional notes" className="mt-4">
                <Textarea rows={3} value={form.additional_notes} onChange={e => setForm({ ...form, additional_notes: e.target.value })} />
              </Field>
            </Section>

            <div className="flex justify-end">
              <Button type="submit" size="lg" disabled={submitting} className="gap-2">
                {submitting ? "Submitting..." : "Submit Request"} <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </div>
      </div>
      <Footer />
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Card className="bg-card/50 border-border/50">
    <CardContent className="p-6">
      <h2 className="text-xl font-bold mb-4">{title}</h2>
      {children}
    </CardContent>
  </Card>
);
const Grid2 = ({ children }: { children: React.ReactNode }) => (
  <div className="grid md:grid-cols-2 gap-4">{children}</div>
);
const Field = ({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) => (
  <div className={className}>
    <Label className="mb-1.5 block">{label}</Label>
    {children}
  </div>
);
const Toggle = ({ label, v, on }: { label: string; v: boolean; on: (v: boolean) => void }) => (
  <div className="flex items-center gap-2">
    <Switch checked={v} onCheckedChange={on} />
    <Label className="cursor-pointer">{label}</Label>
  </div>
);

export default CustomArcadeRequestPage;
