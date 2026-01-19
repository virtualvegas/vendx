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
  ArrowLeft, 
  MapPin, 
  CalendarDays, 
  UtensilsCrossed,
  Store,
  Sparkles,
  Navigation as NavIcon,
  ImageIcon
} from "lucide-react";
import { format, parseISO, isAfter, isBefore, isToday } from "date-fns";

interface Stand {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  story: string | null;
  brand_future_focus: string | null;
  image_url: string | null;
  images: string[] | null;
  status: string;
}

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  category: string | null;
  is_available: boolean;
  display_order: number;
}

interface StandEvent {
  id: string;
  event_name: string;
  event_location: string;
  event_date: string;
  event_end_date: string | null;
  notes: string | null;
  status: string;
}

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

const StandDetailPage = () => {
  const { slug } = useParams<{ slug: string }>();

  const { data: stand, isLoading: standLoading } = useQuery({
    queryKey: ["stand", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stands")
        .select("*")
        .eq("slug", slug as string)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as Stand | null;
    },
    enabled: !!slug,
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ["stand-menu", stand?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stand_menu_items")
        .select("*")
        .eq("stand_id", stand!.id)
        .eq("is_available", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as MenuItem[];
    },
    enabled: !!stand?.id,
  });

  const { data: events = [] } = useQuery({
    queryKey: ["stand-events", stand?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stand_events")
        .select("*")
        .eq("stand_id", stand!.id)
        .in("status", ["upcoming", "ongoing"])
        .order("event_date", { ascending: true });

      if (error) throw error;
      return data as StandEvent[];
    },
    enabled: !!stand?.id,
  });

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

  // Group menu items by category
  const menuByCategory = menuItems.reduce((acc, item) => {
    const category = item.category || "Other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  if (standLoading) {
    return (
      <div className="relative min-h-screen bg-background">
        <StarField />
        <Navigation />
        <div className="relative z-10 pt-32 pb-20">
          <div className="container mx-auto px-4">
            <Skeleton className="h-8 w-48 mb-6" />
            <Skeleton className="h-64 w-full mb-8" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!stand) {
    return (
      <div className="relative min-h-screen bg-background">
        <StarField />
        <Navigation />
        <div className="relative z-10 pt-32 pb-20">
          <div className="container mx-auto px-4 text-center">
            <Store className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-foreground mb-2">Stand Not Found</h1>
            <p className="text-muted-foreground mb-6">The stand you're looking for doesn't exist.</p>
            <Link to="/locations/events">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Events
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
          {/* Back Link */}
          <Link to="/locations/events" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Events</span>
          </Link>

          {/* Hero Section */}
          <div className="grid lg:grid-cols-2 gap-8 mb-12">
            {/* Images */}
            <div className="space-y-4">
              {stand.image_url && (
                <div className="aspect-video rounded-xl overflow-hidden border border-border/50">
                  <img
                    src={stand.image_url}
                    alt={stand.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              {stand.images && stand.images.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {stand.images.slice(0, 6).map((img, idx) => (
                    <div key={idx} className="aspect-square rounded-lg overflow-hidden border border-border/50">
                      <img src={img} alt={`${stand.name} ${idx + 1}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
              {!stand.image_url && (!stand.images || stand.images.length === 0) && (
                <div className="aspect-video rounded-xl bg-card/50 border border-border/50 flex items-center justify-center">
                  <ImageIcon className="w-16 h-16 text-muted-foreground/30" />
                </div>
              )}
            </div>

            {/* Info */}
            <div>
              <Badge className="mb-4 bg-orange-500/20 text-orange-400 border-orange-500/30">
                <Store className="w-3 h-3 mr-1" />
                Stand
              </Badge>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                {stand.name}
              </h1>
              {stand.description && (
                <p className="text-lg text-muted-foreground mb-6">
                  {stand.description}
                </p>
              )}

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-card/50 border border-border/50">
                  <div className="text-2xl font-bold text-purple-400">{events.length}</div>
                  <div className="text-xs text-muted-foreground">Upcoming Events</div>
                </div>
                <div className="p-4 rounded-xl bg-card/50 border border-border/50">
                  <div className="text-2xl font-bold text-green-400">{menuItems.length}</div>
                  <div className="text-xs text-muted-foreground">Menu Items</div>
                </div>
              </div>

              {/* Story */}
              {stand.story && (
                <div className="p-4 rounded-xl bg-card/50 border border-border/50 mb-4">
                  <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    Our Story
                  </h3>
                  <p className="text-sm text-muted-foreground">{stand.story}</p>
                </div>
              )}

              {/* Brand Future Focus */}
              {stand.brand_future_focus && (
                <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30">
                  <h3 className="font-semibold text-foreground mb-2">Future Vision</h3>
                  <p className="text-sm text-muted-foreground">{stand.brand_future_focus}</p>
                </div>
              )}
            </div>
          </div>

          {/* Menu Section */}
          {menuItems.length > 0 && (
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
                <UtensilsCrossed className="w-6 h-6 text-orange-400" />
                Menu
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(menuByCategory).map(([category, items]) => (
                  <Card key={category} className="bg-card/50 border-border/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg text-orange-400">{category}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {items.map((item) => (
                        <div key={item.id} className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-foreground">{item.name}</p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground">{item.description}</p>
                            )}
                          </div>
                          {item.price && (
                            <span className="text-sm font-semibold text-green-400">
                              ${item.price.toFixed(2)}
                            </span>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Events Section */}
          {events.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
                <CalendarDays className="w-6 h-6 text-purple-400" />
                Upcoming Events
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {events.map((event) => {
                  const eventStatus = getEventStatus(event);
                  return (
                    <Card key={event.id} className="bg-card/50 border-border/50 hover:border-purple-500/50 transition-all">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-lg">{event.event_name}</CardTitle>
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
                      <CardContent className="space-y-2">
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
                          <p className="text-sm text-muted-foreground">{event.notes}</p>
                        )}
                        <div className="pt-2">
                          <a href={getEventDirectionsUrl(event.event_location)} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm" className="w-full gap-1">
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
            </div>
          )}

          {events.length === 0 && menuItems.length === 0 && (
            <div className="text-center py-12">
              <CalendarDays className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">No upcoming events or menu items yet.</p>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default StandDetailPage;
