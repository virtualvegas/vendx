import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, Star, DollarSign, Gamepad2 } from "lucide-react";

interface PriceBundle {
  plays: number;
  price: number;
  label: string;
}

interface PricingTemplate {
  id: string;
  name: string;
  description: string | null;
  price_per_play: number;
  bundles: PriceBundle[];
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

export const ArcadePricingTemplates = () => {
  const [templates, setTemplates] = useState<PricingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PricingTemplate | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    price_per_play: 1.00,
    bundles: [{ plays: 2, price: 1.50, label: "2 Plays" }] as PriceBundle[],
    is_active: true,
  });
  const { toast } = useToast();

  const fetchTemplates = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("arcade_pricing_templates")
      .select("*")
      .order("is_default", { ascending: false })
      .order("name");

    if (error) {
      console.error("Error fetching templates:", error);
    } else {
      setTemplates((data || []).map(t => ({
        ...t,
        bundles: (t.bundles as unknown as PriceBundle[]) || [],
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleSave = async () => {
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        price_per_play: form.price_per_play,
        bundles: JSON.parse(JSON.stringify(form.bundles)),
        is_active: form.is_active,
      };

      if (editingTemplate) {
        const { error } = await supabase
          .from("arcade_pricing_templates")
          .update(payload)
          .eq("id", editingTemplate.id);
        if (error) throw error;
        toast({ title: "Template updated" });
      } else {
        const { error } = await supabase
          .from("arcade_pricing_templates")
          .insert(payload);
        if (error) throw error;
        toast({ title: "Template created" });
      }

      setShowDialog(false);
      resetForm();
      fetchTemplates();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("arcade_pricing_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Template deleted" });
      fetchTemplates();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      // First, unset all defaults
      await supabase
        .from("arcade_pricing_templates")
        .update({ is_default: false })
        .neq("id", id);

      // Set new default
      const { error } = await supabase
        .from("arcade_pricing_templates")
        .update({ is_default: true })
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Default template updated" });
      fetchTemplates();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const resetForm = () => {
    setForm({
      name: "",
      description: "",
      price_per_play: 1.00,
      bundles: [{ plays: 2, price: 1.50, label: "2 Plays" }],
      is_active: true,
    });
    setEditingTemplate(null);
  };

  const openEdit = (template: PricingTemplate) => {
    setEditingTemplate(template);
    setForm({
      name: template.name,
      description: template.description || "",
      price_per_play: template.price_per_play,
      bundles: template.bundles.length > 0 ? template.bundles : [{ plays: 2, price: 1.50, label: "2 Plays" }],
      is_active: template.is_active,
    });
    setShowDialog(true);
  };

  const addBundle = () => {
    setForm(prev => ({
      ...prev,
      bundles: [...prev.bundles, { plays: 5, price: 4.00, label: "5 Plays" }],
    }));
  };

  const updateBundle = (index: number, field: keyof PriceBundle, value: string | number) => {
    setForm(prev => ({
      ...prev,
      bundles: prev.bundles.map((b, i) => 
        i === index ? { ...b, [field]: field === "label" ? value : Number(value) } : b
      ),
    }));
  };

  const removeBundle = (index: number) => {
    setForm(prev => ({
      ...prev,
      bundles: prev.bundles.filter((_, i) => i !== index),
    }));
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Arcade Pricing Templates
          </h3>
          <p className="text-sm text-muted-foreground">
            Create global pricing templates that can be applied to multiple arcade machines
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowDialog(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map(template => (
          <Card key={template.id} className={!template.is_active ? "opacity-60" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    {template.name}
                    {template.is_default && (
                      <Badge variant="secondary" className="text-xs">
                        <Star className="w-3 h-3 mr-1 fill-current" />
                        Default
                      </Badge>
                    )}
                  </CardTitle>
                  {template.description && (
                    <CardDescription className="text-xs mt-1">
                      {template.description}
                    </CardDescription>
                  )}
                </div>
                <Badge variant={template.is_active ? "default" : "outline"}>
                  {template.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">Price per play</span>
                <span className="font-bold text-lg">${template.price_per_play.toFixed(2)}</span>
              </div>

              {template.bundles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Bundle Options:</p>
                  {template.bundles.map((bundle, i) => (
                    <div key={i} className="flex justify-between text-sm p-2 bg-muted/50 rounded">
                      <span>{bundle.label}</span>
                      <span className="font-medium">${bundle.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(template)}>
                  <Edit className="w-3 h-3 mr-1" />
                  Edit
                </Button>
                {!template.is_default && (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleSetDefault(template.id)}
                    >
                      <Star className="w-3 h-3" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleDelete(template.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Pricing Template" : "Create Pricing Template"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Standard Arcade"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>

            <div className="space-y-2">
              <Label>Price Per Play ($)</Label>
              <Input
                type="number"
                step="0.25"
                min="0.25"
                value={form.price_per_play}
                onChange={(e) => setForm({ ...form, price_per_play: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Bundle Options</Label>
                <Button type="button" variant="outline" size="sm" onClick={addBundle}>
                  <Plus className="w-3 h-3 mr-1" />
                  Add Bundle
                </Button>
              </div>

              {form.bundles.map((bundle, index) => (
                <div key={index} className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Label</Label>
                    <Input
                      value={bundle.label}
                      onChange={(e) => updateBundle(index, "label", e.target.value)}
                      placeholder="2 Plays"
                    />
                  </div>
                  <div className="w-20 space-y-1">
                    <Label className="text-xs">Plays</Label>
                    <Input
                      type="number"
                      min="1"
                      value={bundle.plays}
                      onChange={(e) => updateBundle(index, "plays", e.target.value)}
                    />
                  </div>
                  <div className="w-24 space-y-1">
                    <Label className="text-xs">Price</Label>
                    <Input
                      type="number"
                      step="0.25"
                      min="0"
                      value={bundle.price}
                      onChange={(e) => updateBundle(index, "price", e.target.value)}
                    />
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon"
                    onClick={() => removeBundle(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
              />
              <Label>Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave}>
              {editingTemplate ? "Update" : "Create"} Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
