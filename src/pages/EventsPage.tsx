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
import { 
  MapPin, 
  Search, 
  CalendarDays,
  PartyPopper,
  UtensilsCrossed,
  Navigation as NavIcon,
  ArrowLeft
} from "lucide-react";
import { format, isAfter, isBefore, isToday, parseISO } from "date-fns";

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

const EventsPage = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: standEvents = [], isLoading } = useQuery({
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

  return (
    <div className="relative min-h-screen bg-background">
      <StarField />
      <Navigation />

      <div className="relative z-10 pt-32 pb-20">
        <div className="container mx-auto px-4">
          {/* Back Link */}
          <Link to="/locations" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Locations</span>
          </Link>

          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/30 mb-6">
              <PartyPopper className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-purple-400 font-medium">Local Events</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Upcoming Events
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Find our concession and amusement stands at local events near you
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-12">
            <div className="text-center p-4 rounded-xl bg-card/50 border border-border/50">
              <div className="text-2xl font-bold text-purple-400">{standEvents.length}</div>
              <div className="text-xs text-muted-foreground">Total Events</div>
            </div>
            <div className="text-center p-4 rounded-xl bg-card/50 border border-border/50">
              <div className="text-2xl font-bold text-green-400">
                {standEvents.filter(e => getEventStatus(e) === "ongoing").length}
              </div>
              <div className="text-xs text-muted-foreground">Happening Now</div>
            </div>
            <div className="text-center p-4 rounded-xl bg-card/50 border border-border/50">
              <div className="text-2xl font-bold text-blue-400">
                {standEvents.filter(e => getEventStatus(e) === "upcoming").length}
              </div>
              <div className="text-xs text-muted-foreground">Coming Up</div>
            </div>
          </div>

          {/* Search */}
          <div className="flex flex-col md:flex-row gap-4 mb-8 max-w-xl mx-auto">
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

          {/* Events Grid */}
          {isLoading ? (
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
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default EventsPage;
