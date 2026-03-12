import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, Cpu, Loader2 } from "lucide-react";

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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const tableName = entityType === "stand" ? "stand_machine_assignments" : "event_machine_assignments";
  const fkColumn = entityType === "stand" ? "stand_id" : "event_id";

  const { data: machines = [] } = useQuery({
    queryKey: ["all-machines-for-assignment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendx_machines")
        .select("id, name, machine_code, machine_type, status")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: assigned = [], isLoading } = useQuery({
    queryKey: [`${tableName}-assignments`, entityId],
    queryFn: async () => {
      let query;
      if (entityType === "stand") {
        query = supabase
          .from("stand_machine_assignments")
          .select("machine_id")
          .eq("stand_id", entityId);
      } else {
        query = supabase
          .from("event_machine_assignments")
          .select("machine_id")
          .eq("event_id", entityId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data as any[]).map((r) => r.machine_id as string);
    },
    enabled: open && !!entityId,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ machineId, assign }: { machineId: string; assign: boolean }) => {
      if (assign) {
        const { error } = await supabase
          .from(tableName)
          .insert({ [fkColumn]: entityId, machine_id: machineId } as any);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from(tableName)
          .delete()
          .eq(fkColumn, entityId)
          .eq("machine_id", machineId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${tableName}-assignments`, entityId] });
      queryClient.invalidateQueries({ queryKey: [tableName] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const filtered = machines.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.machine_code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign Machines — {entityName}</DialogTitle>
        </DialogHeader>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search machines..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          <div className="max-h-[50vh] overflow-y-auto space-y-1">
            {filtered.map((machine) => {
              const isAssigned = assigned.includes(machine.id);
              return (
                <label
                  key={machine.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    checked={isAssigned}
                    onCheckedChange={(checked) =>
                      toggleMutation.mutate({ machineId: machine.id, assign: !!checked })
                    }
                  />
                  <Cpu className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{machine.name}</p>
                    <p className="text-xs text-muted-foreground">{machine.machine_code}</p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {machine.machine_type}
                  </Badge>
                  <Badge
                    variant={machine.status === "active" ? "default" : "secondary"}
                    className="text-xs shrink-0"
                  >
                    {machine.status}
                  </Badge>
                </label>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-center text-muted-foreground py-6 text-sm">No machines found</p>
            )}
          </div>
        )}
        <div className="flex justify-between items-center pt-2 border-t">
          <p className="text-sm text-muted-foreground">
            {assigned.length} machine{assigned.length !== 1 ? "s" : ""} assigned
          </p>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
