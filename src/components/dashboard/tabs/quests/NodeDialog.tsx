import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface NodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  node?: any;
  locations: any[];
}

const nodeTypes = [
  { value: "vending", label: "Vending Machine" },
  { value: "arcade", label: "Arcade" },
  { value: "claw", label: "Claw Machine" },
  { value: "partner", label: "Partner Location" },
  { value: "event", label: "Event" },
  { value: "virtual", label: "Virtual" },
];

const rarities = ["common", "rare", "epic", "legendary"];

const NodeDialog = ({ open, onOpenChange, node, locations }: NodeDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!node;

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    node_type: "vending",
    rarity: "common",
    location_id: "",
    latitude: "",
    longitude: "",
    radius_meters: "50",
    color: "#00d4ff",
    cooldown_hours: "24",
    is_active: true,
    is_virtual: false,
  });

  useEffect(() => {
    if (node) {
      setFormData({
        name: node.name || "",
        description: node.description || "",
        node_type: node.node_type || "vending",
        rarity: node.rarity || "common",
        location_id: node.location_id || "",
        latitude: node.latitude?.toString() || "",
        longitude: node.longitude?.toString() || "",
        radius_meters: node.radius_meters?.toString() || "50",
        color: node.color || "#00d4ff",
        cooldown_hours: node.cooldown_hours?.toString() || "24",
        is_active: node.is_active ?? true,
        is_virtual: node.is_virtual ?? false,
      });
    } else {
      setFormData({
        name: "",
        description: "",
        node_type: "vending",
        rarity: "common",
        location_id: "",
        latitude: "",
        longitude: "",
        radius_meters: "50",
        color: "#00d4ff",
        cooldown_hours: "24",
        is_active: true,
        is_virtual: false,
      });
    }
  }, [node, open]);

  // Auto-fill coordinates when location is selected
  useEffect(() => {
    if (formData.location_id && locations.length > 0) {
      const selectedLocation = locations.find(l => l.id === formData.location_id);
      if (selectedLocation && selectedLocation.latitude && selectedLocation.longitude) {
        setFormData(prev => ({
          ...prev,
          latitude: selectedLocation.latitude.toString(),
          longitude: selectedLocation.longitude.toString(),
        }));
      }
    }
  }, [formData.location_id, locations]);

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        name: data.name,
        description: data.description || null,
        node_type: data.node_type,
        rarity: data.rarity as "common" | "rare" | "epic" | "legendary",
        location_id: data.location_id || null,
        latitude: data.latitude ? parseFloat(data.latitude) : null,
        longitude: data.longitude ? parseFloat(data.longitude) : null,
        radius_meters: parseInt(data.radius_meters) || 50,
        color: data.color,
        cooldown_hours: parseInt(data.cooldown_hours) || 24,
        is_active: data.is_active,
        is_virtual: data.is_virtual,
      };

      if (isEditing) {
        const { error } = await supabase
          .from("quest_nodes")
          .update(payload)
          .eq("id", node.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("quest_nodes").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-quest-nodes"] });
      toast({ title: isEditing ? "Node updated" : "Node created" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    mutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Quest Node" : "Create Quest Node"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Downtown Arcade"
              />
            </div>

            <div className="col-span-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="A legendary arcade spot..."
                rows={2}
              />
            </div>

            <div>
              <Label>Node Type</Label>
              <Select value={formData.node_type} onValueChange={(v) => setFormData({ ...formData, node_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {nodeTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Rarity</Label>
              <Select value={formData.rarity} onValueChange={(v) => setFormData({ ...formData, rarity: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {rarities.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label>Link to Location</Label>
              <Select 
                value={formData.location_id || "none"} 
                onValueChange={(v) => setFormData({ ...formData, location_id: v === "none" ? "" : v })}
              >
                <SelectTrigger><SelectValue placeholder="Select location..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {locations.map((loc: any) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name || loc.city} - {loc.city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Latitude</Label>
              <Input
                type="number"
                step="any"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                placeholder="42.3601"
              />
            </div>

            <div>
              <Label>Longitude</Label>
              <Input
                type="number"
                step="any"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                placeholder="-71.0589"
              />
            </div>

            <div>
              <Label>Radius (meters)</Label>
              <Input
                type="number"
                value={formData.radius_meters}
                onChange={(e) => setFormData({ ...formData, radius_meters: e.target.value })}
              />
            </div>

            <div>
              <Label>Cooldown (hours)</Label>
              <Input
                type="number"
                value={formData.cooldown_hours}
                onChange={(e) => setFormData({ ...formData, cooldown_hours: e.target.value })}
              />
            </div>

            <div>
              <Label>Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-12 h-10 p-1"
                />
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Virtual</Label>
                <Switch
                  checked={formData.is_virtual}
                  onCheckedChange={(v) => setFormData({ ...formData, is_virtual: v })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default NodeDialog;
