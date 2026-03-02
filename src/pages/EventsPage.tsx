import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import StarField from "@/components/StarField";
import Footer from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Search, 
  PartyPopper,
  ArrowLeft
} from "lucide-react";
import { parseLocalDate, isLocalToday } from "@/lib/dateUtils";

import EventCard from "@/components/events/EventCard";
import { useSEO } from "@/hooks/useSEO";

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
    slug: string | null;
    description: string | null;
    image_url: string | null;
  };
}

const EventsPage = () => {
  const [searchQuery, setSearchQuery] = useState("");

  useSEO({
    title: "Upcoming Events — VendX",
    description: "Find VendX concession and amusement stands at local events near you.",
  });

  const { data: standEvents = [], isLoading } = useQuery({
    queryKey: ["public-stand-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stand_events")
        .select("*, stands(id, name, slug, description, image_url)")
        .in("status", ["upcoming", "ongoing"])
        .order("event_date", { ascending: true });

      if (error) throw error;
      return data as unknown as StandEvent[];
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
    const startDate = parseLocalDate(event.event_date);
    const endDate = event.event_end_date ? parseLocalDate(event.event_end_date) : startDate;

    if (isLocalToday(event.event_date) || (today > startDate && today < endDate) || (event.event_end_date && isLocalToday(event.event_end_date))) {
      return "ongoing";
    }
    if (startDate > today) {
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
              {filteredEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
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
