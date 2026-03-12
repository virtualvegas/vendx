import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Search, Cpu, Loader2, MapPin, Store, Calendar } from "lucide-react";
import { MachineStatusBadge } from "@/components/machines/MachineStatusBadge";
import { MACHINE_TYPES } from "@/lib/machineUtils";

interface MachineAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: "stand" | "event";
  entityId: string;
  entityName: string;
}

export const MachineAssignmentDialog = ({
  open,
  onOpenChange,
  entityType,
  entityId,
  entityName,
}: MachineAssignmentDialogProps) => {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const tableName = entityType === "stand" ? "stand_machine_assignments" : "event_machine_assignments";

  // Fetch all machines from registry with location
  const { data: machines = [] } = useQuery({
    queryKey: ["registry-machines-for-assignment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendx_machines")
        .select("id, name, machine_code, machine_type, status, connection_status, last_seen, location_id")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch locations for display
  const { data: locations = [] } = useQuery({
    queryKey: ["locations-for-assignment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name, city, country");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch all stand assignments to show deployment info
  const { data: allStandAssignments = [] } = useQuery({
    queryKey: ["all-stand-machine-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stand_machine_assignments")
        .select("machine_id, stand_id, stands(name)");
      if (error) throw error;
      return data as any[];
    },
    enabled: open,
  });

  // Fetch all event assignments to show deployment info
  const { data: allEventAssignments = [] } = useQuery({
    queryKey: ["all-event-machine-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_machine_assignments")
        .select("machine_id, event_id, events(name)");
      if (error) throw error;
      return data as any[];
    },
    enabled: open,
  });

  // Current entity assignments
  const { data: assigned = [], isLoading } = useQuery({
    queryKey: [`${tableName}-assignments`, entityId],
    queryFn: async () => {
      if (entityType === "stand") {
        const { data, error } = await supabase
          .from("stand_machine_assignments")
          .select("machine_id")
          .eq("stand_id", entityId);
        if (error) throw error;
        return (data as any[]).map((r) => r.machine_id as string);
      } else {
        const { data, error } = await supabase
          .from("event_machine_assignments")
          .select("machine_id")
          .eq("event_id", entityId);
        if (error) throw error;
        return (data as any[]).map((r) => r.machine_id as string);
      }
    },
    enabled: open && !!entityId,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ machineId, assign }: { machineId: string; assign: boolean }) => {
      if (entityType === "stand") {
        if (assign) {
          const { error } = await supabase
            .from("stand_machine_assignments")
            .insert({ stand_id: entityId, machine_id: machineId });
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("stand_machine_assignments")
            .delete()
            .eq("stand_id", entityId)
            .eq("machine_id", machineId);
          if (error) throw error;
        }
      } else {
        if (assign) {
          const { error } = await supabase
            .from("event_machine_assignments")
            .insert({ event_id: entityId, machine_id: machineId });
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("event_machine_assignments")
            .delete()
            .eq("event_id", entityId)
            .eq("machine_id", machineId);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${tableName}-assignments`, entityId] });
      queryClient.invalidateQueries({ queryKey: ["all-stand-machine-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["all-event-machine-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["event-machine-assignment-counts"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Build lookup maps
  const locationMap = useMemo(() => {
    const map: Record<string, string> = {};
    locations.forEach((l) => {
      map[l.id] = l.name || `${l.city}, ${l.country}`;
    });
    return map;
  }, [locations]);

  const deploymentMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    allStandAssignments.forEach((a) => {
      if (!map[a.machine_id]) map[a.machine_id] = [];
      // Don't show current entity
      if (entityType === "stand" && a.stand_id === entityId) return;
      map[a.machine_id].push(`Stand: ${a.stands?.name || "Unknown"}`);
    });
    allEventAssignments.forEach((a) => {
      if (!map[a.machine_id]) map[a.machine_id] = [];
      if (entityType === "event" && a.event_id === entityId) return;
      map[a.machine_id].push(`Rental: ${a.events?.name || "Unknown"}`);
    });
    return map;
  }, [allStandAssignments, allEventAssignments, entityId, entityType]);

  const filtered = useMemo(() => {
    return machines.filter((m) => {
      const matchesSearch =
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.machine_code.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === "all" || m.machine_type === typeFilter;
      const matchesStatus = statusFilter === "all" || m.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [machines, search, typeFilter, statusFilter]);

  // Sort: assigned first, then by name
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aAssigned = assigned.includes(a.id) ? 0 : 1;
      const bAssigned = assigned.includes(b.id) ? 0 : 1;
      if (aAssigned !== bAssigned) return aAssigned - bAssigned;
      return a.name.localeCompare(b.name);
    });
  }, [filtered, assigned]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {entityType === "stand" ? <Store className="w-5 h-5" /> : <Calendar className="w-5 h-5" />}
            Assign Machines — {entityName}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Select machines from the registry to deploy to this {entityType === "stand" ? "stand" : "private event rental"}
          </p>
        </DialogHeader>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {MACHINE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Machine List */}
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          <div className="max-h-[50vh] overflow-y-auto space-y-1 border rounded-lg p-1">
            {sorted.map((machine) => {
              const isAssigned = assigned.includes(machine.id);
              const locationName = machine.location_id ? locationMap[machine.location_id] : null;
              const otherDeployments = deploymentMap[machine.id] || [];

              return (
                <label
                  key={machine.id}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    isAssigned
                      ? "bg-primary/5 border border-primary/20"
                      : "hover:bg-muted/50 border border-transparent"
                  }`}
                >
                  <Checkbox
                    checked={isAssigned}
                    onCheckedChange={(checked) =>
                      toggleMutation.mutate({ machineId: machine.id, assign: !!checked })
                    }
                    className="mt-0.5"
                  />
                  <Cpu className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{machine.name}</p>
                      <span className="text-xs text-muted-foreground font-mono">{machine.machine_code}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {locationName && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {locationName}
                        </span>
                      )}
                      {otherDeployments.length > 0 && (
                        <span className="text-xs text-amber-500 flex items-center gap-1">
                          ⚠ Also at: {otherDeployments.join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0 items-center">
                    <Badge variant="outline" className="text-xs capitalize">
                      {machine.machine_type}
                    </Badge>
                    <MachineStatusBadge
                      status={machine.status}
                      lastSeen={machine.last_seen}
                      onlineCheckMode="status-only"
                      size="sm"
                    />
                  </div>
                </label>
              );
            })}
            {sorted.length === 0 && (
              <p className="text-center text-muted-foreground py-8 text-sm">
                No machines found matching your filters
              </p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center pt-2 border-t">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{assigned.length}</span> machine{assigned.length !== 1 ? "s" : ""} assigned
            {filtered.length !== machines.length && (
              <span className="ml-2">· Showing {filtered.length} of {machines.length}</span>
            )}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
