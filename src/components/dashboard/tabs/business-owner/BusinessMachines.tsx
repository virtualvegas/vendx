import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  Monitor, Search, Filter, DollarSign, TrendingUp, Activity, 
  Wifi, WifiOff, Wrench, ChevronRight, Building2
} from "lucide-react";
import { useBusinessOwnerData } from "./useBusinessOwnerData";

const BusinessMachines = () => {
  const { machines, profitSplits, assignments, isLoading } = useBusinessOwnerData();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedMachine, setSelectedMachine] = useState<any>(null);

  // Get unique machine types
  const machineTypes = useMemo(() => {
    if (!machines) return [];
    const types = [...new Set(machines.map(m => m.machine_type))];
    return types.filter(Boolean);
  }, [machines]);

  // Filter machines
  const filteredMachines = useMemo(() => {
    if (!machines) return [];
    return machines.filter(machine => {
      const matchesSearch = 
        machine.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        machine.machine_code?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || machine.status === statusFilter;
      const matchesType = typeFilter === "all" || machine.machine_type === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [machines, searchQuery, statusFilter, typeFilter]);

  // Calculate totals
  const totals = useMemo(() => {
    if (!filteredMachines || !profitSplits) return { revenue: 0, share: 0, lifetime: 0 };
    
    let revenue = 0;
    let share = 0;
    let lifetime = 0;

    filteredMachines.forEach(machine => {
      const split = profitSplits.find(s => s.machine_id === machine.id);
      const ownerPercentage = split?.business_owner_percentage || 30;
      const machineRevenue = Number(machine.current_period_revenue || 0);
      
      revenue += machineRevenue;
      share += machineRevenue * (ownerPercentage / 100);
      lifetime += Number(machine.lifetime_revenue || 0);
    });

    return { revenue, share, lifetime };
  }, [filteredMachines, profitSplits]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active": return <Wifi className="w-4 h-4 text-green-500" />;
      case "offline": return <WifiOff className="w-4 h-4 text-red-500" />;
      case "maintenance": return <Wrench className="w-4 h-4 text-yellow-500" />;
      default: return <Activity className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getLocationName = (locationId: string) => {
    const assignment = assignments?.find(a => a.location_id === locationId);
    const loc = assignment?.location;
    return loc?.name || `${loc?.city}, ${loc?.country}` || "Unknown Location";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading machines...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">My Machines</h2>
        <p className="text-muted-foreground">View all machines at your locations</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Monitor className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{machines?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Total Machines</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Wifi className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-500">
                  {machines?.filter(m => m.status === "active").length || 0}
                </p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <DollarSign className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">${totals.revenue.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Period Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-500">${totals.share.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Your Share</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {machineTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Machines Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            Machines at Your Locations
          </CardTitle>
          <CardDescription>
            Showing {filteredMachines.length} of {machines?.length || 0} machines
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!machines || machines.length === 0 ? (
            <div className="text-center py-12">
              <Monitor className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No machines at your locations</p>
              <p className="text-sm text-muted-foreground mt-1">Machines will appear here once assigned</p>
            </div>
          ) : filteredMachines.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No machines match your filters</p>
              <Button variant="link" onClick={() => { setSearchQuery(""); setStatusFilter("all"); setTypeFilter("all"); }}>
                Clear filters
              </Button>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Machine</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Your Split</TableHead>
                        <TableHead>Period Revenue</TableHead>
                        <TableHead>Your Share</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMachines.map((machine) => {
                        const split = profitSplits?.find(s => s.machine_id === machine.id);
                        const ownerPercentage = split?.business_owner_percentage || 30;
                        const revenue = Number(machine.current_period_revenue || 0);
                        const share = revenue * (ownerPercentage / 100);
                        
                        return (
                          <TableRow 
                            key={machine.id} 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setSelectedMachine(machine)}
                          >
                            <TableCell>
                              <p className="font-medium">{machine.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{machine.machine_code}</p>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm">{getLocationName(machine.location_id)}</p>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{machine.machine_type}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getStatusIcon(machine.status)}
                                <span className="capitalize">{machine.status}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium">{ownerPercentage}%</span>
                            </TableCell>
                            <TableCell>${revenue.toLocaleString()}</TableCell>
                            <TableCell className="font-bold text-green-500">${share.toFixed(2)}</TableCell>
                            <TableCell>
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {filteredMachines.map((machine) => {
                  const split = profitSplits?.find(s => s.machine_id === machine.id);
                  const ownerPercentage = split?.business_owner_percentage || 30;
                  const revenue = Number(machine.current_period_revenue || 0);
                  const share = revenue * (ownerPercentage / 100);
                  
                  return (
                    <Card 
                      key={machine.id} 
                      className="cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => setSelectedMachine(machine)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(machine.status)}
                            <div>
                              <p className="font-medium">{machine.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{machine.machine_code}</p>
                            </div>
                          </div>
                          <Badge variant="outline">{machine.machine_type}</Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                          <Building2 className="w-3 h-3" />
                          {getLocationName(machine.location_id)}
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="p-2 bg-muted/50 rounded">
                            <p className="text-sm font-bold">{ownerPercentage}%</p>
                            <p className="text-[10px] text-muted-foreground">Split</p>
                          </div>
                          <div className="p-2 bg-muted/50 rounded">
                            <p className="text-sm font-bold">${revenue}</p>
                            <p className="text-[10px] text-muted-foreground">Revenue</p>
                          </div>
                          <div className="p-2 bg-green-500/10 rounded">
                            <p className="text-sm font-bold text-green-500">${share.toFixed(2)}</p>
                            <p className="text-[10px] text-muted-foreground">Share</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Machine Detail Dialog */}
      <Dialog open={!!selectedMachine} onOpenChange={() => setSelectedMachine(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {getStatusIcon(selectedMachine?.status)}
              {selectedMachine?.name}
            </DialogTitle>
            <DialogDescription className="font-mono">{selectedMachine?.machine_code}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Machine Info */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Type</p>
                  <p className="font-medium">{selectedMachine?.machine_type}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(selectedMachine?.status)}
                    <span className="font-medium capitalize">{selectedMachine?.status}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Location */}
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground mb-1">Location</p>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <p className="font-medium">{selectedMachine && getLocationName(selectedMachine.location_id)}</p>
                </div>
              </CardContent>
            </Card>

            {/* Revenue */}
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium mb-3">Revenue Details</p>
                {(() => {
                  const split = profitSplits?.find(s => s.machine_id === selectedMachine?.id);
                  const ownerPercentage = split?.business_owner_percentage || 30;
                  const vendxPercentage = split?.vendx_percentage || 70;
                  const revenue = Number(selectedMachine?.current_period_revenue || 0);
                  const lifetime = Number(selectedMachine?.lifetime_revenue || 0);
                  const share = revenue * (ownerPercentage / 100);

                  return (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-muted-foreground">Profit Split</span>
                        <span className="font-medium">You: {ownerPercentage}% / VendX: {vendxPercentage}%</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-muted-foreground">Period Revenue</span>
                        <span className="font-medium">${revenue.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-muted-foreground">Your Share (Period)</span>
                        <span className="font-bold text-green-500">${share.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-muted-foreground">Lifetime Revenue</span>
                        <span className="font-medium">${lifetime.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BusinessMachines;
