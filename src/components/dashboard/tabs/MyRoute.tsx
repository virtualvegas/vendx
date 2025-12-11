import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Clock, CheckCircle, Circle, Navigation, Phone } from "lucide-react";

interface RouteStop {
  id: string;
  route_id: string;
  stop_name: string;
  address: string | null;
  notes: string | null;
  stop_order: number;
  estimated_duration_minutes: number | null;
  status: string;
  completed_at: string | null;
  location_id: string | null;
  machine_id: string | null;
}

interface ServiceRoute {
  id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
}

const MyRoute = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: routes, isLoading: routesLoading } = useQuery({
    queryKey: ["my-routes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_routes")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ServiceRoute[];
    },
  });

  const { data: stops, isLoading: stopsLoading } = useQuery({
    queryKey: ["my-route-stops", routes?.[0]?.id],
    queryFn: async () => {
      if (!routes?.[0]?.id) return [];
      const { data, error } = await supabase
        .from("route_stops")
        .select("*")
        .eq("route_id", routes[0].id)
        .order("stop_order", { ascending: true });
      if (error) throw error;
      return data as RouteStop[];
    },
    enabled: !!routes?.[0]?.id,
  });

  const completeStopMutation = useMutation({
    mutationFn: async (stopId: string) => {
      const { error } = await supabase
        .from("route_stops")
        .update({ 
          status: "completed", 
          completed_at: new Date().toISOString() 
        })
        .eq("id", stopId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-route-stops"] });
      toast({ title: "Stop Completed", description: "Moving to next stop" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const activeRoute = routes?.[0];
  const pendingStops = stops?.filter(s => s.status === "pending") || [];
  const completedStops = stops?.filter(s => s.status === "completed") || [];
  const currentStop = pendingStops[0];
  const progress = stops?.length ? Math.round((completedStops.length / stops.length) * 100) : 0;

  if (routesLoading || stopsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading your route...</p>
      </div>
    );
  }

  if (!activeRoute) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-foreground mb-2">My Route</h2>
          <p className="text-muted-foreground">View and manage your assigned service route</p>
        </div>
        <Card>
          <CardContent className="py-16 text-center">
            <MapPin className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No Route Assigned</h3>
            <p className="text-muted-foreground">You don't have any active routes assigned to you today.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">My Route</h2>
        <p className="text-muted-foreground">View and manage your assigned service route</p>
      </div>

      {/* Route Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Route</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-foreground">{activeRoute.name}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Stops</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{stops?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-500">{completedStops.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{progress}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Current Stop */}
      {currentStop && (
        <Card className="border-primary">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Navigation className="w-5 h-5 text-primary" />
                Current Stop
              </CardTitle>
              <Badge variant="outline" className="text-primary border-primary">
                Stop {currentStop.stop_order + 1} of {stops?.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-2xl font-bold text-foreground">{currentStop.stop_name}</h3>
              {currentStop.address && (
                <p className="text-muted-foreground flex items-center gap-2 mt-1">
                  <MapPin className="w-4 h-4" />
                  {currentStop.address}
                </p>
              )}
            </div>
            
            {currentStop.notes && (
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-sm text-muted-foreground">{currentStop.notes}</p>
              </div>
            )}
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Est. {currentStop.estimated_duration_minutes || 15} min
              </span>
            </div>
            
            <div className="flex gap-3">
              <Button 
                className="flex-1"
                onClick={() => completeStopMutation.mutate(currentStop.id)}
                disabled={completeStopMutation.isPending}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Complete Stop
              </Button>
              {currentStop.address && (
                <Button 
                  variant="outline"
                  onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(currentStop.address!)}`, '_blank')}
                >
                  <Navigation className="w-4 h-4 mr-2" />
                  Navigate
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Stops */}
      {pendingStops.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Stops</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingStops.slice(1).map((stop, index) => (
                <div key={stop.id} className="flex items-center gap-3 p-3 border border-border rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                    {stop.stop_order + 1}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-foreground">{stop.stop_name}</h4>
                    {stop.address && (
                      <p className="text-sm text-muted-foreground">{stop.address}</p>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {stop.estimated_duration_minutes || 15} min
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completed Stops */}
      {completedStops.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-green-500">Completed Stops</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {completedStops.map((stop) => (
                <div key={stop.id} className="flex items-center gap-3 p-3 border border-border rounded-lg opacity-60">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                  <div className="flex-1">
                    <h4 className="font-medium text-foreground">{stop.stop_name}</h4>
                    {stop.completed_at && (
                      <p className="text-sm text-muted-foreground">
                        Completed at {new Date(stop.completed_at).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Stops Complete */}
      {pendingStops.length === 0 && completedStops.length > 0 && (
        <Card className="border-green-500 bg-green-500/10">
          <CardContent className="py-8 text-center">
            <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">Route Complete!</h3>
            <p className="text-muted-foreground">Great job! You've completed all stops on your route.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MyRoute;