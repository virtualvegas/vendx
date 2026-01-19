import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  MapPin, 
  CalendarDays, 
  PartyPopper, 
  UtensilsCrossed,
  Navigation as NavIcon,
  ChevronRight
} from "lucide-react";
import { format, parseISO, isAfter, isBefore, isToday } from "date-fns";

interface Stand {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  image_url: string | null;
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
  stands?: Stand;
}

interface EventCardProps {
  event: StandEvent;
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

const EventCard = ({ event }: EventCardProps) => {
  const eventStatus = getEventStatus(event);

  return (
    <Card className="group bg-card/50 border-border/50 hover:border-purple-500/50 transition-all overflow-hidden">
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
            {event.stands && (
              <div className="flex items-center gap-1 mt-1">
                <UtensilsCrossed className="w-3 h-3 text-muted-foreground" />
                {event.stands.slug ? (
                  <Link 
                    to={`/stands/${event.stands.slug}`}
                    className="text-sm text-orange-400 hover:text-orange-300 transition-colors"
                  >
                    {event.stands.name}
                  </Link>
                ) : (
                  <span className="text-sm text-muted-foreground">{event.stands.name}</span>
                )}
              </div>
            )}
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

        {/* Stand Preview - Inline Expansion */}
        {event.stands?.description && (
          <div className="mb-4 p-3 rounded-lg bg-background/50 border border-border/30">
            <p className="text-xs text-muted-foreground line-clamp-2">
              {event.stands.description}
            </p>
            {event.stands.slug && (
              <Link 
                to={`/stands/${event.stands.slug}`}
                className="inline-flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 mt-2"
              >
                View full stand details
                <ChevronRight className="w-3 h-3" />
              </Link>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 mt-4 pt-4 border-t border-border/50">
          {event.stands?.slug && (
            <Link to={`/stands/${event.stands.slug}`}>
              <Button variant="ghost" size="sm" className="gap-1 text-orange-400 hover:text-orange-300 hover:bg-orange-500/10">
                <UtensilsCrossed className="w-4 h-4" />
                Stand Info
              </Button>
            </Link>
          )}
          <a href={getEventDirectionsUrl(event.event_location)} target="_blank" rel="noopener noreferrer" className="ml-auto">
            <Button variant="outline" size="sm" className="gap-1">
              <NavIcon className="w-4 h-4" />
              Directions
            </Button>
          </a>
        </div>
      </CardContent>
    </Card>
  );
};

export default EventCard;
