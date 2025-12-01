import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, MapPin, Building2, Trash2, Edit, Eye, EyeOff } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const GlobalLocations = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<any>(null);
  const [formData, setFormData] = useState({
    country: "",
    city: "",
    address: "",
    latitude: "",
    longitude: "",
    status: "active",
    machine_count: 0,
    is_visible: true,
  });

  // Fetch locations
  const { data: locations, isLoading } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .order("country", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Create/Update mutation
  const locationMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        latitude: data.latitude ? parseFloat(data.latitude) : null,
        longitude: data.longitude ? parseFloat(data.longitude) : null,
        machine_count: parseInt(data.machine_count) || 0,
      };

      if (editingLocation) {
        const { error } = await supabase
          .from("locations")
          .update(payload)
          .eq("id", editingLocation.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("locations").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast({ title: editingLocation ? "Location updated" : "Location created" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("locations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast({ title: "Location deleted" });
    },
  });

  const resetForm = () => {
    setFormData({
      country: "",
      city: "",
      address: "",
      latitude: "",
      longitude: "",
      status: "active",
      machine_count: 0,
      is_visible: true,
    });
    setEditingLocation(null);
  };

  const handleEdit = (location: any) => {
    setEditingLocation(location);
    setFormData({
      ...location,
      latitude: location.latitude?.toString() || "",
      longitude: location.longitude?.toString() || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    locationMutation.mutate(formData);
  };

  const totalMachines = locations?.reduce((sum, loc) => sum + loc.machine_count, 0) || 0;
  const activeLocations = locations?.filter((loc) => loc.status === "active").length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Global Locations</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <MapPin className="w-10 h-10 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Total Locations</p>
              <p className="text-3xl font-bold">{locations?.length || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <Building2 className="w-10 h-10 text-accent" />
            <div>
              <p className="text-sm text-muted-foreground">Active Locations</p>
              <p className="text-3xl font-bold">{activeLocations}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <Building2 className="w-10 h-10 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total Machines</p>
              <p className="text-3xl font-bold">{totalMachines}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex justify-end">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" /> Add Location
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingLocation ? "Edit Location" : "Add New Location"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  required
                  placeholder="Country"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                />
                <Input
                  required
                  placeholder="City"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
              <Input
                placeholder="Address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  type="number"
                  step="any"
                  placeholder="Latitude"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                />
                <Input
                  type="number"
                  step="any"
                  placeholder="Longitude"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                />
              </div>
              <Input
                type="number"
                placeholder="Machine Count"
                value={formData.machine_count}
                onChange={(e) => setFormData({ ...formData, machine_count: parseInt(e.target.value) || 0 })}
              />
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_visible}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_visible: checked })}
                />
                <label className="text-sm">Visible on public site</label>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={locationMutation.isPending}>
                  {editingLocation ? "Update" : "Create"} Location
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <p>Loading locations...</p>
        ) : (
          locations?.map((location) => (
            <Card key={location.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold">
                      {location.city}, {location.country}
                    </h3>
                    {location.is_visible ? (
                      <Eye className="h-4 w-4 text-accent" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  {location.address && (
                    <p className="text-sm text-muted-foreground">{location.address}</p>
                  )}
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span>
                      <span className="text-muted-foreground">Machines:</span>{" "}
                      <span className="font-semibold">{location.machine_count}</span>
                    </span>
                    <span>
                      <span className="text-muted-foreground">Status:</span>{" "}
                      <span
                        className={`font-semibold ${
                          location.status === "active" ? "text-accent" : "text-muted-foreground"
                        }`}
                      >
                        {location.status}
                      </span>
                    </span>
                    {location.latitude && location.longitude && (
                      <span className="text-muted-foreground">
                        {location.latitude}, {location.longitude}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(location)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (confirm("Delete this location?")) {
                        deleteMutation.mutate(location.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default GlobalLocations;
