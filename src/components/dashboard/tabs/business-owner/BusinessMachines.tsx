import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Monitor, ChevronRight, Building2 } from "lucide-react";
import { useBusinessOwnerData } from "./useBusinessOwnerData";
import { 
  MachineStatsCards, 
  MachineFilters, 
  MachineStatusBadge,
  MachineStatusIcon,
  filterMachines,
  getMachineTypeLabel,
  formatRevenue,
  BaseMachine
} from "@/components/machines";

const BusinessMachines = () => {
  const { machines, machineRevenue, profitSplits, assignments, isLoading } = useBusinessOwnerData();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedMachine, setSelectedMachine] = useState<any>(null);

  const machineTypes = useMemo(() => {
    if (!machines) return [];
    return [...new Set(machines.map(m => m.machine_type))].filter(Boolean);
  }, [machines]);

  const filteredMachines = useMemo(() => {
    if (!machines) return [];
    return filterMachines(machines as BaseMachine[], {
      searchTerm: searchQuery,
      status: statusFilter,
      type: typeFilter,
    });
  }, [machines, searchQuery, statusFilter, typeFilter]);

  const totals = useMemo(() => {
    if (!filteredMachines || !profitSplits) return { revenue: 0, share: 0, lifetime: 0 };
    
    let revenue = 0, share = 0, lifetime = 0;
    filteredMachines.forEach(machine => {
      const split = profitSplits.find(s => s.machine_id === machine.id);
      const ownerPercentage = split?.business_owner_percentage || 30;
      const rev = machineRevenue.get(machine.id);
      const periodRev = rev?.period || 0;
      revenue += periodRev;
      share += periodRev * (ownerPercentage / 100);
      lifetime += rev?.lifetime || 0;
    });
    return { revenue, share, lifetime };
  }, [filteredMachines, profitSplits, machineRevenue]);

  const getLocationName = (locationId: string) => {
    const assignment = assignments?.find(a => a.location_id === locationId);
    const loc = assignment?.location;
    return (loc as any)?.name || `${(loc as any)?.city}, ${(loc as any)?.country}` || "Unknown Location";
  };

  const getMachineRev = (machineId: string) => machineRevenue.get(machineId)?.period || 0;
  const getMachineLifetime = (machineId: string) => machineRevenue.get(machineId)?.lifetime || 0;

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
        <p className="text-muted-foreground">Live stats from all machines at your locations</p>
      </div>

      <MachineStatsCards 
        machines={(machines || []) as BaseMachine[]} 
        showRevenue={true}
        totalRevenue={totals.revenue}
        yourShare={totals.share}
        compact
      />

      <Card>
        <CardContent className="p-4">
          <MachineFilters
            searchTerm={searchQuery}
            onSearchChange={setSearchQuery}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            typeFilter={typeFilter}
            onTypeChange={setTypeFilter}
            availableTypes={machineTypes}
            showTypeFilter={true}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            Machines at Your Locations
          </CardTitle>
          <CardDescription>
            Showing {filteredMachines.length} of {machines?.length || 0} machines · Revenue from live transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!machines || machines.length === 0 ? (
            <div className="text-center py-12">
              <Monitor className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No machines at your locations</p>
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
                        <TableHead>30d Revenue</TableHead>
                        <TableHead>Your Share</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMachines.map((machine) => {
                        const split = profitSplits?.find(s => s.machine_id === machine.id);
                        const ownerPercentage = split?.business_owner_percentage || 30;
                        const revenue = getMachineRev(machine.id);
                        const share = revenue * (ownerPercentage / 100);
                        
                        return (
                          <TableRow key={machine.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedMachine(machine)}>
                            <TableCell>
                              <p className="font-medium">{machine.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{machine.machine_code}</p>
                            </TableCell>
                            <TableCell><p className="text-sm">{getLocationName(machine.location_id || "")}</p></TableCell>
                            <TableCell><Badge variant="outline">{getMachineTypeLabel(machine.machine_type)}</Badge></TableCell>
                            <TableCell><MachineStatusBadge status={machine.status} lastSeen={machine.last_seen} size="sm" /></TableCell>
                            <TableCell><span className="font-medium">{ownerPercentage}%</span></TableCell>
                            <TableCell>{formatRevenue(revenue)}</TableCell>
                            <TableCell className="font-bold text-green-500">{formatRevenue(share)}</TableCell>
                            <TableCell><ChevronRight className="w-4 h-4 text-muted-foreground" /></TableCell>
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
                  const revenue = getMachineRev(machine.id);
                  const share = revenue * (ownerPercentage / 100);
                  
                  return (
                    <Card key={machine.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setSelectedMachine(machine)}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <MachineStatusIcon status={machine.status} lastSeen={machine.last_seen} />
                            <div>
                              <p className="font-medium">{machine.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{machine.machine_code}</p>
                            </div>
                          </div>
                          <Badge variant="outline">{getMachineTypeLabel(machine.machine_type)}</Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                          <Building2 className="w-3 h-3" />
                          {getLocationName(machine.location_id || "")}
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="p-2 bg-muted/50 rounded">
                            <p className="text-sm font-bold">{ownerPercentage}%</p>
                            <p className="text-[10px] text-muted-foreground">Split</p>
                          </div>
                          <div className="p-2 bg-muted/50 rounded">
                            <p className="text-sm font-bold">{formatRevenue(revenue)}</p>
                            <p className="text-[10px] text-muted-foreground">Revenue</p>
                          </div>
                          <div className="p-2 bg-green-500/10 rounded">
                            <p className="text-sm font-bold text-green-500">{formatRevenue(share)}</p>
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
              <MachineStatusIcon status={selectedMachine?.status} lastSeen={selectedMachine?.last_seen} />
              {selectedMachine?.name}
            </DialogTitle>
            <DialogDescription className="font-mono">{selectedMachine?.machine_code}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Type</p>
                  <p className="font-medium">{getMachineTypeLabel(selectedMachine?.machine_type || "")}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <MachineStatusBadge status={selectedMachine?.status || ""} lastSeen={selectedMachine?.last_seen} />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground mb-1">Location</p>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <p className="font-medium">{selectedMachine && getLocationName(selectedMachine.location_id || "")}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium mb-3">Revenue Details (Live)</p>
                {(() => {
                  const split = profitSplits?.find(s => s.machine_id === selectedMachine?.id);
                  const ownerPercentage = split?.business_owner_percentage || 30;
                  const vendxPercentage = split?.vendx_percentage || 70;
                  const revenue = selectedMachine ? getMachineRev(selectedMachine.id) : 0;
                  const lifetime = selectedMachine ? getMachineLifetime(selectedMachine.id) : 0;
                  const share = revenue * (ownerPercentage / 100);

                  return (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-muted-foreground">Profit Split</span>
                        <span className="font-medium">You: {ownerPercentage}% / VendX: {vendxPercentage}%</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-muted-foreground">30-Day Revenue</span>
                        <span className="font-medium">{formatRevenue(revenue)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-muted-foreground">Your Share (30d)</span>
                        <span className="font-bold text-green-500">{formatRevenue(share)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-muted-foreground">Lifetime Revenue</span>
                        <span className="font-medium">{formatRevenue(lifetime)}</span>
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