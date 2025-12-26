import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Plus, MapPin, Trash2, Edit, Search, Monitor, RefreshCw, Eye, EyeOff } from "lucide-react";

interface Location {
  id: string;
  name: string | null;
  country: string;
  city: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  machine_count: number;
  status: string;
  is_visible: boolean;
  location_type: string | null;
  location_category: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  snack_machine_count: number | null;
  drink_machine_count: number | null;
  combo_machine_count: number | null;
  specialty_machine_count: number | null;
  arcade_machine_count: number | null;
}

interface Machine {
  id: string;
  name: string;
  machine_code: string;
  machine_type: string;
  status: string;
  vendx_pay_enabled: boolean;
}

const LOCATION_TYPES = [
  { value: "office", label: "Office Building" },
  { value: "mall", label: "Shopping Mall" },
  { value: "hospital", label: "Hospital" },
  { value: "school", label: "School/University" },
  { value: "factory", label: "Factory" },
  { value: "hotel", label: "Hotel" },
  { value: "airport", label: "Airport" },
  { value: "transit", label: "Transit Station" },
  { value: "gym", label: "Gym/Fitness" },
  { value: "other", label: "Other" },
];

const LOCATION_CATEGORIES = [
  { value: "vending", label: "Vending Only" },
  { value: "arcade", label: "Arcade Only" },
  { value: "mixed", label: "Mixed (Vending + Arcade)" },
];

const GlobalLocations = () => {
  const [showDialog, setShowDialog] = useState(false);
  const [showMachinesDialog, setShowMachinesDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [locationMachines, setLocationMachines] = useState<Machine[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    country: "",
    city: "",
    address: "",
    latitude: "",
    longitude: "",
    status: "active",
    is_visible: true,
    location_type: "office",
    location_category: "vending",
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    snack_machine_count: 0,
    drink_machine_count: 0,
    combo_machine_count: 0,
    specialty_machine_count: 0,
    arcade_machine_count: 0,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: locations, isLoading } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("locations").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Location[];
    },
  });

  const locationMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const totalMachines = (data.snack_machine_count || 0) + (data.drink_machine_count || 0) + 
        (data.combo_machine_count || 0) + (data.specialty_machine_count || 0) + (data.arcade_machine_count || 0);

      const payload = {
        name: data.name || null,
        country: data.country,
        city: data.city,
        address: data.address || null,
        latitude: data.latitude ? parseFloat(data.latitude) : null,
        longitude: data.longitude ? parseFloat(data.longitude) : null,
        status: data.status,
        is_visible: data.is_visible,
        location_type: data.location_type,
        location_category: data.location_category,
        contact_name: data.contact_name || null,
        contact_phone: data.contact_phone || null,
        contact_email: data.contact_email || null,
        snack_machine_count: data.snack_machine_count || 0,
        drink_machine_count: data.drink_machine_count || 0,
        combo_machine_count: data.combo_machine_count || 0,
        specialty_machine_count: data.specialty_machine_count || 0,
        arcade_machine_count: data.arcade_machine_count || 0,
        machine_count: totalMachines,
      };

      if (editingLocation) {
        const { error } = await supabase.from("locations").update(payload).eq("id", editingLocation.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("locations").insert([{ ...payload, machine_count: 0 }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast({ title: editingLocation ? "Location updated" : "Location created" });
      setShowDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("locations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast({ title: "Location deleted" });
      setShowDeleteConfirm(false);
      setSelectedLocation(null);
    },
  });

  const fetchLocationMachines = async (locationId: string) => {
    const { data } = await supabase.from("vendx_machines").select("id, name, machine_code, machine_type, status, vendx_pay_enabled").eq("location_id", locationId);
    setLocationMachines(data || []);
  };

  const resetForm = () => {
    setFormData({ 
      name: "", country: "", city: "", address: "", latitude: "", longitude: "", 
      status: "active", is_visible: true, location_type: "office", location_category: "vending",
      contact_name: "", contact_phone: "", contact_email: "",
      snack_machine_count: 0, drink_machine_count: 0, combo_machine_count: 0, 
      specialty_machine_count: 0, arcade_machine_count: 0 
    });
    setEditingLocation(null);
  };

  const handleEdit = (location: Location) => {
    setEditingLocation(location);
    setFormData({
      name: location.name || "",
      country: location.country,
      city: location.city,
      address: location.address || "",
      latitude: location.latitude?.toString() || "",
      longitude: location.longitude?.toString() || "",
      status: location.status,
      is_visible: location.is_visible,
      location_type: location.location_type || "office",
      location_category: location.location_category || "vending",
      contact_name: location.contact_name || "",
      contact_phone: location.contact_phone || "",
      contact_email: location.contact_email || "",
      snack_machine_count: location.snack_machine_count || 0,
      drink_machine_count: location.drink_machine_count || 0,
      combo_machine_count: location.combo_machine_count || 0,
      specialty_machine_count: location.specialty_machine_count || 0,
      arcade_machine_count: location.arcade_machine_count || 0,
    });
    setShowDialog(true);
  };

  const openMachinesDialog = (location: Location) => {
    setSelectedLocation(location);
    fetchLocationMachines(location.id);
    setShowMachinesDialog(true);
  };

  const filteredLocations = useMemo(() => {
    return (locations || []).filter(loc => 
      (loc.name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      loc.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loc.country.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [locations, searchTerm]);

  const stats = useMemo(() => ({
    total: locations?.length || 0,
    active: locations?.filter(l => l.status === "active").length || 0,
    totalMachines: locations?.reduce((sum, l) => sum + l.machine_count, 0) || 0,
  }), [locations]);

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2"><MapPin className="w-6 h-6 text-primary" />Global Locations</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["locations"] })}><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
          <Button onClick={() => { resetForm(); setShowDialog(true); }}><Plus className="w-4 h-4 mr-2" />Add Location</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground">Total Locations</p><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground">Active</p><p className="text-2xl font-bold text-green-500">{stats.active}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground">Total Machines</p><p className="text-2xl font-bold text-primary">{stats.totalMachines}</p></CardContent></Card>
      </div>

      <div className="relative max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Search locations..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" /></div>

      <Card>
        <CardHeader><CardTitle>Locations ({filteredLocations.length})</CardTitle></CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader><TableRow><TableHead>Location</TableHead><TableHead>Type</TableHead><TableHead>Category</TableHead><TableHead>Machines</TableHead><TableHead>Status</TableHead><TableHead>Visible</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredLocations.map((loc) => (
                  <TableRow key={loc.id}>
                    <TableCell><p className="font-medium">{loc.name || `${loc.city}, ${loc.country}`}</p>{loc.address && <p className="text-xs text-muted-foreground">{loc.address}</p>}</TableCell>
                    <TableCell><Badge variant="outline">{LOCATION_TYPES.find(t => t.value === loc.location_type)?.label || loc.location_type}</Badge></TableCell>
                    <TableCell><Badge variant={loc.location_category === "mixed" ? "default" : "secondary"}>{LOCATION_CATEGORIES.find(c => c.value === loc.location_category)?.label || loc.location_category || "Vending"}</Badge></TableCell>
                    <TableCell><Button variant="ghost" size="sm" onClick={() => openMachinesDialog(loc)} className="gap-1"><Monitor className="w-4 h-4" />{loc.machine_count}</Button></TableCell>
                    <TableCell><Badge variant={loc.status === "active" ? "default" : "secondary"}>{loc.status}</Badge></TableCell>
                    <TableCell>{loc.is_visible ? <Eye className="w-4 h-4 text-green-500" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}</TableCell>
                    <TableCell><div className="flex gap-1"><Button size="icon" variant="ghost" onClick={() => handleEdit(loc)}><Edit className="w-4 h-4" /></Button><Button size="icon" variant="ghost" onClick={() => { setSelectedLocation(loc); setShowDeleteConfirm(true); }}><Trash2 className="w-4 h-4 text-destructive" /></Button></div></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editingLocation ? "Edit Location" : "Add New Location"}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); locationMutation.mutate(formData); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2"><Label>Name</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Main Office" /></div>
              <div className="space-y-2"><Label>Country *</Label><Input value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} required /></div>
              <div className="space-y-2"><Label>City *</Label><Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} required /></div>
              <div className="col-span-2 space-y-2"><Label>Address</Label><Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} /></div>
              <div className="space-y-2"><Label>Type</Label><Select value={formData.location_type} onValueChange={(v) => setFormData({ ...formData, location_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{LOCATION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Category</Label><Select value={formData.location_category} onValueChange={(v) => setFormData({ ...formData, location_category: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{LOCATION_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Status</Label><Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="coming_soon">Coming Soon</SelectItem><SelectItem value="seasonal">Seasonal</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Latitude</Label><Input value={formData.latitude} onChange={(e) => setFormData({ ...formData, latitude: e.target.value })} placeholder="e.g. 40.7128" /></div>
              <div className="space-y-2"><Label>Longitude</Label><Input value={formData.longitude} onChange={(e) => setFormData({ ...formData, longitude: e.target.value })} placeholder="e.g. -74.0060" /></div>
            </div>
            
            {(formData.location_category === "vending" || formData.location_category === "mixed") && (
              <div className="border rounded-lg p-4 space-y-3">
                <h3 className="font-semibold">Vending Machines</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2"><Label>Snack</Label><Input type="number" min="0" value={formData.snack_machine_count} onChange={(e) => setFormData({ ...formData, snack_machine_count: parseInt(e.target.value) || 0 })} /></div>
                  <div className="space-y-2"><Label>Drink</Label><Input type="number" min="0" value={formData.drink_machine_count} onChange={(e) => setFormData({ ...formData, drink_machine_count: parseInt(e.target.value) || 0 })} /></div>
                  <div className="space-y-2"><Label>Combo</Label><Input type="number" min="0" value={formData.combo_machine_count} onChange={(e) => setFormData({ ...formData, combo_machine_count: parseInt(e.target.value) || 0 })} /></div>
                  <div className="space-y-2"><Label>Specialty</Label><Input type="number" min="0" value={formData.specialty_machine_count} onChange={(e) => setFormData({ ...formData, specialty_machine_count: parseInt(e.target.value) || 0 })} /></div>
                </div>
              </div>
            )}

            {(formData.location_category === "arcade" || formData.location_category === "mixed") && (
              <div className="border rounded-lg p-4 space-y-3">
                <h3 className="font-semibold">Arcade Machines</h3>
                <div className="space-y-2"><Label>Total Arcade Machines</Label><Input type="number" min="0" value={formData.arcade_machine_count} onChange={(e) => setFormData({ ...formData, arcade_machine_count: parseInt(e.target.value) || 0 })} /></div>
              </div>
            )}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"><Label>Public Visibility</Label><Switch checked={formData.is_visible} onCheckedChange={(v) => setFormData({ ...formData, is_visible: v })} /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button><Button type="submit">{editingLocation ? "Update" : "Add"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showMachinesDialog} onOpenChange={setShowMachinesDialog}>
        <DialogContent><DialogHeader><DialogTitle>Machines at {selectedLocation?.name || selectedLocation?.city}</DialogTitle></DialogHeader>
          {locationMachines.length === 0 ? <p className="text-center text-muted-foreground py-8">No machines</p> : (
            <Table><TableHeader><TableRow><TableHead>Machine</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>{locationMachines.map(m => <TableRow key={m.id}><TableCell className="font-medium">{m.name}</TableCell><TableCell>{m.machine_type}</TableCell><TableCell><Badge variant={m.status === "active" ? "default" : "secondary"}>{m.status}</Badge></TableCell></TableRow>)}</TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent><DialogHeader><DialogTitle>Delete Location</DialogTitle><DialogDescription>Are you sure?</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button><Button variant="destructive" onClick={() => selectedLocation && deleteMutation.mutate(selectedLocation.id)}>Delete</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GlobalLocations;