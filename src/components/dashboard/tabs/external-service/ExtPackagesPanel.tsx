import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";

const ICON_OPTIONS = [
  "Wrench", "Monitor", "Cpu", "Sparkles", "Truck", "Gamepad2",
  "Home", "ShieldCheck", "Settings", "Cog", "Zap", "Hammer",
  "Package", "Star", "Heart", "Phone",
];

const CATEGORY_OPTIONS = [
  { value: "in_home_arcade", label: "In-Home Arcade" },
  { value: "commercial_arcade", label: "Commercial Arcade" },
  { value: "vending", label: "Vending" },
  { value: "pinball", label: "Pinball" },
  { value: "other", label: "Other" },
];

const empty = {
  slug: "",
  title: "",
  icon: "Wrench",
  price_label: "Quoted",
  price_amount: "",
  description: "",
  features: "",
  category: "in_home_arcade",
  machine_type: "arcade_home",
  sort_order: 0,
  is_active: true,
};

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

const ExtPackagesPanel = () => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(empty);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ["ext-service-packages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendx_external_service_packages" as any)
        .select("*")
        .order("category")
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
  });

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (pkg: any) => {
    setEditing(pkg);
    setForm({
      slug: pkg.slug,
      title: pkg.title,
      icon: pkg.icon,
      price_label: pkg.price_label,
      price_amount: pkg.price_amount ?? "",
      description: pkg.description ?? "",
      features: Array.isArray(pkg.features) ? pkg.features.join("\n") : "",
      category: pkg.category,
      machine_type: pkg.machine_type,
      sort_order: pkg.sort_order,
      is_active: pkg.is_active,
    });
    setOpen(true);
  };

  const submit = async () => {
    const slug = form.slug ? slugify(form.slug) : slugify(form.title);
    if (!slug || !form.title) {
      toast.error("Title is required");
      return;
    }
    const payload: any = {
      slug,
      title: form.title.trim(),
      icon: form.icon || "Wrench",
      price_label: form.price_label?.trim() || "Quoted",
      price_amount: form.price_amount === "" ? null : Number(form.price_amount),
      description: form.description ?? "",
      features: form.features
        ? form.features.split("\n").map((s: string) => s.trim()).filter(Boolean)
        : [],
      category: form.category,
      machine_type: form.machine_type || "arcade_home",
      sort_order: Number(form.sort_order) || 0,
      is_active: !!form.is_active,
    };

    const { error } = editing
      ? await supabase
          .from("vendx_external_service_packages" as any)
          .update(payload)
          .eq("id", editing.id)
      : await supabase.from("vendx_external_service_packages" as any).insert(payload);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? "Package updated" : "Package created");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["ext-service-packages"] });
    qc.invalidateQueries({ queryKey: ["public-ext-service-packages"] });
  };

  const remove = async (pkg: any) => {
    if (!confirm(`Delete package "${pkg.title}"?`)) return;
    const { error } = await supabase
      .from("vendx_external_service_packages" as any)
      .delete()
      .eq("id", pkg.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["ext-service-packages"] });
    qc.invalidateQueries({ queryKey: ["public-ext-service-packages"] });
  };

  const toggleActive = async (pkg: any) => {
    const { error } = await supabase
      .from("vendx_external_service_packages" as any)
      .update({ is_active: !pkg.is_active })
      .eq("id", pkg.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["ext-service-packages"] });
    qc.invalidateQueries({ queryKey: ["public-ext-service-packages"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Service Packages</h2>
          <p className="text-sm text-muted-foreground">
            Manage the package presets shown on landing pages and the intake form.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" /> Add Package
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : packages.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">No packages yet.</Card>
      ) : (
        <div className="grid gap-2">
          {packages.map((pkg: any) => (
            <Card key={pkg.id} className="p-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <GripVertical className="w-4 h-4 text-muted-foreground mt-1 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{pkg.title}</p>
                      <Badge variant="outline" className="text-xs">{pkg.category}</Badge>
                      <Badge variant="secondary" className="text-xs">{pkg.price_label}</Badge>
                      {!pkg.is_active && <Badge variant="destructive" className="text-xs">Hidden</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{pkg.slug}</p>
                    {pkg.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{pkg.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Switch checked={pkg.is_active} onCheckedChange={() => toggleActive(pkg)} />
                  <Button size="sm" variant="outline" onClick={() => openEdit(pkg)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => remove(pkg)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Package" : "New Package"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Title *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <Label>Slug (auto if blank)</Label>
                <Input
                  value={form.slug}
                  placeholder={slugify(form.title)}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <SearchableSelect
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v })}
                  options={CATEGORY_OPTIONS}
                  placeholder="Category"
                  searchPlaceholder="Search..."
                />
              </div>
              <div>
                <Label>Machine Type</Label>
                <Input
                  value={form.machine_type}
                  onChange={(e) => setForm({ ...form, machine_type: e.target.value })}
                  placeholder="arcade_home"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Icon</Label>
                <SearchableSelect
                  value={form.icon}
                  onValueChange={(v) => setForm({ ...form, icon: v })}
                  options={ICON_OPTIONS.map((i) => ({ value: i, label: i }))}
                  placeholder="Icon"
                  searchPlaceholder="Search..."
                />
              </div>
              <div>
                <Label>Price Label</Label>
                <Input
                  value={form.price_label}
                  onChange={(e) => setForm({ ...form, price_label: e.target.value })}
                  placeholder="From $89"
                />
              </div>
              <div>
                <Label>Price Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.price_amount}
                  onChange={(e) => setForm({ ...form, price_amount: e.target.value })}
                  placeholder="89"
                />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <Label>Features (one per line)</Label>
              <Textarea
                rows={5}
                value={form.features}
                onChange={(e) => setForm({ ...form, features: e.target.value })}
                placeholder={"1 hour on-site\nMulti-meter / boot tests\nWritten estimate"}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                />
                <Label>Active (visible publicly)</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit}>{editing ? "Save Changes" : "Create Package"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExtPackagesPanel;
