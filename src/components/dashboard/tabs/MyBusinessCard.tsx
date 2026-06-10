import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { ExternalLink, Save, Copy, IdCard, Smartphone, Radio, Building2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

type Division = { id: string; name: string; slug: string };

const MyBusinessCard = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [showShareQR, setShowShareQR] = useState(false);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    avatar_url: "",
    job_title: "",
    department: "",
    bio: "",
    linkedin_url: "",
    website_url: "",
    card_slug: "",
    card_public: true,
    card_accent_color: "#3B82F6",
    division_ids: [] as string[],
  });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const [{ data: profile }, { data: divs }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("divisions").select("id,name,slug").order("name"),
      ]);
      setDivisions((divs as Division[]) || []);

      if (profile) {
        setForm({
          full_name: profile.full_name || "",
          email: profile.email || user.email || "",
          phone: profile.phone || "",
          avatar_url: profile.avatar_url || "",
          job_title: profile.job_title || "",
          department: profile.department || "",
          bio: profile.bio || "",
          linkedin_url: profile.linkedin_url || "",
          website_url: profile.website_url || "",
          card_slug: profile.card_slug || "",
          card_public: profile.card_public ?? true,
          card_accent_color: profile.card_accent_color || "#3B82F6",
          division_ids: (profile as any).division_ids || [],
        });
      }
      setLoading(false);
    })();
  }, []);

  const toggleDivision = (id: string) => {
    setForm((f) => ({
      ...f,
      division_ids: f.division_ids.includes(id)
        ? f.division_ids.filter((d) => d !== id)
        : [...f.division_ids, id],
    }));
  };

  const save = async () => {
    setSaving(true);
    const slug = form.card_slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-") || null;
    const { error } = await supabase
      .from("profiles")
      .update({ ...form, card_slug: slug })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (slug) setForm((f) => ({ ...f, card_slug: slug }));
    toast.success("Business card saved");
  };

  const cardUrl = `https://vendxglobal.net/card/${form.card_slug || userId}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(cardUrl);
    toast.success("Link copied");
  };

  const tapToShare = () => {
    setShowShareQR(true);
  };

  const writeNfcTag = async () => {
    if (typeof window === "undefined" || !("NDEFReader" in window)) {
      toast.error("NFC writing requires Chrome on Android. iPhones can't program tags from the browser — use the 'NFC Tools' app.");
      return;
    }
    try {
      // @ts-ignore - Web NFC not in lib.dom
      const ndef = new NDEFReader();
      toast.info("Hold a blank NFC tag against the back of your phone…");
      // @ts-ignore
      await ndef.write({ records: [{ recordType: "url", data: cardUrl }] });
      toast.success("NFC tag programmed!");
    } catch (e: any) {
      toast.error(e?.message || "Could not write to NFC tag");
    }
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <IdCard className="w-6 h-6 text-primary" />
          My Business Card
        </h1>
        <p className="text-muted-foreground mt-1">
          Your shareable digital business card. NFC-ready, QR-friendly, and saves directly to phones.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your shareable link</CardTitle>
          <CardDescription>Visible to anyone with the link when public is on.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <code className="px-2 py-1 rounded bg-muted break-all flex-1 min-w-0">{cardUrl}</code>
            <Button size="sm" variant="outline" onClick={copyLink}><Copy className="w-4 h-4 mr-1" />Copy</Button>
            <Button size="sm" variant="outline" asChild>
              <Link to={`/card/${form.card_slug || userId}`} target="_blank">
                <ExternalLink className="w-4 h-4 mr-1" />Preview
              </Link>
            </Button>
            <Button size="sm" variant="outline" onClick={tapToShare}><Smartphone className="w-4 h-4 mr-1" />Tap to Share</Button>
            <Button size="sm" variant="outline" onClick={writeNfcTag}><Radio className="w-4 h-4 mr-1" />Program NFC Tag</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Tap-to-Share instantly opens a fullscreen QR — the other phone scans it with the camera, no app or share menu needed. Program NFC Tag writes your card URL to a blank NFC sticker/card (Android Chrome only); after that, both iPhones and Androids open your card just by tapping the sticker.
          </p>
          {showShareQR && (
            <div className="mt-3 flex flex-col items-center gap-2 rounded-lg bg-white p-4">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(cardUrl)}`}
                alt="Scan to view business card"
                width={220}
                height={220}
              />
              <p className="text-xs text-gray-600 break-all text-center">{cardUrl}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Card Details</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Full Name</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <Label>Job Title</Label>
            <Input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
          </div>
          <div>
            <Label>Department</Label>
            <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Operations, Engineering, …" />
          </div>
          <div>
            <Label>Custom URL Slug</Label>
            <Input value={form.card_slug} onChange={(e) => setForm({ ...form, card_slug: e.target.value })} placeholder="jane-doe" />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 555 123 4567" />
          </div>
          <div className="sm:col-span-2">
            <Label>Avatar Image URL</Label>
            <Input value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} placeholder="https://…/photo.jpg" />
          </div>
          <div>
            <Label>LinkedIn</Label>
            <Input value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} placeholder="https://linkedin.com/in/…" />
          </div>
          <div>
            <Label>Website</Label>
            <Input value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} placeholder="https://…" />
          </div>
          <div className="sm:col-span-2">
            <Label>Bio</Label>
            <Textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          </div>
          <div>
            <Label>Accent Color</Label>
            <div className="flex gap-2 items-center">
              <Input type="color" value={form.card_accent_color} onChange={(e) => setForm({ ...form, card_accent_color: e.target.value })} className="w-16 h-10 p-1" />
              <Input value={form.card_accent_color} onChange={(e) => setForm({ ...form, card_accent_color: e.target.value })} />
            </div>
          </div>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Label>Public Card</Label>
              <p className="text-xs text-muted-foreground">Off = link returns "not found"</p>
            </div>
            <Switch checked={form.card_public} onCheckedChange={(v) => setForm({ ...form, card_public: v })} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="gap-2">
          <Save className="w-4 h-4" />
          {saving ? "Saving…" : "Save Card"}
        </Button>
      </div>
    </div>
  );
};

export default MyBusinessCard;
