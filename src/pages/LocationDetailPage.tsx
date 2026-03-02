import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import StarField from "@/components/StarField";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  MapPin, 
  ArrowLeft,
  Coffee,
  Gamepad2,
  Combine,
  Building2,
  Globe,
  Navigation as NavIcon,
  ShoppingBag,
  GraduationCap,
  Hotel,
  Dumbbell,
  Plane,
  Hospital,
  Factory,
  Store,
  Warehouse
} from "lucide-react";
import { useSEO } from "@/hooks/useSEO";

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

interface ArcadeGame {
  id: string;
  machine_count: number | null;
  arcade_game_titles: {
    id: string;
    name: string;
    game_type: string;
    description: string | null;
    image_url: string | null;
  };
}

const categoryIcons: Record<string, React.ReactNode> = {
  vending: <Coffee className="w-6 h-6" />,
  arcade: <Gamepad2 className="w-6 h-6" />,
  mixed: <Combine className="w-6 h-6" />,
};

const categoryLabels: Record<string, string> = {
  vending: "Vending Only",
  arcade: "Arcade Only",
  mixed: "Vending + Arcade",
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

const gameTypeLabels: Record<string, string> = {
  claw: "Claw Machine",
  cabinet: "Arcade Cabinet",
  redemption: "Redemption Game",
  simulator: "Simulator",
  racing: "Racing",
  shooter: "Shooter",
  sports: "Sports",
  rhythm: "Rhythm Game",
  other: "Other",
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

const LocationDetailPage = () => {
  const { id } = useParams<{ id: string }>();

  const { data: location, isLoading: locationLoading } = useQuery({
    queryKey: ["location", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .eq("id", id)
        .eq("is_visible", true)
        .single();

      if (error) throw error;
      return data as Location;
    },
    enabled: !!id,
  });

  useSEO({
    title: location ? `${location.name || location.city} — VendX Location` : "VendX Location",
    description: location ? `VendX machines at ${location.name || location.city}, ${location.country}. ${location.machine_count} machines available.` : "VendX machine location details",
  });

  const { data: arcadeGames, isLoading: arcadeLoading } = useQuery({
    queryKey: ["location-arcade-games", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("location_arcade_games")
        .select(`
          id,
          machine_count,
          arcade_game_titles (
            id,
            name,
            game_type,
            description,
            image_url
          )
        `)
        .eq("location_id", id)
        .eq("is_active", true);

      if (error) throw error;
      return data as ArcadeGame[];
    },
    enabled: !!id,
  });

  const vendingMachines = useMemo(() => {
    if (!location) return [];
    const machines = [];
    
    if (location.snack_machine_count && location.snack_machine_count > 0) {
      machines.push({ type: "Snack Machines", count: location.snack_machine_count, icon: "🍫" });
    }
    if (location.drink_machine_count && location.drink_machine_count > 0) {
      machines.push({ type: "Drink Machines", count: location.drink_machine_count, icon: "🥤" });
    }
    if (location.combo_machine_count && location.combo_machine_count > 0) {
      machines.push({ type: "Combo Machines", count: location.combo_machine_count, icon: "🍿" });
    }
    if (location.specialty_machine_count && location.specialty_machine_count > 0) {
      machines.push({ type: "Specialty Machines", count: location.specialty_machine_count, icon: "✨" });
    }
    
    return machines;
  }, [location]);

  const directionsUrl = useMemo(() => {
    if (!location) return null;
    
    const getDestination = () => {
      if (location.latitude && location.longitude) {
        return `${location.latitude},${location.longitude}`;
      }
      if (location.address) {
        return encodeURIComponent(`${location.address}, ${location.city}, ${location.country}`);
      }
      return encodeURIComponent(`${location.city}, ${location.country}`);
    };

    const destination = getDestination();
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);

    if (isIOS) {
      return `maps://maps.apple.com/?daddr=${destination}`;
    } else if (isAndroid) {
      return `geo:0,0?q=${destination}`;
    }
    return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
  }, [location]);

  if (locationLoading) {
    return (
      <div className="relative min-h-screen bg-background">
        <StarField />
        <Navigation />
        <div className="relative z-10 pt-32 pb-20">
          <div className="container mx-auto px-4">
            <Skeleton className="h-8 w-32 mb-8" />
            <Skeleton className="h-12 w-1/2 mb-4" />
            <Skeleton className="h-6 w-1/3 mb-8" />
            <Skeleton className="h-[300px] w-full rounded-xl mb-8" />
            <div className="grid md:grid-cols-2 gap-8">
              <Skeleton className="h-64" />
              <Skeleton className="h-64" />
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!location) {
    return (
      <div className="relative min-h-screen bg-background">
        <StarField />
        <Navigation />
        <div className="relative z-10 pt-32 pb-20">
          <div className="container mx-auto px-4 text-center">
            <MapPin className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-foreground mb-4">Location Not Found</h1>
            <p className="text-muted-foreground mb-8">This location doesn't exist or isn't available.</p>
            <Link to="/locations">
              <Button>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Locations
              </Button>
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background">
      <StarField />
      <Navigation />

      <div className="relative z-10 pt-32 pb-20">
        <div className="container mx-auto px-4">
          {/* Back Button */}
          <Link to="/locations" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Locations
          </Link>

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                {categoryIcons[location.location_category || "vending"]}
                <h1 className="text-3xl md:text-4xl font-bold text-foreground">
                  {location.name || location.city}
                </h1>
                <Badge className={statusColors[location.status] || statusColors.active}>
                  {statusLabels[location.status] || location.status}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Globe className="w-4 h-4" />
                <span>{location.city}, {location.country}</span>
                {location.location_type && (
                  <Badge variant="outline" className="gap-1 ml-2">
                    {locationTypeIcons[location.location_type] || <Building2 className="w-4 h-4" />}
                    {locationTypeLabels[location.location_type] || location.location_type}
                  </Badge>
                )}
              </div>
              {location.address && (
                <p className="text-muted-foreground mt-1">{location.address}</p>
              )}
            </div>
            
            {directionsUrl && (
              <a href={directionsUrl} target="_blank" rel="noopener noreferrer">
                <Button className="gap-2">
                  <NavIcon className="w-4 h-4" />
                  Get Directions
                </Button>
              </a>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Vending Machines */}
            {(location.location_category === "vending" || location.location_category === "mixed") && (
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Coffee className="w-5 h-5 text-primary" />
                    Vending Machines
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {vendingMachines.length > 0 ? (
                    <div className="space-y-3">
                      {vendingMachines.map((machine) => (
                        <div
                          key={machine.type}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{machine.icon}</span>
                            <span className="font-medium">{machine.type}</span>
                          </div>
                          <Badge variant="outline">{machine.count}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      No vending machines at this location
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Arcade Machines */}
            {(location.location_category === "arcade" || location.location_category === "mixed") && (
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gamepad2 className="w-5 h-5 text-purple-400" />
                    Arcade Machines
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {arcadeLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-16" />
                      ))}
                    </div>
                  ) : arcadeGames && arcadeGames.length > 0 ? (
                    <div className="space-y-3">
                      {arcadeGames.map((game) => (
                        <div
                          key={game.id}
                          className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50"
                        >
                          {game.arcade_game_titles.image_url ? (
                            <img
                              src={game.arcade_game_titles.image_url}
                              alt={game.arcade_game_titles.name}
                              className="w-12 h-12 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
                              <Gamepad2 className="w-6 h-6 text-purple-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{game.arcade_game_titles.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {gameTypeLabels[game.arcade_game_titles.game_type] || game.arcade_game_titles.game_type}
                            </p>
                          </div>
                          {game.machine_count && game.machine_count > 1 && (
                            <Badge variant="outline">×{game.machine_count}</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : location.arcade_machine_count && location.arcade_machine_count > 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-2">
                        {location.arcade_machine_count} arcade machine{location.arcade_machine_count !== 1 ? "s" : ""} available
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Game list coming soon
                      </p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      No arcade machines at this location
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default LocationDetailPage;
