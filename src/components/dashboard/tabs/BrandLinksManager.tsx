import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Pencil, Plus, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

type BrandLink = {
  id: string;
  name: string;
  slug: string;
  url: string;
  description: string;
  icon: string;
  color: string;
  badge: string | null;
  section: string;
  sort_order: number;
  is_external: boolean;
  is_featured: boolean;
  is_active: boolean;
};

const EMPTY: Omit<BrandLink, "id"> = {
  name: "", slug: "", url: "", description: "", icon: "Sparkles",
  color: "from-primary to-accent", badge: "", section: "divisions",
  sort_order: 0, is_external: true, is_featured: false, is_active: true,
};

const ICON_OPTIONS = ["Sparkles","Shirt","PartyPopper","Gamepad2","Rocket","ShoppingBag","Wallet","Ticket","Award","MapPin","Zap","Briefcase","Megaphone","Info","Newspaper","Users","Phone","Globe","Star","Heart","Music","Film","Camera","Coffee"];
const COLOR_PRESETS = [
  "from-fuchsia-600 to-purple-900","from-orange-500 to-pink-500","from-purple-500 to-pink-500",
  "from-violet-500 to-indigo-500","from-red-600 to-orange-500","from-primary to-blue-400",
  "from-accent to-emerald-400","from-yellow-500 to-orange-500","from-cyan-500 to-blue-500",
  "from-amber-500 to-yellow-400","from-slate-500 to-gray-400","from-teal-500 to-cyan-500",
];

export default function BrandLinksManager() {
  const [links, setLinks] = useState<BrandLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BrandLink | null>(null);
  const [form, setForm] = useState<Omit<BrandLink, "id">>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("vendx_brand_links" as any)
      .select("*")
      .order("section").order("sort_order");
    if (error) toast.error(error.message);
    else setLinks((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (l: BrandLink) => {
    setEditing(l);
    setForm({ ...l, badge: l.badge ?? "" });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.url.trim()) { toast.error("Name and URL required"); return; }
    setSaving(true);
    const slug = form.slug.trim() || form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const payload = { ...form, slug, badge: form.badge?.trim() || null };
    const { error } = editing
      ? await supabase.from("vendx_brand_links" as any).update(payload).eq("id", editing.id)
      : await supabase.from("vendx_brand_links" as any).insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Updated" : "Created");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this brand link?")) return;
    const { error } = await supabase.from("vendx_brand_links" as any).delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); load(); }
  };

  const toggleActive = async (l: BrandLink) => {
    const { error } = await supabase.from("vendx_brand_links" as any).update({ is_active: !l.is_active }).eq("id", l.id);
    if (error) toast.error(error.message);
    else load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Brand Links</h2>
          <p className="text-sm text-muted-foreground">Manage the Brands tab on the public /links page.</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> New Brand Link</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : (
        <div className="grid gap-3">
          {links.map((l) => (
            <Card key={l.id} className={!l.is_active ? "opacity-60" : ""}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${l.color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                  {l.icon.slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{l.name}</h3>
                    {l.badge && <Badge variant="outline" className="text-[10px]">{l.badge}</Badge>}
                    <Badge variant="secondary" className="text-[10px]">{l.section}</Badge>
                    {l.is_featured && <Badge className="text-[10px] bg-primary/20 text-primary border-primary/30">Featured</Badge>}
                    {!l.is_active && <Badge variant="destructive" className="text-[10px]">Inactive</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{l.description}</p>
                  <p className="text-xs text-primary/70 mt-1 flex items-center gap-1">
                    {l.is_external && <ExternalLink className="w-3 h-3" />}
                    {l.url}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Switch checked={l.is_active} onCheckedChange={() => toggleActive(l)} />
                  <Button size="icon" variant="ghost" onClick={() => openEdit(l)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(l.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {links.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No brand links yet.</p>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Brand Link" : "New Brand Link"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto from name" /></div>
            </div>
            <div><Label>URL *</Label><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://... or /internal-path" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Icon (Lucide)</Label>
                <Select value={form.icon} onValueChange={(v) => setForm({ ...form, icon: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-64">{ICON_OPTIONS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Section</Label>
                <Select value={form.section} onValueChange={(v) => setForm({ ...form, section: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="featured">Featured Partner Brands</SelectItem>
                    <SelectItem value="divisions">VendX Divisions</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Color Gradient</Label>
              <Select value={form.color} onValueChange={(v) => setForm({ ...form, color: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLOR_PRESETS.map((c) => (
                    <SelectItem key={c} value={c}>
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-4 rounded bg-gradient-to-br ${c}`} />
                        <span className="text-xs">{c}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label>Badge (optional)</Label><Input value={form.badge ?? ""} onChange={(e) => setForm({ ...form, badge: e.target.value })} /></div>
              <div><Label>Sort Order</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} /></div>
            </div>
            <div className="grid sm:grid-cols-3 gap-3 pt-2">
              <label className="flex items-center gap-2"><Switch checked={form.is_external} onCheckedChange={(v) => setForm({ ...form, is_external: v })} /> External</label>
              <label className="flex items-center gap-2"><Switch checked={form.is_featured} onCheckedChange={(v) => setForm({ ...form, is_featured: v })} /> Featured</label>
              <label className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /> Active</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
