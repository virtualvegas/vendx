import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import StarField from "@/components/StarField";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  MapPin, 
  Search, 
  Filter,
  Coffee,
  Gamepad2,
  Combine,
  ChevronRight,
  Globe,
  Navigation as NavIcon,
  Building2,
  ShoppingBag,
  GraduationCap,
  Hotel,
  Dumbbell,
  Plane,
  Hospital,
  Factory,
  Store,
  Warehouse,
  CalendarDays,
  PartyPopper,
  UtensilsCrossed
} from "lucide-react";
import { format, isAfter, isBefore, isToday, parseISO } from "date-fns";

interface Location {
  id: string;
  name: string | null;
  country: string;
  city: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  location_category: string | null;
  location_type: string | null;
  machine_count: number;
  snack_machine_count: number | null;
  drink_machine_count: number | null;
  combo_machine_count: number | null;
  specialty_machine_count: number | null;
  arcade_machine_count: number | null;
}

interface StandEvent {
  id: string;
  stand_id: string;
  event_name: string;
  event_location: string;
  event_date: string;
  event_end_date: string | null;
  notes: string | null;
  status: string;
  stands?: {
    id: string;
    name: string;
    description: string | null;
    image_url: string | null;
  };
}

const categoryIcons: Record<string, React.ReactNode> = {
  vending: <Coffee className="w-5 h-5" />,
  arcade: <Gamepad2 className="w-5 h-5" />,
  mixed: <Combine className="w-5 h-5" />,
};

const categoryLabels: Record<string, string> = {
  vending: "Vending Only",
  arcade: "Arcade Only",
  mixed: "Vending + Arcade",
};

const categoryColors: Record<string, string> = {
  vending: "bg-primary/20 text-primary border-primary/30",
  arcade: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  mixed: "bg-accent/20 text-accent border-accent/30",
};

const statusColors: Record<string, string> = {
  active: "bg-accent text-accent-foreground",
  coming_soon: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  seasonal: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  inactive: "bg-muted text-muted-foreground",
};

const statusLabels: Record<string, string> = {
  active: "Live",
  coming_soon: "Coming Soon",
  seasonal: "Seasonal",
  inactive: "Closed",
};

const locationTypeIcons: Record<string, React.ReactNode> = {
  office: <Building2 className="w-4 h-4" />,
  retail: <ShoppingBag className="w-4 h-4" />,
  school: <GraduationCap className="w-4 h-4" />,
  university: <GraduationCap className="w-4 h-4" />,
  hotel: <Hotel className="w-4 h-4" />,
  gym: <Dumbbell className="w-4 h-4" />,
  airport: <Plane className="w-4 h-4" />,
  hospital: <Hospital className="w-4 h-4" />,
  factory: <Factory className="w-4 h-4" />,
  mall: <Store className="w-4 h-4" />,
  warehouse: <Warehouse className="w-4 h-4" />,
};

const locationTypeLabels: Record<string, string> = {
  office: "Office Building",
  retail: "Retail Store",
  school: "School",
  university: "University",
  hotel: "Hotel",
  gym: "Gym / Fitness",
  airport: "Airport",
  hospital: "Hospital",
  factory: "Factory",
  mall: "Shopping Mall",
  warehouse: "Warehouse",
};

const getDirectionsUrl = (location: Location) => {
  // Build destination string
  let destination = "";
  
  if (location.latitude && location.longitude) {
    destination = `${location.latitude},${location.longitude}`;
  } else if (location.address) {
    destination = encodeURIComponent(`${location.address}, ${location.city}, ${location.country}`);
  } else {
    destination = encodeURIComponent(`${location.city}, ${location.country}`);
  }

  // Check if on mobile (iOS or Android)
  const userAgent = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(userAgent);
  const isAndroid = /android/.test(userAgent);

  if (isIOS) {
    // Apple Maps
    return `maps://maps.apple.com/?daddr=${destination}`;
  } else if (isAndroid) {
    // Google Maps app intent
    return `geo:0,0?q=${destination}`;
  } else {
    // Desktop: Google Maps web
    return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
  }
};

const LocationsPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("locations");

  const { data: locations, isLoading } = useQuery({
    queryKey: ["public-locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .eq("is_visible", true)
        .order("country", { ascending: true });

      if (error) throw error;
      return data as Location[];
    },
  });

  const { data: standEvents = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["public-stand-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stand_events")
        .select("*, stands(id, name, description, image_url)")
        .in("status", ["upcoming", "ongoing"])
        .order("event_date", { ascending: true });

      if (error) throw error;
      return data as StandEvent[];
    },
  });

  const filteredLocations = useMemo(() => {
    if (!locations) return [];
    
    return locations.filter((loc) => {
      const matchesSearch =
        !searchQuery ||
        loc.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        loc.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        loc.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
        loc.address?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        !selectedCategory || loc.location_category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [locations, searchQuery, selectedCategory]);

  const filteredEvents = useMemo(() => {
    if (!standEvents) return [];
    
    return standEvents.filter((event) => {
      const matchesSearch =
        !searchQuery ||
        event.event_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.event_location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.stands?.name.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesSearch;
    });
  }, [standEvents, searchQuery]);

  // Group locations by country
  const groupedLocations = useMemo(() => {
    const groups: Record<string, Location[]> = {};
    filteredLocations.forEach((loc) => {
      if (!groups[loc.country]) {
        groups[loc.country] = [];
      }
      groups[loc.country].push(loc);
    });
    return groups;
  }, [filteredLocations]);

  const stats = useMemo(() => {
    if (!locations) return { total: 0, active: 0, countries: 0, events: 0 };
    const countries = new Set(locations.map((l) => l.country));
    return {
      total: locations.length,
      active: locations.filter((l) => l.status === "active").length,
      countries: countries.size,
      events: standEvents.length,
    };
  }, [locations, standEvents]);

  const getEventStatus = (event: StandEvent) => {
    const today = new Date();
    const startDate = parseISO(event.event_date);
    const endDate = event.event_end_date ? parseISO(event.event_end_date) : startDate;

    if (isToday(startDate) || (isAfter(today, startDate) && isBefore(today, endDate)) || isToday(endDate)) {
      return "ongoing";
    }
    if (isAfter(startDate, today)) {
      return "upcoming";
    }
    return "completed";
  };

  const getEventDirectionsUrl = (location: string) => {
    const destination = encodeURIComponent(location);
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);

    if (isIOS) {
      return `maps://maps.apple.com/?daddr=${destination}`;
    } else if (isAndroid) {
      return `geo:0,0?q=${destination}`;
    } else {
      return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
    }
  };

  return (
    <div className="relative min-h-screen bg-background">
      <StarField />
      <Navigation />

      <div className="relative z-10 pt-32 pb-20">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 mb-6">
              <MapPin className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-medium">Find Us</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Our Locations
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Discover VendX Global vending machines and arcade experiences near you
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 max-w-lg mx-auto mb-12">
            <div className="text-center p-4 rounded-xl bg-card/50 border border-border/50">
              <div className="text-2xl font-bold text-primary">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Locations</div>
            </div>
            <div className="text-center p-4 rounded-xl bg-card/50 border border-border/50">
              <div className="text-2xl font-bold text-accent">{stats.active}</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
            <div className="text-center p-4 rounded-xl bg-card/50 border border-border/50">
              <div className="text-2xl font-bold text-foreground">{stats.countries}</div>
              <div className="text-xs text-muted-foreground">Countries</div>
            </div>
            <div className="text-center p-4 rounded-xl bg-card/50 border border-border/50">
              <div className="text-2xl font-bold text-purple-400">{stats.events}</div>
              <div className="text-xs text-muted-foreground">Events</div>
            </div>
          </div>

          {/* Tabs for Locations and Events */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-6">
              <TabsTrigger value="locations" className="gap-2">
                <MapPin className="w-4 h-4" />
                Locations
              </TabsTrigger>
              <TabsTrigger value="events" className="gap-2">
                <PartyPopper className="w-4 h-4" />
                Events
              </TabsTrigger>
            </TabsList>


            <TabsContent value="locations">
              {/* Filters */}
              <div className="flex flex-col md:flex-row gap-4 mb-8">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by city, country, or address..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-card/50 border-border/50"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant={selectedCategory === null ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(null)}
                    className="gap-2"
                  >
                    <Filter className="w-4 h-4" />
                    All
                  </Button>
                  {Object.entries(categoryLabels).map(([key, label]) => (
                    <Button
                      key={key}
                      variant={selectedCategory === key ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCategory(key)}
                      className="gap-2"
                    >
                      {categoryIcons[key]}
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Locations List */}
              {isLoading ? (
                <div className="space-y-6">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="bg-card/50 border-border/50">
                      <CardContent className="p-6">
                        <Skeleton className="h-6 w-1/4 mb-4" />
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {[1, 2, 3].map((j) => (
                            <Skeleton key={j} className="h-32" />
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : Object.keys(groupedLocations).length > 0 ? (
                <div className="space-y-8">
                  {Object.entries(groupedLocations).map(([country, locs]) => (
                    <div key={country}>
                      <div className="flex items-center gap-3 mb-4">
                        <Globe className="w-5 h-5 text-primary" />
                        <h2 className="text-xl font-semibold text-foreground">{country}</h2>
                        <Badge variant="outline" className="text-muted-foreground">
                          {locs.length} location{locs.length !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                      
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {locs.map((location) => (
                          <Card
                            key={location.id}
                            className="group bg-card/50 border-border/50 hover:border-primary/50 transition-all"
                          >
                            <CardHeader className="pb-3">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                  {categoryIcons[location.location_category || "vending"]}
                                  <CardTitle className="text-lg group-hover:text-primary transition-colors">
                                    {location.name || location.city}
                                  </CardTitle>
                                </div>
                                <Badge className={statusColors[location.status] || statusColors.active}>
                                  {statusLabels[location.status] || location.status}
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="space-y-2 mb-4">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <MapPin className="w-4 h-4" />
                                  <span>{location.city}, {location.country}</span>
                                </div>
                                {location.address && (
                                  <p className="text-sm text-muted-foreground pl-6 line-clamp-1">
                                    {location.address}
                                  </p>
                                )}
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <Badge className={categoryColors[location.location_category || "vending"]}>
                                  {categoryLabels[location.location_category || "vending"]}
                                </Badge>
                                {location.location_type && (
                                  <Badge variant="outline" className="gap-1">
                                    {locationTypeIcons[location.location_type] || <Building2 className="w-4 h-4" />}
                                    {locationTypeLabels[location.location_type] || location.location_type}
                                  </Badge>
                                )}
                              </div>

                              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
                                <div className="flex gap-4 text-sm text-muted-foreground">
                                  {(location.snack_machine_count || 0) + 
                                   (location.drink_machine_count || 0) + 
                                   (location.combo_machine_count || 0) + 
                                   (location.specialty_machine_count || 0) > 0 && (
                                    <span className="flex items-center gap-1">
                                      <Coffee className="w-4 h-4" />
                                      {(location.snack_machine_count || 0) + 
                                       (location.drink_machine_count || 0) + 
                                       (location.combo_machine_count || 0) + 
                                       (location.specialty_machine_count || 0)}
                                    </span>
                                  )}
                                  {(location.arcade_machine_count || 0) > 0 && (
                                    <span className="flex items-center gap-1">
                                      <Gamepad2 className="w-4 h-4" />
                                      {location.arcade_machine_count}
                                    </span>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  <a href={getDirectionsUrl(location)} target="_blank" rel="noopener noreferrer">
                                    <Button variant="outline" size="sm" className="gap-1">
                                      <NavIcon className="w-4 h-4" />
                                      Directions
                                    </Button>
                                  </a>
                                  <Link to={`/locations/${location.id}`}>
                                    <Button variant="ghost" size="sm" className="gap-1">
                                      Details
                                      <ChevronRight className="w-4 h-4" />
                                    </Button>
                                  </Link>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <MapPin className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-foreground mb-2">No locations found</h3>
                  <p className="text-muted-foreground">
                    {searchQuery || selectedCategory
                      ? "Try adjusting your search or filters"
                      : "Check back soon for new locations!"}
                  </p>
                </div>
              )}
            </TabsContent>

            {/* Events Tab */}
            <TabsContent value="events">
              <div className="flex flex-col md:flex-row gap-4 mb-8">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search events by name or location..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-card/50 border-border/50"
                  />
                </div>
              </div>

              {eventsLoading ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-64" />
                  ))}
                </div>
              ) : filteredEvents.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredEvents.map((event) => {
                    const eventStatus = getEventStatus(event);
                    return (
                      <Card
                        key={event.id}
                        className="group bg-card/50 border-border/50 hover:border-purple-500/50 transition-all overflow-hidden"
                      >
                        {event.stands?.image_url && (
                          <div className="aspect-video relative">
                            <img
                              src={event.stands.image_url}
                              alt={event.stands.name}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                            <Badge className="absolute top-3 left-3 bg-purple-500/90 text-white border-0">
                              <PartyPopper className="w-3 h-3 mr-1" />
                              EVENT
                            </Badge>
                          </div>
                        )}
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-lg group-hover:text-purple-400 transition-colors">
                                {event.event_name}
                              </CardTitle>
                              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                <UtensilsCrossed className="w-3 h-3" />
                                {event.stands?.name}
                              </p>
                            </div>
                            <Badge 
                              className={
                                eventStatus === "ongoing" 
                                  ? "bg-green-500/20 text-green-400 border-green-500/30" 
                                  : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                              }
                            >
                              {eventStatus === "ongoing" ? "Now" : "Upcoming"}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="space-y-2 mb-4">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <MapPin className="w-4 h-4" />
                              <span>{event.event_location}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <CalendarDays className="w-4 h-4" />
                              <span>
                                {format(parseISO(event.event_date), "MMM d, yyyy")}
                                {event.event_end_date && (
                                  <> - {format(parseISO(event.event_end_date), "MMM d, yyyy")}</>
                                )}
                              </span>
                            </div>
                            {event.notes && (
                              <p className="text-sm text-muted-foreground line-clamp-2 pl-6">
                                {event.notes}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center justify-end mt-4 pt-4 border-t border-border/50">
                            <a href={getEventDirectionsUrl(event.event_location)} target="_blank" rel="noopener noreferrer">
                              <Button variant="outline" size="sm" className="gap-1">
                                <NavIcon className="w-4 h-4" />
                                Get Directions
                              </Button>
                            </a>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-20">
                  <PartyPopper className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-foreground mb-2">No upcoming events</h3>
                  <p className="text-muted-foreground">
                    {searchQuery
                      ? "Try adjusting your search"
                      : "Check back soon for upcoming events!"}
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default LocationsPage;
