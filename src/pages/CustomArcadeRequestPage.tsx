import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import StarField from "@/components/StarField";
import CabinetPreview, { type CabinetCustomization } from "@/components/arcade/CabinetPreview";
import ArcadeArtworkUploader, { type ArtworkPaths, type ArtworkPreviews } from "@/components/arcade/ArcadeArtworkUploader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Gamepad2, Cpu, Sparkles, ArrowRight, ArrowLeft, CheckCircle2, Joystick,
  Monitor, Wallet, Truck, Boxes, Palette, Settings2, ImagePlus,
} from "lucide-react";
import { toast } from "sonner";
import { useSEO } from "@/hooks/useSEO";

const CABINET_STYLES = [
  { v: "upright", l: "Upright", d: "Classic stand-up arcade" },
  { v: "deluxe_upright", l: "Deluxe Upright", d: "Deeper premium cabinet" },
  { v: "bartop", l: "Bartop", d: "Countertop mini" },
  { v: "cocktail", l: "Cocktail", d: "Sit-down tabletop" },
  { v: "pedestal", l: "Pedestal", d: "Open-screen setup" },
  { v: "wall_mount", l: "Wall Mount", d: "Space-saving cabinet" },
  { v: "four_player", l: "4-Player", d: "Wide party control deck" },
  { v: "racing", l: "Racing Cockpit", d: "Seat, wheel and pedals" },
  { v: "sit_down", l: "Japanese Sit-Down", d: "Low seated play" },
  { v: "virtual_pinball", l: "Virtual Pinball", d: "Digital playfield cabinet" },
];
const SIZES = [
  { v: "full", l: "Full Size", d: "~68\" tall" },
  { v: "mid", l: "Mid Size", d: "~58\" tall" },
  { v: "mini", l: "Mini", d: "~48\" tall" },
];
const CONTROLS = [
  { v: "1p", l: "1 Player", d: "Single joystick" },
  { v: "2p", l: "2 Player", d: "Head to head" },
  { v: "4p", l: "4 Player", d: "Party setup" },
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

const STEPS = [
  { key: "cabinet", label: "Cabinet", icon: Boxes },
  { key: "appearance", label: "Appearance", icon: Palette },
  { key: "controls", label: "Controls", icon: Joystick },
  { key: "hardware", label: "Hardware", icon: Settings2 },
  { key: "games", label: "Games", icon: Gamepad2 },
  { key: "budget", label: "Budget", icon: Wallet },
  { key: "contact", label: "Delivery", icon: Truck },
];

const DEFAULT_CUSTOMIZATION: CabinetCustomization = {
  bodyColor: "#172033", trimColor: "#12bde8", buttonColor: "#39e58c", joystickColor: "#39e58c",
  finish: "satin", monitorOrientation: "landscape", screenTreatment: "gloss", marqueeType: "led",
  speakerLayout: "stereo", feet: "levelers", coinDoor: true, accessibleControls: false,
  joystickStyle: "competition", buttonLayout: "six", steeringWheel: false, pedals: false,
  flightStick: false, dancePads: false, pinballButtons: false, usbPorts: true,
  computerTier: "performance", storage: "1tb", connectivity: "wifi_ethernet", bluetooth: true,
  lighting: "marquee", cooling: "quiet_fans", audio: "premium_stereo",
};
const COLORS = ["#172033", "#f2f4f7", "#d6263d", "#1261a8", "#13a878", "#e3a62f", "#7b42c3", "#171717"];
const CHOICE = (value: string, label?: string) => ({ v: value, l: label || value.replaceAll("_", " ") });

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
  const [step, setStep] = useState(0);
  const [customization, setCustomization] = useState<CabinetCustomization>({ ...DEFAULT_CUSTOMIZATION });
  const [artwork, setArtwork] = useState<ArtworkPreviews>({});
  const [artworkPaths, setArtworkPaths] = useState<ArtworkPaths>({});
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

  const refProduct = useMemo(
    () => catalog?.find((p: any) => p.id === form.reference_product_id),
    [catalog, form.reference_product_id],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.email.trim()) {
      setStep(STEPS.length - 1);
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
      customization,
      artwork_paths: artworkPaths,
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

  const pct = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="relative min-h-screen bg-background">
      <StarField />
      <Navigation />
      <div className="relative z-10 pt-28 pb-20">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Hero */}
          <div className="text-center mb-8">
            <Badge className="mb-3 bg-primary/20 text-primary border-primary/40">Built To Order</Badge>
            <h1 className="text-4xl md:text-5xl font-bold mb-3 flex items-center justify-center gap-3">
              <Gamepad2 className="w-9 h-9 text-primary" />
              Arcade Builder
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Configure your cabinet step by step and watch it come together live. We build, test, and deliver.
            </p>
          </div>

          {/* Stepper */}
          <div className="mb-8">
            <div className="flex items-center justify-between gap-2 mb-3 overflow-x-auto pb-1">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const active = i === step;
                const passed = i < step;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setStep(i)}
                    className={cn(
                      "flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold whitespace-nowrap transition-smooth",
                      active
                        ? "border-primary bg-primary/15 text-primary border-glow-blue"
                        : passed
                        ? "border-accent/40 bg-accent/10 text-accent"
                        : "border-border/60 bg-card/40 text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    {passed ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                    <span className="hidden sm:inline">{s.label}</span>
                    <span className="sm:hidden">{i + 1}</span>
                  </button>
                );
              })}
            </div>
            <Progress value={pct} className="h-1.5" />
          </div>

          <form onSubmit={submit} className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
            {/* Steps */}
            <div className="space-y-6 min-w-0">
              {step === 0 && (
                <>
                  <Section title="Cabinet Style" icon={Boxes}>
                    <OptionGrid
                      options={CABINET_STYLES}
                      value={form.cabinet_style}
                      onChange={v => setForm({ ...form, cabinet_style: v })}
                    />
                    <Label className="mb-2 mt-6 block">Size</Label>
                    <OptionGrid
                      options={SIZES}
                      value={form.cabinet_size}
                      onChange={v => setForm({ ...form, cabinet_size: v })}
                    />
                    <Field label="Artwork theme" className="mt-6">
                      <Input placeholder="e.g. Street Fighter, Tron, custom logo, retro neon..." value={form.artwork_theme} onChange={e => setForm({ ...form, artwork_theme: e.target.value })} />
                    </Field>
                  </Section>

                  {catalog && catalog.length > 0 && (
                    <Section title="Start From A Prebuilt" icon={Sparkles} action={
                      <Link to="/store?category=arcade_sales" className="text-sm text-primary hover:underline">View all →</Link>
                    }>
                      <p className="text-sm text-muted-foreground mb-4">
                        Buy as-is from the store, or pick one as a starting reference for your build.
                      </p>
                      <div className="grid sm:grid-cols-2 gap-4">
                        {catalog.slice(0, 6).map((p: any) => {
                          const selected = form.reference_product_id === p.id;
                          return (
                            <div
                              key={p.id}
                              onClick={() => setForm(f => ({ ...f, reference_product_id: selected ? "" : p.id }))}
                              className={cn(
                                "group cursor-pointer overflow-hidden rounded-xl border bg-card/50 transition-smooth",
                                selected ? "border-primary ring-2 ring-primary/40" : "border-border/50 hover:border-primary/50",
                              )}
                            >
                              <div className="h-36 bg-muted overflow-hidden flex items-center justify-center">
                                {p.images?.[0] ? (
                                  <img src={p.images[0]} alt={p.name} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                ) : (
                                  <Cpu className="w-12 h-12 text-muted-foreground/30" />
                                )}
                              </div>
                              <div className="p-4">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <h3 className="font-semibold leading-tight text-sm">{p.name}</h3>
                                  <Badge variant="outline" className="capitalize text-[10px]">
                                    {p.category === "arcade_refurbished" ? "Refurb" : "New"}
                                  </Badge>
                                </div>
                                <div className="flex items-center justify-between mt-3">
                                  <span className="font-bold">${Number(p.price).toFixed(2)}</span>
                                  <div className="flex gap-2">
                                    <Link to={`/store/${p.slug}`} onClick={(e) => e.stopPropagation()}>
                                      <Button type="button" size="sm" variant="outline">Buy</Button>
                                    </Link>
                                    <Button type="button" size="sm" variant={selected ? "default" : "secondary"}>
                                      {selected ? "Selected" : "Use as ref"}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Section>
                  )}
                </>
              )}

              {step === 1 && (
                <div className="space-y-6">
                  <Section title="Materials & Color" icon={Palette}>
                    <ColorChoice label="Cabinet body" value={customization.bodyColor} onChange={bodyColor => setCustomization({ ...customization, bodyColor })} />
                    <ColorChoice label="Trim & T-molding" value={customization.trimColor} onChange={trimColor => setCustomization({ ...customization, trimColor })} />
                    <div className="grid sm:grid-cols-2 gap-4 mt-5">
                      <Field label="Finish"><ChoiceSelect value={customization.finish} options={[CHOICE("satin"), CHOICE("matte"), CHOICE("gloss"), CHOICE("woodgrain"), CHOICE("metallic")]} onChange={finish => setCustomization({ ...customization, finish })} /></Field>
                      <Field label="Marquee"><ChoiceSelect value={customization.marqueeType} options={[CHOICE("led", "LED backlit"), CHOICE("edge_lit", "Edge lit"), CHOICE("unlit"), CHOICE("digital", "Digital display")]} onChange={marqueeType => setCustomization({ ...customization, marqueeType })} /></Field>
                    </div>
                  </Section>
                  <Section title="Custom Artwork" icon={ImagePlus}>
                    <p className="mb-4 text-sm text-muted-foreground">Upload each surface separately. Your images appear on the cabinet as soon as they finish uploading.</p>
                    <ArcadeArtworkUploader previews={artwork} paths={artworkPaths} onChange={(nextArtwork, nextPaths) => { setArtwork(nextArtwork); setArtworkPaths(nextPaths); }} />
                    <Field label="Artwork direction" className="mt-5"><Input placeholder="Theme, characters, logos, colors, or notes for our designer" value={form.artwork_theme} onChange={e => setForm({ ...form, artwork_theme: e.target.value })} /></Field>
                  </Section>
                </div>
              )}

              {step === 2 && (
                <Section title="Controls & Display" icon={Monitor}>
                  <Label className="mb-2 block">Control layout</Label>
                  <OptionGrid
                    options={CONTROLS}
                    value={form.control_layout}
                    onChange={v => setForm({ ...form, control_layout: v })}
                  />
                  <Label className="mb-2 mt-6 block">Monitor size</Label>
                  <div className="flex flex-wrap gap-2">
                    {MONITORS.map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setForm({ ...form, monitor_size: m })}
                        className={cn(
                          "rounded-lg border px-4 py-2 text-sm font-semibold transition-smooth",
                          form.monitor_size === m
                            ? "border-primary bg-primary/15 text-primary border-glow-blue"
                            : "border-border/60 bg-card/40 text-muted-foreground hover:border-primary/40",
                        )}
                      >{m}"</button>
                    ))}
                  </div>
                  <div className="grid sm:grid-cols-3 gap-3 mt-6">
                    <AddOn label="Trackball" desc="Golden Tee, Centipede" v={form.trackball} on={v => setForm({ ...form, trackball: v })} />
                    <AddOn label="Spinner" desc="Arkanoid, Tempest" v={form.spinner} on={v => setForm({ ...form, spinner: v })} />
                    <AddOn label="Light Gun" desc="Time Crisis, Duck Hunt" v={form.light_gun} on={v => setForm({ ...form, light_gun: v })} />
                  </div>
                </Section>
              )}

              {step === 2 && (
                <Section title="Games & Software" icon={Gamepad2}>
                  <Label className="mb-2 block">Preferred platforms</Label>
                  <div className="flex flex-wrap gap-2 mb-6">
                    {PLATFORMS.map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => togglePlatform(p)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-semibold transition-smooth",
                          platforms.includes(p)
                            ? "border-accent bg-accent/20 text-accent"
                            : "border-border/60 bg-card/40 text-muted-foreground hover:border-accent/40",
                        )}
                      >{p}</button>
                    ))}
                  </div>
                  <Grid2>
                    <Field label="Approx. # of games">
                      <Input type="number" min={0} value={form.approx_game_count} onChange={e => setForm({ ...form, approx_game_count: e.target.value })} />
                    </Field>
                    <div className="flex items-end">
                      <AddOn label="Online multiplayer" desc="Netplay support" v={form.online_play} on={v => setForm({ ...form, online_play: v })} />
                    </div>
                    <Field label="Must-have games / notes" className="md:col-span-2">
                      <Textarea rows={4} placeholder="List specific games or genres you want loaded..." value={form.preferred_games} onChange={e => setForm({ ...form, preferred_games: e.target.value })} />
                    </Field>
                  </Grid2>
                </Section>
              )}

              {step === 5 && (
                <Section title="Budget, Timeline & Extras" icon={Wallet}>
                  <Label className="mb-2 block">Budget range</Label>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {BUDGETS.map(b => (
                      <button
                        key={b.v}
                        type="button"
                        onClick={() => setForm({ ...form, budget_range: b.v })}
                        className={cn(
                          "rounded-lg border px-4 py-3 text-left text-sm font-semibold transition-smooth",
                          form.budget_range === b.v
                            ? "border-primary bg-primary/15 text-primary border-glow-blue"
                            : "border-border/60 bg-card/40 text-muted-foreground hover:border-primary/40",
                        )}
                      >{b.l}</button>
                    ))}
                  </div>
                  <Field label="Target delivery date" className="mt-6 max-w-xs">
                    <Input type="date" value={form.target_delivery_date} onChange={e => setForm({ ...form, target_delivery_date: e.target.value })} />
                  </Field>
                  <div className="grid sm:grid-cols-2 gap-3 mt-6">
                    <AddOn label="Financing" desc="Interested in payment plans" v={form.financing_interest} on={v => setForm({ ...form, financing_interest: v })} />
                    <AddOn label="In-home setup" desc="Delivery & installation" v={form.in_home_setup} on={v => setForm({ ...form, in_home_setup: v })} />
                  </div>
                  <Field label="Additional notes" className="mt-6">
                    <Textarea rows={3} value={form.additional_notes} onChange={e => setForm({ ...form, additional_notes: e.target.value })} />
                  </Field>
                </Section>
              )}

              {step === 6 && (
                <Section title="Contact & Delivery" icon={Truck}>
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
              )}

              {/* Nav */}
              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={step === 0}
                  onClick={() => { setStep(s => Math.max(0, s - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  className="gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </Button>
                {step < STEPS.length - 1 ? (
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => { setStep(s => Math.min(STEPS.length - 1, s + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className="gap-2"
                  >
                    Next: {STEPS[step + 1].label} <ArrowRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button type="submit" size="lg" disabled={submitting} className="gap-2">
                    {submitting ? "Submitting..." : "Submit Request"} <ArrowRight className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Live preview */}
            <aside className="lg:sticky lg:top-24 space-y-4">
              <Card className="bg-card/60 border-primary/30 overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-primary">Live Preview</h3>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {CABINET_STYLES.find(c => c.v === form.cabinet_style)?.l}
                    </Badge>
                  </div>
                  <CabinetPreview
                    style={form.cabinet_style}
                    size={form.cabinet_size}
                    monitor={form.monitor_size}
                    controls={form.control_layout}
                    trackball={form.trackball}
                    spinner={form.spinner}
                    lightGun={form.light_gun}
                    theme={form.artwork_theme}
                  />
                  <dl className="mt-4 space-y-2 text-sm">
                    <Row k="Size" v={SIZES.find(s => s.v === form.cabinet_size)?.l} />
                    <Row k="Controls" v={CONTROLS.find(c => c.v === form.control_layout)?.l} />
                    <Row k="Monitor" v={`${form.monitor_size}"`} />
                    <Row k="Platforms" v={platforms.length ? `${platforms.length} selected` : "—"} />
                    <Row k="Add-ons" v={[form.trackball && "Trackball", form.spinner && "Spinner", form.light_gun && "Light gun"].filter(Boolean).join(", ") || "—"} />
                    <Row k="Budget" v={BUDGETS.find(b => b.v === form.budget_range)?.l} />
                    {refProduct && <Row k="Reference" v={(refProduct as any).name} />}
                  </dl>
                </CardContent>
              </Card>
              <p className="text-xs text-muted-foreground text-center px-2">
                Preview is illustrative. Final build specs are confirmed in your quote.
              </p>
            </aside>
          </form>
        </div>
      </div>
      <Footer />
    </div>
  );
};

const Section = ({ title, icon: Icon, action, children }: { title: string; icon?: any; action?: React.ReactNode; children: React.ReactNode }) => (
  <Card className="bg-card/50 border-border/50">
    <CardContent className="p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          {Icon && <Icon className="w-5 h-5 text-primary" />} {title}
        </h2>
        {action}
      </div>
      {children}
    </CardContent>
  </Card>
);

const OptionGrid = ({ options, value, onChange }: { options: { v: string; l: string; d?: string }[]; value: string; onChange: (v: string) => void }) => (
  <div className="grid sm:grid-cols-3 gap-3">
    {options.map(o => (
      <button
        key={o.v}
        type="button"
        onClick={() => onChange(o.v)}
        className={cn(
          "rounded-xl border px-4 py-3 text-left transition-smooth",
          value === o.v
            ? "border-primary bg-primary/15 border-glow-blue"
            : "border-border/60 bg-card/40 hover:border-primary/40",
        )}
      >
        <span className={cn("block text-sm font-bold", value === o.v ? "text-primary" : "text-foreground")}>{o.l}</span>
        {o.d && <span className="block text-xs text-muted-foreground mt-0.5">{o.d}</span>}
      </button>
    ))}
  </div>
);

const AddOn = ({ label, desc, v, on }: { label: string; desc?: string; v: boolean; on: (v: boolean) => void }) => (
  <div className={cn(
    "flex items-start justify-between gap-3 rounded-xl border px-4 py-3 w-full transition-smooth",
    v ? "border-accent/60 bg-accent/10" : "border-border/60 bg-card/40",
  )}>
    <div>
      <p className="text-sm font-semibold">{label}</p>
      {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
    </div>
    <Switch checked={v} onCheckedChange={on} />
  </div>
);

const Row = ({ k, v }: { k: string; v?: string }) => (
  <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-1.5 last:border-0">
    <dt className="text-muted-foreground text-xs uppercase tracking-wide">{k}</dt>
    <dd className="font-semibold text-right truncate max-w-[60%]">{v || "—"}</dd>
  </div>
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

const ChoiceSelect = ({ value, options, onChange }: { value: string; options: { v: string; l: string }[]; onChange: (value: string) => void }) => (
  <Select value={value} onValueChange={onChange}><SelectTrigger className="capitalize"><SelectValue /></SelectTrigger><SelectContent>{options.map(option => <SelectItem key={option.v} value={option.v} className="capitalize">{option.l}</SelectItem>)}</SelectContent></Select>
);

const ColorChoice = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => (
  <div className="mt-4"><Label className="mb-2 block">{label}</Label><div className="flex flex-wrap items-center gap-2">{COLORS.map(color => <button key={color} type="button" aria-label={`${label} ${color}`} onClick={() => onChange(color)} className={cn("h-9 w-9 rounded-full border-2 transition-transform hover:scale-105", value === color ? "border-primary ring-2 ring-primary/30" : "border-border")} style={{ backgroundColor: color }} />)}<Input type="color" value={value} onChange={event => onChange(event.target.value)} className="h-9 w-12 cursor-pointer p-1" aria-label={`Custom ${label.toLowerCase()}`} /></div></div>
);

export default CustomArcadeRequestPage;
