import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
import { useBusinessOwnerData } from "./useBusinessOwnerData";

const BusinessLocations = () => {
  const { assignments, machines, isLoading } = useBusinessOwnerData();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading locations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">My Locations</h2>
        <p className="text-muted-foreground">Locations assigned to your partnership</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Your Locations
          </CardTitle>
          <CardDescription>{assignments?.length || 0} locations assigned</CardDescription>
        </CardHeader>
        <CardContent>
          {!assignments || assignments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No locations assigned</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {assignments.map((assignment: any) => {
                const loc = assignment.location;
                const locationMachines = machines?.filter(m => m.location_id === assignment.location_id) || [];
                const locationRevenue = locationMachines.reduce((sum, m) => sum + Number(m.current_period_revenue || 0), 0);
                const activeMachines = locationMachines.filter(m => m.status === "active").length;
                
                return (
                  <Card key={assignment.id} className="border-border/50">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold">{loc?.name || `${loc?.city}, ${loc?.country}`}</h3>
                          {loc?.address && <p className="text-sm text-muted-foreground">{loc.address}</p>}
                          {loc?.location_type && (
                            <Badge variant="outline" className="mt-1 capitalize">{loc.location_type}</Badge>
                          )}
                        </div>
                        <Badge variant={loc?.status === "active" ? "default" : "secondary"}>
                          {loc?.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 mt-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Machines</p>
                          <p className="text-lg font-bold">{locationMachines.length}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Active</p>
                          <p className="text-lg font-bold text-green-500">{activeMachines}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Revenue</p>
                          <p className="text-lg font-bold text-primary">${locationRevenue.toLocaleString()}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BusinessLocations;
