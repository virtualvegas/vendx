import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DollarSign, Layout } from "lucide-react";

interface PriceBundle {
  plays: number;
  price: number;
  label: string;
}

interface PricingTemplate {
  id: string;
  name: string;
  price_per_play: number;
  bundles: PriceBundle[];
}

interface Machine {
  id: string;
  name: string;
  machine_code: string;
  machine_type: string;
  price_per_play: number | null;
  plays_per_bundle: number | null;
  bundle_price: number | null;
  pricing_template_id: string | null;
}

interface MachinePricingEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  machine: Machine | null;
  onSaved: () => void;
}

export const MachinePricingEditor = ({
  open,
  onOpenChange,
  machine,
  onSaved,
}: MachinePricingEditorProps) => {
  const [templates, setTemplates] = useState<PricingTemplate[]>([]);
  const [pricingMode, setPricingMode] = useState<"template" | "custom">("custom");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [pricePerPlay, setPricePerPlay] = useState(1.00);
  const [playsPerBundle, setPlaysPerBundle] = useState(1);
  const [bundlePrice, setBundlePrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchTemplates = async () => {
      const { data } = await supabase
        .from("arcade_pricing_templates")
        .select("id, name, price_per_play, bundles")
        .eq("is_active", true)
        .order("is_default", { ascending: false });
      
      setTemplates((data || []).map(t => ({
        ...t,
        bundles: (t.bundles as unknown as PriceBundle[]) || [],
      })));
    };
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (machine) {
      if (machine.pricing_template_id) {
        setPricingMode("template");
        setSelectedTemplate(machine.pricing_template_id);
      } else {
        setPricingMode("custom");
        setPricePerPlay(machine.price_per_play || 1.00);
        setPlaysPerBundle(machine.plays_per_bundle || 1);
        setBundlePrice(machine.bundle_price);
      }
    }
  }, [machine]);

  const handleSave = async () => {
    if (!machine) return;
    setLoading(true);

    try {
      const updateData: Record<string, any> = {};

      if (pricingMode === "template" && selectedTemplate) {
        updateData.pricing_template_id = selectedTemplate;
        updateData.price_per_play = null;
        updateData.plays_per_bundle = null;
        updateData.bundle_price = null;
      } else {
        updateData.pricing_template_id = null;
        updateData.price_per_play = pricePerPlay;
        updateData.plays_per_bundle = playsPerBundle;
        updateData.bundle_price = bundlePrice;
      }

      const { error } = await supabase
        .from("vendx_machines")
        .update(updateData)
        .eq("id", machine.id);

      if (error) throw error;

      toast({ title: "Pricing updated successfully" });
      onSaved();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const selectedTemplateData = templates.find(t => t.id === selectedTemplate);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Set Pricing - {machine?.name}
          </DialogTitle>
          <DialogDescription>
            Configure pricing for this arcade machine
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <RadioGroup value={pricingMode} onValueChange={(v) => setPricingMode(v as "template" | "custom")}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="template" id="template" />
              <Label htmlFor="template" className="flex items-center gap-2">
                <Layout className="w-4 h-4" />
                Use Pricing Template
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="custom" id="custom" />
              <Label htmlFor="custom" className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Custom Pricing
              </Label>
            </div>
          </RadioGroup>

          {pricingMode === "template" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Template</Label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a pricing template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} (${t.price_per_play}/play)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTemplateData && (
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <p className="text-sm font-medium">Template Details:</p>
                  <p className="text-sm">
                    Base price: <span className="font-bold">${selectedTemplateData.price_per_play.toFixed(2)}</span> per play
                  </p>
                  {selectedTemplateData.bundles.length > 0 && (
                    <div className="text-sm">
                      <p className="text-muted-foreground">Bundles:</p>
                      {selectedTemplateData.bundles.map((b, i) => (
                        <p key={i} className="ml-2">
                          {b.label}: ${b.price.toFixed(2)}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Price Per Play ($)</Label>
                <Input
                  type="number"
                  step="0.25"
                  min="0.25"
                  value={pricePerPlay}
                  onChange={(e) => setPricePerPlay(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Plays per Bundle</Label>
                  <Input
                    type="number"
                    min="1"
                    value={playsPerBundle}
                    onChange={(e) => setPlaysPerBundle(parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bundle Price ($)</Label>
                  <Input
                    type="number"
                    step="0.25"
                    min="0"
                    value={bundlePrice || ""}
                    onChange={(e) => setBundlePrice(e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="Optional"
                  />
                </div>
              </div>

              {bundlePrice && playsPerBundle > 1 && (
                <p className="text-sm text-muted-foreground">
                  Savings: ${((pricePerPlay * playsPerBundle) - bundlePrice).toFixed(2)} 
                  ({Math.round((1 - bundlePrice / (pricePerPlay * playsPerBundle)) * 100)}% off)
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Pricing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
