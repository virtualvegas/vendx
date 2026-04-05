import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/hooks/useAuditLog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, MapPin, Trash2, Edit, Search, Monitor, RefreshCw, Eye, EyeOff, Gamepad2, UserCheck, Users } from "lucide-react";
import LocationChangeRequestsReview from "./LocationChangeRequestsReview";

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

interface ArcadeGame {
  id: string;
  name: string;
  game_type: string;
}

interface LocationArcadeGame {
  id: string;
  arcade_game_id: string;
  machine_count: number;
  is_active: boolean;
}

interface BusinessOwner {
  id: string;
  full_name: string | null;
  email: string;
}

interface LocationAssignment {
  id: string;
  location_id: string;
  business_owner_id: string;
  is_active: boolean;
}

const LOCATION_TYPES = [
  // Office & Corporate
  { value: "coworking_space", label: "Coworking Space" },
  { value: "call_center", label: "Call Center" },
  { value: "tech_company", label: "Tech Company" },
  { value: "startup", label: "Startup" },
  { value: "government_office", label: "Government Office" },
  { value: "municipal_building", label: "Municipal Building" },
  { value: "industrial_park", label: "Industrial Park" },
  { value: "business_park", label: "Business Park" },
  { value: "staffing_agency", label: "Staffing Agency" },
  { value: "corporate_campus", label: "Corporate Campus" },
  // Industrial & Logistics
  { value: "factory", label: "Factory" },
  { value: "warehouse", label: "Warehouse" },
  { value: "distribution_center", label: "Distribution Center" },
  { value: "manufacturing_plant", label: "Manufacturing Plant" },
  { value: "construction_site", label: "Construction Site" },
  { value: "shipping_hub", label: "Shipping Hub" },
  { value: "auto_body_shop", label: "Auto Body Shop" },
  { value: "machine_shop", label: "Machine Shop" },
  { value: "trade_facility", label: "Trade Facility" },
  // Education
  { value: "elementary_school", label: "Elementary School" },
  { value: "middle_school", label: "Middle School" },
  { value: "high_school", label: "High School" },
  { value: "college", label: "College" },
  { value: "university", label: "University" },
  { value: "trade_school", label: "Trade School" },
  { value: "technical_school", label: "Technical School" },
  { value: "beauty_school", label: "Beauty School" },
  { value: "driving_school", label: "Driving School" },
  { value: "tutoring_center", label: "Tutoring Center" },
  // Healthcare
  { value: "hospital", label: "Hospital" },
  { value: "urgent_care", label: "Urgent Care Center" },
  { value: "clinic", label: "Clinic" },
  { value: "dental_office", label: "Dental Office" },
  { value: "pediatric_office", label: "Pediatric Office" },
  { value: "nursing_home", label: "Nursing Home" },
  { value: "rehab_center", label: "Rehab Center" },
  { value: "mental_health_facility", label: "Mental Health Facility" },
  { value: "veterinary_clinic", label: "Veterinary Clinic" },
  // Residential
  { value: "apartment_complex", label: "Apartment Complex" },
  { value: "condos", label: "Condos" },
  { value: "student_housing", label: "Student Housing" },
  { value: "dorms", label: "Dorms" },
  { value: "senior_living", label: "Senior Living Community" },
  { value: "assisted_living", label: "Assisted Living" },
  { value: "mobile_home_park", label: "Mobile Home Park" },
  { value: "hoa_community", label: "HOA Community" },
  // Hospitality
  { value: "hotel", label: "Hotel" },
  { value: "motel", label: "Motel" },
  { value: "resort", label: "Resort" },
  { value: "airbnb", label: "Airbnb" },
  { value: "hostel", label: "Hostel" },
  { value: "conference_center", label: "Conference Center" },
  // Retail & Shopping
  { value: "shopping_mall", label: "Shopping Mall" },
  { value: "strip_mall", label: "Strip Mall" },
  { value: "retail_plaza", label: "Retail Plaza" },
  { value: "big_box_store", label: "Big Box Store" },
  { value: "grocery_store", label: "Grocery Store" },
  { value: "convenience_store", label: "Convenience Store" },
  { value: "boutique", label: "Boutique" },
  { value: "outlet_mall", label: "Outlet Mall" },
  // Food & Drink
  { value: "restaurant", label: "Restaurant" },
  { value: "fast_food", label: "Fast Food Location" },
  { value: "cafe", label: "Cafe" },
  { value: "coffee_shop", label: "Coffee Shop" },
  { value: "food_court", label: "Food Court" },
  { value: "bar_pub", label: "Bar & Pub" },
  { value: "nightclub", label: "Nightclub" },
  // Entertainment
  { value: "arcade", label: "Arcade" },
  { value: "movie_theater", label: "Movie Theater" },
  { value: "bowling_alley", label: "Bowling Alley" },
  { value: "family_entertainment_center", label: "Family Entertainment Center" },
  { value: "trampoline_park", label: "Trampoline Park" },
  { value: "laser_tag_arena", label: "Laser Tag Arena" },
  { value: "vr_gaming_center", label: "VR Gaming Center" },
  { value: "escape_room", label: "Escape Room" },
  { value: "amusement_park", label: "Amusement Park" },
  { value: "water_park", label: "Water Park" },
  // Fitness & Sports
  { value: "gym", label: "Gym" },
  { value: "fitness_center", label: "Fitness Center" },
  { value: "crossfit_gym", label: "CrossFit Gym" },
  { value: "yoga_studio", label: "Yoga Studio" },
  { value: "martial_arts_studio", label: "Martial Arts Studio" },
  { value: "sports_complex", label: "Sports Complex" },
  { value: "indoor_soccer", label: "Indoor Soccer Facility" },
  { value: "ice_rink", label: "Ice Rink" },
  { value: "swimming_pool", label: "Swimming Pool" },
  // Automotive
  { value: "car_dealership", label: "Car Dealership" },
  { value: "auto_repair_shop", label: "Auto Repair Shop" },
  { value: "tire_shop", label: "Tire Shop" },
  { value: "oil_change_center", label: "Oil Change Center" },
  { value: "car_wash", label: "Car Wash" },
  { value: "gas_station", label: "Gas Station" },
  { value: "ev_charging_station", label: "EV Charging Station" },
  { value: "truck_stop", label: "Truck Stop" },
  // Transit & Transportation
  { value: "airport", label: "Airport" },
  { value: "bus_station", label: "Bus Station" },
  { value: "train_station", label: "Train Station" },
  { value: "subway_station", label: "Subway Station" },
  { value: "ferry_terminal", label: "Ferry Terminal" },
  { value: "rideshare_hub", label: "Rideshare Hub" },
  { value: "parking_garage", label: "Parking Garage" },
  // Personal Services
  { value: "laundromat", label: "Laundromat" },
  { value: "barber_shop", label: "Barber Shop" },
  { value: "hair_salon", label: "Hair Salon" },
  { value: "nail_salon", label: "Nail Salon" },
  { value: "spa", label: "Spa" },
  { value: "tattoo_shop", label: "Tattoo Shop" },
  { value: "phone_repair_shop", label: "Phone Repair Shop" },
  { value: "dry_cleaner", label: "Dry Cleaner" },
  // Government & Public
  { value: "dmv", label: "DMV" },
  { value: "courthouse", label: "Courthouse" },
  { value: "post_office", label: "Post Office" },
  { value: "library", label: "Library" },
  { value: "police_station", label: "Police Station" },
  { value: "fire_station", label: "Fire Station" },
  { value: "military_base", label: "Military Base" },
  { value: "prison", label: "Prison / Correctional Facility" },
  // Outdoor & Recreation
  { value: "park", label: "Park" },
  { value: "campground", label: "Campground" },
  { value: "beach", label: "Beach" },
  { value: "hiking_trail", label: "Hiking Trail" },
  { value: "ski_resort", label: "Ski Resort" },
  { value: "golf_course", label: "Golf Course" },
  { value: "marina", label: "Marina" },
  // Religious & Community
  { value: "church", label: "Church" },
  { value: "mosque", label: "Mosque" },
  { value: "synagogue", label: "Synagogue" },
  { value: "community_center", label: "Community Center" },
  { value: "youth_center", label: "Youth Center" },
  // Events & Temporary
  { value: "festival", label: "Festival" },
  { value: "fair", label: "Fair" },
  { value: "carnival", label: "Carnival" },
  { value: "concert", label: "Concert" },
  { value: "sporting_event", label: "Sporting Event" },
  { value: "trade_show", label: "Trade Show" },
  { value: "farmers_market", label: "Farmers Market" },
  // Other
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
  const [showArcadeGamesDialog, setShowArcadeGamesDialog] = useState(false);
  const [showOwnerDialog, setShowOwnerDialog] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [locationMachines, setLocationMachines] = useState<Machine[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedArcadeGames, setSelectedArcadeGames] = useState<Record<string, { selected: boolean; count: number }>>({});
  const [selectedOwner, setSelectedOwner] = useState<string>("none");

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

  const { data: arcadeGames } = useQuery({
    queryKey: ["arcade-game-titles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("arcade_game_titles").select("id, name, game_type").eq("is_active", true).order("name");
      if (error) throw error;
      return data as ArcadeGame[];
    },
  });

  // Fetch business owners (users with business_owner role)
  const { data: businessOwners } = useQuery({
    queryKey: ["business-owners"],
    queryFn: async () => {
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "business_owner");
      if (error) throw error;
      
      if (!roles || roles.length === 0) return [];
      
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", roles.map(r => r.user_id));
      
      return (profiles || []) as BusinessOwner[];
    },
  });

  // Fetch all location assignments
  const { data: locationAssignments } = useQuery({
    queryKey: ["location-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("location_assignments")
        .select("id, location_id, business_owner_id, is_active")
        .eq("is_active", true);
      if (error) throw error;
      return (data || []) as LocationAssignment[];
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
      const action = editingLocation ? "Updated Location" : "Created Location";
      toast({ title: editingLocation ? "Location updated" : "Location created" });
      logAuditEvent({ action, entity_type: "Location", entity_id: editingLocation?.id, details: { name: formData.name, city: formData.city, country: formData.country, status: formData.status } });
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
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast({ title: "Location deleted" });
      logAuditEvent({ action: "Deleted Location", entity_type: "Location", entity_id: id });
      setShowDeleteConfirm(false);
      setSelectedLocation(null);
    },
  });

  const saveArcadeGamesMutation = useMutation({
    mutationFn: async ({ locationId, games }: { locationId: string; games: Record<string, { selected: boolean; count: number }> }) => {
      // First delete existing arcade games for this location
      const { error: deleteError } = await supabase
        .from("location_arcade_games")
        .delete()
        .eq("location_id", locationId);
      if (deleteError) throw deleteError;

      // Insert new selections
      const gamesToInsert = Object.entries(games)
        .filter(([_, value]) => value.selected)
        .map(([gameId, value]) => ({
          location_id: locationId,
          arcade_game_id: gameId,
          machine_count: value.count || 1,
          is_active: true,
        }));

      if (gamesToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("location_arcade_games")
          .insert(gamesToInsert);
        if (insertError) throw insertError;
      }

      // Update arcade_machine_count
      const totalArcadeMachines = gamesToInsert.reduce((sum, g) => sum + g.machine_count, 0);
      const { error: updateError } = await supabase
        .from("locations")
        .update({ arcade_machine_count: totalArcadeMachines })
        .eq("id", locationId);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast({ title: "Arcade games updated" });
      setShowArcadeGamesDialog(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Assign business owner mutation
  const assignOwnerMutation = useMutation({
    mutationFn: async ({ locationId, ownerId }: { locationId: string; ownerId: string }) => {
      // First, deactivate any existing assignments for this location
      await supabase
        .from("location_assignments")
        .update({ is_active: false })
        .eq("location_id", locationId);
      
      // Then create new assignment
      const { error } = await supabase
        .from("location_assignments")
        .upsert({
          location_id: locationId,
          business_owner_id: ownerId,
          is_active: true,
        }, { onConflict: "location_id,business_owner_id" });
      if (error) throw error;
    },
    onSuccess: (_, { locationId, ownerId }) => {
      queryClient.invalidateQueries({ queryKey: ["location-assignments"] });
      toast({ title: "Business owner assigned" });
      logAuditEvent({ action: "Assigned Business Owner", entity_type: "Location Assignment", details: { location_id: locationId, owner_id: ownerId } });
      setShowOwnerDialog(false);
      setSelectedOwner("none");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Remove business owner assignment mutation
  const removeOwnerMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from("location_assignments")
        .update({ is_active: false })
        .eq("id", assignmentId);
      if (error) throw error;
    },
    onSuccess: (_, assignmentId) => {
      queryClient.invalidateQueries({ queryKey: ["location-assignments"] });
      toast({ title: "Business owner removed" });
      logAuditEvent({ action: "Removed Business Owner", entity_type: "Location Assignment", entity_id: assignmentId });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const fetchLocationMachines = async (locationId: string) => {
    const { data } = await supabase.from("vendx_machines").select("id, name, machine_code, machine_type, status, vendx_pay_enabled").eq("location_id", locationId);
    setLocationMachines(data || []);
  };

  const fetchLocationArcadeGames = async (locationId: string) => {
    const { data } = await supabase
      .from("location_arcade_games")
      .select("id, arcade_game_id, machine_count, is_active")
      .eq("location_id", locationId);
    
    const gameMap: Record<string, { selected: boolean; count: number }> = {};
    (arcadeGames || []).forEach(game => {
      gameMap[game.id] = { selected: false, count: 1 };
    });
    (data || []).forEach((item: LocationArcadeGame) => {
      gameMap[item.arcade_game_id] = { selected: item.is_active, count: item.machine_count || 1 };
    });
    setSelectedArcadeGames(gameMap);
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

  const openArcadeGamesDialog = (location: Location) => {
    setSelectedLocation(location);
    fetchLocationArcadeGames(location.id);
    setShowArcadeGamesDialog(true);
  };

  const openOwnerDialog = (location: Location) => {
    setSelectedLocation(location);
    const existingAssignment = locationAssignments?.find(a => a.location_id === location.id);
    setSelectedOwner(existingAssignment?.business_owner_id || "none");
    setShowOwnerDialog(true);
  };

  const getLocationOwner = (locationId: string) => {
    const assignment = locationAssignments?.find(a => a.location_id === locationId);
    if (!assignment) return null;
    return businessOwners?.find(o => o.id === assignment.business_owner_id);
  };

  const toggleArcadeGame = (gameId: string) => {
    setSelectedArcadeGames(prev => ({
      ...prev,
      [gameId]: { ...prev[gameId], selected: !prev[gameId]?.selected }
    }));
  };

  const updateArcadeGameCount = (gameId: string, count: number) => {
    setSelectedArcadeGames(prev => ({
      ...prev,
      [gameId]: { ...prev[gameId], count: Math.max(1, count) }
    }));
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
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between flex-shrink-0">
        <h2 className="text-2xl font-bold flex items-center gap-2"><MapPin className="w-6 h-6 text-primary" />Global Locations</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["locations"] })}><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
          <Button onClick={() => { resetForm(); setShowDialog(true); }}><Plus className="w-4 h-4 mr-2" />Add Location</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 flex-shrink-0">
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground">Total Locations</p><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground">Active</p><p className="text-2xl font-bold text-green-500">{stats.active}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground">Total Machines</p><p className="text-2xl font-bold text-primary">{stats.totalMachines}</p></CardContent></Card>
      </div>

      <LocationChangeRequestsReview />

      <div className="relative max-w-md flex-shrink-0"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Search locations..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" /></div>

      <Card className="flex-1 min-h-0 flex flex-col">
        <CardHeader className="flex-shrink-0"><CardTitle>Locations ({filteredLocations.length})</CardTitle></CardHeader>
        <CardContent className="flex-1 min-h-0 p-0">
          <div className="h-full overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Business Owner</TableHead>
                  <TableHead>Machines</TableHead>
                  <TableHead>Arcade Games</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Visible</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLocations.map((loc) => (
                  <TableRow key={loc.id}>
                    <TableCell>
                      <p className="font-medium">{loc.name || `${loc.city}, ${loc.country}`}</p>
                      {loc.address && <p className="text-xs text-muted-foreground">{loc.address}</p>}
                    </TableCell>
                    <TableCell><Badge variant="outline">{LOCATION_TYPES.find(t => t.value === loc.location_type)?.label || loc.location_type}</Badge></TableCell>
                    <TableCell><Badge variant={loc.location_category === "mixed" ? "default" : "secondary"}>{LOCATION_CATEGORIES.find(c => c.value === loc.location_category)?.label || loc.location_category || "Vending"}</Badge></TableCell>
                    <TableCell>
                      {(() => {
                        const owner = getLocationOwner(loc.id);
                        return owner ? (
                          <Button variant="ghost" size="sm" onClick={() => openOwnerDialog(loc)} className="gap-1 text-left max-w-[150px]">
                            <UserCheck className="w-4 h-4 text-green-500 shrink-0" />
                            <span className="truncate">{owner.full_name || owner.email}</span>
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => openOwnerDialog(loc)} className="gap-1">
                            <UserCheck className="w-4 h-4 text-primary shrink-0" />
                            <span className="text-foreground font-medium">VendX Global</span>
                          </Button>
                        );
                      })()}
                    </TableCell>
                    <TableCell><Button variant="ghost" size="sm" onClick={() => openMachinesDialog(loc)} className="gap-1"><Monitor className="w-4 h-4" />{loc.machine_count}</Button></TableCell>
                    <TableCell>
                      {(loc.location_category === "arcade" || loc.location_category === "mixed") && (
                        <Button variant="ghost" size="sm" onClick={() => openArcadeGamesDialog(loc)} className="gap-1">
                          <Gamepad2 className="w-4 h-4" />
                          {loc.arcade_machine_count || 0}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell><Badge variant={loc.status === "active" ? "default" : "secondary"}>{loc.status}</Badge></TableCell>
                    <TableCell>{loc.is_visible ? <Eye className="w-4 h-4 text-green-500" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => handleEdit(loc)}><Edit className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => { setSelectedLocation(loc); setShowDeleteConfirm(true); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingLocation ? "Edit Location" : "Add New Location"}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); locationMutation.mutate(formData); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2"><Label>Name</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Main Office" /></div>
              <div className="space-y-2"><Label>Country *</Label><Input value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} required /></div>
              <div className="space-y-2"><Label>City *</Label><Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} required /></div>
              <div className="col-span-2 space-y-2"><Label>Address</Label><Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} /></div>
              <div className="space-y-2"><Label>Type</Label><SearchableSelect options={LOCATION_TYPES.map(t => ({ value: t.value, label: t.label }))} value={formData.location_type} onValueChange={(v) => setFormData({ ...formData, location_type: v })} placeholder="Select type" searchPlaceholder="Search type..." /></div>
              <div className="space-y-2"><Label>Category</Label><SearchableSelect options={LOCATION_CATEGORIES.map(c => ({ value: c.value, label: c.label }))} value={formData.location_category} onValueChange={(v) => setFormData({ ...formData, location_category: v })} placeholder="Select category" searchPlaceholder="Search category..." /></div>
              <div className="space-y-2"><Label>Status</Label><SearchableSelect options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }, { value: "coming_soon", label: "Coming Soon" }, { value: "seasonal", label: "Seasonal" }]} value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })} placeholder="Select status" searchPlaceholder="Search status..." /></div>
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

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"><Label>Public Visibility</Label><Switch checked={formData.is_visible} onCheckedChange={(v) => setFormData({ ...formData, is_visible: v })} /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button><Button type="submit">{editingLocation ? "Update" : "Add"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showMachinesDialog} onOpenChange={setShowMachinesDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Machines at {selectedLocation?.name || selectedLocation?.city}</DialogTitle></DialogHeader>
          {locationMachines.length === 0 ? <p className="text-center text-muted-foreground py-8">No machines</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Machine</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>{locationMachines.map(m => <TableRow key={m.id}><TableCell className="font-medium">{m.name}</TableCell><TableCell>{m.machine_type}</TableCell><TableCell><Badge variant={m.status === "active" ? "default" : "secondary"}>{m.status}</Badge></TableCell></TableRow>)}</TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showArcadeGamesDialog} onOpenChange={setShowArcadeGamesDialog}>
        <DialogContent className="max-w-lg max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Arcade Games at {selectedLocation?.name || selectedLocation?.city}</DialogTitle>
            <DialogDescription>Select which arcade games are available at this location</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {(arcadeGames || []).map(game => (
                <div key={game.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <Checkbox 
                    id={game.id}
                    checked={selectedArcadeGames[game.id]?.selected || false}
                    onCheckedChange={() => toggleArcadeGame(game.id)}
                  />
                  <div className="flex-1">
                    <label htmlFor={game.id} className="font-medium cursor-pointer">{game.name}</label>
                    <p className="text-xs text-muted-foreground capitalize">{game.game_type}</p>
                  </div>
                  {selectedArcadeGames[game.id]?.selected && (
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Qty:</Label>
                      <Input 
                        type="number" 
                        min="1" 
                        value={selectedArcadeGames[game.id]?.count || 1}
                        onChange={(e) => updateArcadeGameCount(game.id, parseInt(e.target.value) || 1)}
                        className="w-16 h-8"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowArcadeGamesDialog(false)}>Cancel</Button>
            <Button 
              onClick={() => selectedLocation && saveArcadeGamesMutation.mutate({ locationId: selectedLocation.id, games: selectedArcadeGames })}
              disabled={saveArcadeGamesMutation.isPending}
            >
              {saveArcadeGamesMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Location</DialogTitle><DialogDescription>Are you sure?</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button><Button variant="destructive" onClick={() => selectedLocation && deleteMutation.mutate(selectedLocation.id)}>Delete</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Business Owner Assignment Dialog */}
      <Dialog open={showOwnerDialog} onOpenChange={setShowOwnerDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Business Owner</DialogTitle>
            <DialogDescription>
              Select a business owner for {selectedLocation?.name || selectedLocation?.city}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Business Owner</Label>
              <SearchableSelect
                options={[
                  { value: "none", label: "VendX Global (Default)" },
                  ...(businessOwners || []).map(owner => ({
                    value: owner.id,
                    label: owner.full_name || owner.email,
                    description: owner.full_name ? owner.email : undefined,
                  })),
                ]}
                value={selectedOwner}
                onValueChange={setSelectedOwner}
                placeholder="Select a business owner"
                searchPlaceholder="Search owners..."
              />
              {businessOwners?.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No users with the Business Owner role found. Assign the role first in Admin Settings.
                </p>
              )}
            </div>

            {/* Show current assignment if exists */}
            {selectedLocation && (() => {
              const assignment = locationAssignments?.find(a => a.location_id === selectedLocation.id);
              const currentOwner = assignment ? businessOwners?.find(o => o.id === assignment.business_owner_id) : null;
              return (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Currently assigned:</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{currentOwner ? (currentOwner.full_name || "Unnamed") : "VendX Global"}</p>
                      <p className="text-xs text-muted-foreground">{currentOwner ? currentOwner.email : "Default ownership"}</p>
                    </div>
                    {currentOwner && assignment && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => removeOwnerMutation.mutate(assignment.id)}
                        disabled={removeOwnerMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Reset to VendX
                      </Button>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOwnerDialog(false)}>Cancel</Button>
            <Button 
              onClick={() => {
                if (selectedLocation && selectedOwner && selectedOwner !== "none") {
                  assignOwnerMutation.mutate({ locationId: selectedLocation.id, ownerId: selectedOwner });
                } else if (selectedLocation && selectedOwner === "none") {
                  // Remove current assignment
                  const assignment = locationAssignments?.find(a => a.location_id === selectedLocation.id);
                  if (assignment) {
                    removeOwnerMutation.mutate(assignment.id);
                  }
                  setShowOwnerDialog(false);
                }
              }}
              disabled={assignOwnerMutation.isPending || removeOwnerMutation.isPending}
            >
              {assignOwnerMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GlobalLocations;
