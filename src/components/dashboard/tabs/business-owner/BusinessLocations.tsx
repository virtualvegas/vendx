import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  MapPin, Building2, Monitor, DollarSign, Phone, Mail, 
  TrendingUp, Activity, ChevronRight, ExternalLink, Plus, Send, Clock, CheckCircle2, XCircle
} from "lucide-react";
import { useBusinessOwnerData } from "./useBusinessOwnerData";

const LOCATION_TYPE_ICONS: Record<string, string> = {
  office: "🏢", retail: "🏪", mall: "🛒", gym: "💪", school: "🏫",
  hospital: "🏥", airport: "✈️", hotel: "🏨", warehouse: "📦",
};

const BusinessLocations = () => {
  const { assignments, machines, machineRevenue, profitSplits, changeRequests, isLoading } = useBusinessOwnerData();
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [requestType, setRequestType] = useState<string>("name_change");
  const [requestLocationId, setRequestLocationId] = useState<string>("");
  const [requestDescription, setRequestDescription] = useState("");
  const [requestDetails, setRequestDetails] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const submitRequest = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      const { error } = await supabase
        .from("location_change_requests" as any)
        .insert({
          requested_by: user.id,
          location_id: requestLocationId || null,
          request_type: requestType,
          description: requestDescription,
          details: requestDetails,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-owner-change-requests"] });
      toast({ title: "Request submitted", description: "An admin will review your request." });
      setShowRequestDialog(false);
      setRequestDescription("");
      setRequestDetails({});
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

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
    let totalRevenue = 0, lifetimeRevenue = 0, ownerShare = 0;
    
    locationMachines.forEach(m => {
      const rev = machineRevenue.get(m.id);
      const periodRev = rev?.period || 0;
      totalRevenue += periodRev;
      lifetimeRevenue += rev?.lifetime || 0;
      
      const split = profitSplits?.find(s => s.machine_id === m.id);
      const ownerPercentage = split?.business_owner_percentage || 30;
      ownerShare += periodRev * (ownerPercentage / 100);
    });

    return { 
      totalMachines: locationMachines.length, 
      activeMachines: locationMachines.filter(m => m.status === "active").length,
      offlineMachines: locationMachines.filter(m => m.status === "offline").length,
      totalRevenue, lifetimeRevenue, ownerShare,
      machines: locationMachines
    };
  };

  const openDirections = (address: string, city: string, country: string) => {
    const query = encodeURIComponent(`${address || ""} ${city}, ${country}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
  };

  const getRequestStatusIcon = (status: string) => {
    switch (status) {
      case "pending": return <Clock className="w-4 h-4 text-yellow-500" />;
      case "approved": return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "denied": return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const totalPeriodRevenue = machines?.reduce((sum, m) => sum + (machineRevenue.get(m.id)?.period || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">My Locations</h2>
          <p className="text-muted-foreground">Locations assigned to your partnership</p>
        </div>
        <Button onClick={() => setShowRequestDialog(true)}>
          <Send className="w-4 h-4 mr-2" />
          Submit Request
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><Building2 className="w-5 h-5 text-primary" /></div>
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
              <div className="p-2 rounded-lg bg-green-500/10"><Monitor className="w-5 h-5 text-green-500" /></div>
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
              <div className="p-2 rounded-lg bg-blue-500/10"><Activity className="w-5 h-5 text-blue-500" /></div>
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
              <div className="p-2 rounded-lg bg-yellow-500/10"><TrendingUp className="w-5 h-5 text-yellow-500" /></div>
              <div>
                <p className="text-2xl font-bold text-green-500">${totalPeriodRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-muted-foreground">30d Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Locations Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MapPin className="w-5 h-5" />Your Locations</CardTitle>
          <CardDescription>{assignments?.length || 0} locations · Revenue from live transactions</CardDescription>
        </CardHeader>
        <CardContent>
          {!assignments || assignments.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No locations assigned yet</p>
              <Button variant="outline" className="mt-4" onClick={() => { setRequestType("new_location"); setShowRequestDialog(true); }}>
                <Plus className="w-4 h-4 mr-2" />Request New Location
              </Button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {assignments.map((assignment: any) => {
                const loc = assignment.location;
                const stats = getLocationStats(assignment.location_id);
                const typeIcon = LOCATION_TYPE_ICONS[loc?.location_type] || "📍";
                const isVendxGlobal = assignment.is_vendx_global;
                
                return (
                  <Card key={assignment.id} className="border-border/50 hover:border-primary/50 transition-colors cursor-pointer group" onClick={() => setSelectedLocation({ ...assignment, stats })}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{typeIcon}</span>
                            <h3 className="font-semibold truncate">{loc?.name || `${loc?.city}, ${loc?.country}`}</h3>
                          </div>
                          {loc?.address && <p className="text-sm text-muted-foreground mt-1 truncate">{loc.address}</p>}
                        </div>
                        <div className="flex flex-col items-end gap-1 ml-2">
                          <Badge variant={loc?.status === "active" ? "default" : "secondary"}>{loc?.status}</Badge>
                          {isVendxGlobal ? (
                            <Badge variant="outline" className="text-[10px] border-primary/50 text-primary">VendX Global</Badge>
                          ) : assignment.assigned_partner_id ? (
                            <Badge variant="outline" className="text-[10px] border-yellow-500/50 text-yellow-600">Partner</Badge>
                          ) : null}
                        </div>
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
                          <p className="text-lg font-bold text-primary">${stats.ownerShare.toFixed(2)}</p>
                          <p className="text-[10px] text-muted-foreground">{isVendxGlobal ? "Revenue" : "Your Share"}</p>
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

      {/* Change Requests History */}
      {changeRequests && changeRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Send className="w-5 h-5" />Your Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {changeRequests.map((req: any) => (
                <div key={req.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getRequestStatusIcon(req.status)}
                    <div>
                      <p className="font-medium text-sm capitalize">{req.request_type.replace("_", " ")}</p>
                      <p className="text-xs text-muted-foreground">{req.description?.slice(0, 60) || "No description"}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={req.status === "approved" ? "default" : req.status === "denied" ? "destructive" : "secondary"}>{req.status}</Badge>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(req.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submit Request Dialog */}
      <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit a Request</DialogTitle>
            <DialogDescription>Request changes to your locations. An admin will review and respond.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Request Type</Label>
              <Select value={requestType} onValueChange={setRequestType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="name_change">Change Location Name</SelectItem>
                  <SelectItem value="add_machine">Request Additional Machines</SelectItem>
                  <SelectItem value="new_location">Request New Location</SelectItem>
                  <SelectItem value="other">Other Request</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {requestType !== "new_location" && assignments && assignments.length > 0 && (
              <div className="space-y-2">
                <Label>Location</Label>
                <Select value={requestLocationId} onValueChange={setRequestLocationId}>
                  <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                  <SelectContent>
                    {assignments.map((a: any) => (
                      <SelectItem key={a.location_id} value={a.location_id}>
                        {a.location?.name || `${a.location?.city}, ${a.location?.country}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {requestType === "name_change" && (
              <div className="space-y-2">
                <Label>New Name</Label>
                <Input 
                  value={requestDetails.new_name || ""} 
                  onChange={(e) => setRequestDetails({ ...requestDetails, new_name: e.target.value })}
                  placeholder="Enter desired location name"
                />
              </div>
            )}

            {requestType === "add_machine" && (
              <div className="space-y-2">
                <Label>Machine Type & Quantity</Label>
                <Input 
                  value={requestDetails.machine_info || ""} 
                  onChange={(e) => setRequestDetails({ ...requestDetails, machine_info: e.target.value })}
                  placeholder="e.g., 2x Snack Machines, 1x Arcade"
                />
              </div>
            )}

            {requestType === "new_location" && (
              <>
                <div className="space-y-2">
                  <Label>Location Address</Label>
                  <Input 
                    value={requestDetails.address || ""} 
                    onChange={(e) => setRequestDetails({ ...requestDetails, address: e.target.value })}
                    placeholder="Full address of the new location"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Location Type</Label>
                  <Input 
                    value={requestDetails.location_type || ""} 
                    onChange={(e) => setRequestDetails({ ...requestDetails, location_type: e.target.value })}
                    placeholder="e.g., Office, Mall, Gym"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Additional Details</Label>
              <Textarea 
                value={requestDescription} 
                onChange={(e) => setRequestDescription(e.target.value)}
                placeholder="Describe your request in detail..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRequestDialog(false)}>Cancel</Button>
            <Button 
              onClick={() => submitRequest.mutate()} 
              disabled={!requestDescription || submitRequest.isPending}
            >
              <Send className="w-4 h-4 mr-2" />
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Location Detail Dialog */}
      <Dialog open={!!selectedLocation} onOpenChange={() => setSelectedLocation(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-xl">{LOCATION_TYPE_ICONS[selectedLocation?.location?.location_type] || "📍"}</span>
              {selectedLocation?.location?.name || `${selectedLocation?.location?.city}, ${selectedLocation?.location?.country}`}
            </DialogTitle>
            <DialogDescription>{selectedLocation?.location?.address || "Location details"}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-6 pr-4">
              <div className="grid grid-cols-2 gap-4">
                <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Status</p><Badge variant={selectedLocation?.location?.status === "active" ? "default" : "secondary"} className="mt-1">{selectedLocation?.location?.status}</Badge></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Type</p><p className="font-medium capitalize mt-1">{selectedLocation?.location?.location_type || "General"}</p></CardContent></Card>
              </div>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="w-4 h-4" />Revenue (Live)</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-xl font-bold">${selectedLocation?.stats?.totalRevenue?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "0.00"}</p>
                      <p className="text-xs text-muted-foreground">30d Gross</p>
                    </div>
                    <div className="text-center p-3 bg-green-500/10 rounded-lg">
                      <p className="text-xl font-bold text-green-500">${selectedLocation?.stats?.ownerShare?.toFixed(2) || "0.00"}</p>
                      <p className="text-xs text-muted-foreground">Your Share</p>
                    </div>
                    <div className="text-center p-3 bg-primary/10 rounded-lg">
                      <p className="text-xl font-bold">${selectedLocation?.stats?.lifetimeRevenue?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "0.00"}</p>
                      <p className="text-xs text-muted-foreground">Lifetime</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Monitor className="w-4 h-4" />Machines ({selectedLocation?.stats?.totalMachines || 0})</CardTitle></CardHeader>
                <CardContent>
                  {selectedLocation?.stats?.machines?.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">No machines at this location</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedLocation?.stats?.machines?.map((machine: any) => {
                        const split = profitSplits?.find((s: any) => s.machine_id === machine.id);
                        const ownerPercentage = split?.business_owner_percentage || 30;
                        const revenue = machineRevenue.get(machine.id)?.period || 0;
                        const share = revenue * (ownerPercentage / 100);

                        return (
                          <div key={machine.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <Badge variant={machine.status === "active" ? "default" : machine.status === "offline" ? "destructive" : "secondary"} className="w-2 h-2 p-0 rounded-full" />
                              <div>
                                <p className="font-medium text-sm">{machine.name}</p>
                                <p className="text-xs text-muted-foreground">{machine.machine_type} · {machine.machine_code}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-green-500">${share.toFixed(2)}</p>
                              <p className="text-xs text-muted-foreground">{ownerPercentage}% of ${revenue.toFixed(2)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => openDirections(selectedLocation?.location?.address, selectedLocation?.location?.city, selectedLocation?.location?.country)}>
                  <ExternalLink className="w-4 h-4 mr-2" />Get Directions
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => { setRequestLocationId(selectedLocation?.location_id); setSelectedLocation(null); setShowRequestDialog(true); }}>
                  <Send className="w-4 h-4 mr-2" />Submit Request
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