import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MapPin, Building2, Monitor, DollarSign, Phone, Mail, 
  TrendingUp, Activity, ChevronRight, ExternalLink
} from "lucide-react";
import { useBusinessOwnerData } from "./useBusinessOwnerData";

const LOCATION_TYPE_ICONS: Record<string, string> = {
  office: "🏢",
  retail: "🏪",
  mall: "🛒",
  gym: "💪",
  school: "🏫",
  hospital: "🏥",
  airport: "✈️",
  hotel: "🏨",
  warehouse: "📦",
};

const BusinessLocations = () => {
  const { assignments, machines, profitSplits, isLoading } = useBusinessOwnerData();
  const [selectedLocation, setSelectedLocation] = useState<any>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading locations...</p>
      </div>
    );
  }

  const getLocationMachines = (locationId: string) => 
    machines?.filter(m => m.location_id === locationId) || [];

  const getLocationStats = (locationId: string) => {
    const locationMachines = getLocationMachines(locationId);
    const totalRevenue = locationMachines.reduce((sum, m) => sum + Number(m.current_period_revenue || 0), 0);
    const lifetimeRevenue = locationMachines.reduce((sum, m) => sum + Number(m.lifetime_revenue || 0), 0);
    const activeMachines = locationMachines.filter(m => m.status === "active").length;
    const offlineMachines = locationMachines.filter(m => m.status === "offline").length;
    
    // Calculate owner's share
    let ownerShare = 0;
    locationMachines.forEach(machine => {
      const split = profitSplits?.find(s => s.machine_id === machine.id);
      const ownerPercentage = split?.business_owner_percentage || 30;
      ownerShare += Number(machine.current_period_revenue || 0) * (ownerPercentage / 100);
    });

    return { 
      totalMachines: locationMachines.length, 
      activeMachines, 
      offlineMachines,
      totalRevenue, 
      lifetimeRevenue,
      ownerShare,
      machines: locationMachines
    };
  };

  const openDirections = (address: string, city: string, country: string) => {
    const query = encodeURIComponent(`${address || ""} ${city}, ${country}`);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    
    if (isIOS) {
      window.open(`maps://maps.apple.com/?q=${query}`, "_blank");
    } else if (isAndroid) {
      window.open(`geo:0,0?q=${query}`, "_blank");
    } else {
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">My Locations</h2>
        <p className="text-muted-foreground">Locations assigned to your partnership</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{assignments?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Locations</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Monitor className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{machines?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Machines</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Activity className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{machines?.filter(m => m.status === "active").length || 0}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <TrendingUp className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-500">
                  ${machines?.reduce((sum, m) => sum + Number(m.current_period_revenue || 0), 0).toLocaleString() || 0}
                </p>
                <p className="text-xs text-muted-foreground">Period Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Locations Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Your Locations
          </CardTitle>
          <CardDescription>{assignments?.length || 0} locations assigned to your account</CardDescription>
        </CardHeader>
        <CardContent>
          {!assignments || assignments.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No locations assigned yet</p>
              <p className="text-sm text-muted-foreground mt-1">Contact VendX to get started</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {assignments.map((assignment: any) => {
                const loc = assignment.location;
                const stats = getLocationStats(assignment.location_id);
                const typeIcon = LOCATION_TYPE_ICONS[loc?.location_type] || "📍";
                
                return (
                  <Card 
                    key={assignment.id} 
                    className="border-border/50 hover:border-primary/50 transition-colors cursor-pointer group"
                    onClick={() => setSelectedLocation({ ...assignment, stats })}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{typeIcon}</span>
                            <h3 className="font-semibold truncate">{loc?.name || `${loc?.city}, ${loc?.country}`}</h3>
                          </div>
                          {loc?.address && (
                            <p className="text-sm text-muted-foreground mt-1 truncate">{loc.address}</p>
                          )}
                        </div>
                        <Badge variant={loc?.status === "active" ? "default" : "secondary"} className="ml-2">
                          {loc?.status}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                        <div className="p-2 bg-muted/50 rounded-lg">
                          <p className="text-lg font-bold">{stats.totalMachines}</p>
                          <p className="text-[10px] text-muted-foreground">Machines</p>
                        </div>
                        <div className="p-2 bg-green-500/10 rounded-lg">
                          <p className="text-lg font-bold text-green-500">{stats.activeMachines}</p>
                          <p className="text-[10px] text-muted-foreground">Active</p>
                        </div>
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <p className="text-lg font-bold text-primary">${stats.ownerShare.toFixed(0)}</p>
                          <p className="text-[10px] text-muted-foreground">Your Share</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-3 border-t">
                        <span className="text-xs text-muted-foreground">View Details</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Location Detail Dialog */}
      <Dialog open={!!selectedLocation} onOpenChange={() => setSelectedLocation(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-xl">
                {LOCATION_TYPE_ICONS[selectedLocation?.location?.location_type] || "📍"}
              </span>
              {selectedLocation?.location?.name || `${selectedLocation?.location?.city}, ${selectedLocation?.location?.country}`}
            </DialogTitle>
            <DialogDescription>
              {selectedLocation?.location?.address || "Location details and machine performance"}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-6 pr-4">
              {/* Location Info */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge variant={selectedLocation?.location?.status === "active" ? "default" : "secondary"} className="mt-1">
                      {selectedLocation?.location?.status}
                    </Badge>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Type</p>
                    <p className="font-medium capitalize mt-1">{selectedLocation?.location?.location_type || "General"}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Contact Info */}
              {(selectedLocation?.location?.contact_name || selectedLocation?.location?.contact_phone || selectedLocation?.location?.contact_email) && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Location Contact</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {selectedLocation?.location?.contact_name && (
                      <p className="font-medium">{selectedLocation.location.contact_name}</p>
                    )}
                    {selectedLocation?.location?.contact_phone && (
                      <a href={`tel:${selectedLocation.location.contact_phone}`} className="flex items-center gap-2 text-sm text-primary">
                        <Phone className="w-4 h-4" />
                        {selectedLocation.location.contact_phone}
                      </a>
                    )}
                    {selectedLocation?.location?.contact_email && (
                      <a href={`mailto:${selectedLocation.location.contact_email}`} className="flex items-center gap-2 text-sm text-primary">
                        <Mail className="w-4 h-4" />
                        {selectedLocation.location.contact_email}
                      </a>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Revenue Stats */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Revenue at this Location
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-xl font-bold">${selectedLocation?.stats?.totalRevenue?.toLocaleString() || 0}</p>
                      <p className="text-xs text-muted-foreground">Period Gross</p>
                    </div>
                    <div className="text-center p-3 bg-green-500/10 rounded-lg">
                      <p className="text-xl font-bold text-green-500">${selectedLocation?.stats?.ownerShare?.toFixed(2) || 0}</p>
                      <p className="text-xs text-muted-foreground">Your Share</p>
                    </div>
                    <div className="text-center p-3 bg-primary/10 rounded-lg">
                      <p className="text-xl font-bold">${selectedLocation?.stats?.lifetimeRevenue?.toLocaleString() || 0}</p>
                      <p className="text-xs text-muted-foreground">Lifetime</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Machines at Location */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Monitor className="w-4 h-4" />
                    Machines ({selectedLocation?.stats?.totalMachines || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedLocation?.stats?.machines?.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">No machines at this location</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedLocation?.stats?.machines?.map((machine: any) => {
                        const split = profitSplits?.find((s: any) => s.machine_id === machine.id);
                        const ownerPercentage = split?.business_owner_percentage || 30;
                        const revenue = Number(machine.current_period_revenue || 0);
                        const share = revenue * (ownerPercentage / 100);

                        return (
                          <div key={machine.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <Badge 
                                variant={machine.status === "active" ? "default" : machine.status === "offline" ? "destructive" : "secondary"}
                                className="w-2 h-2 p-0 rounded-full"
                              />
                              <div>
                                <p className="font-medium text-sm">{machine.name}</p>
                                <p className="text-xs text-muted-foreground">{machine.machine_type} · {machine.machine_code}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-green-500">${share.toFixed(2)}</p>
                              <p className="text-xs text-muted-foreground">{ownerPercentage}% of ${revenue}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => openDirections(
                    selectedLocation?.location?.address,
                    selectedLocation?.location?.city,
                    selectedLocation?.location?.country
                  )}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Get Directions
                </Button>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BusinessLocations;
