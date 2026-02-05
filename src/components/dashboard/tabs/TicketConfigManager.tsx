import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Ticket, Settings, Plus, Edit2, Trash2, Gamepad2 } from "lucide-react";

interface TicketConfig {
  id: string;
  machine_id: string;
  base_payout: number;
  max_payout: number;
  payout_multiplier: number;
  jackpot_enabled: boolean;
  jackpot_amount: number | null;
  jackpot_odds: number | null;
  cooldown_seconds: number | null;
  daily_limit_per_user: number | null;
  is_active: boolean;
  machine?: {
    id: string;
    name: string;
    machine_code: string;
    machine_type: string;
    location?: {
      name: string | null;
      city: string;
    } | null;
  };
}

interface Machine {
  id: string;
  name: string;
  machine_code: string;
  machine_type: string;
  location?: {
    name: string | null;
    city: string;
  } | null;
}

const TicketConfigManager = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<TicketConfig | null>(null);
  const [selectedMachine, setSelectedMachine] = useState<string>("");
  
  const [formData, setFormData] = useState({
    base_payout: 1,
    max_payout: 1000,
    payout_multiplier: 1.0,
    jackpot_enabled: false,
    jackpot_amount: 500,
    jackpot_odds: 0.001,
    cooldown_seconds: 0,
    daily_limit_per_user: null as number | null,
    is_active: true,
  });

  // Fetch ticket configs
  const { data: configs, isLoading } = useQuery({
    queryKey: ["ticket-configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("machine_ticket_config")
        .select(`
          *,
          machine:vendx_machines(id, name, machine_code, machine_type, location:locations(name, city))
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as TicketConfig[];
    },
  });

  // Fetch arcade machines without config
  const { data: availableMachines } = useQuery({
    queryKey: ["arcade-machines-without-config", configs],
    queryFn: async () => {
      const configuredIds = configs?.map(c => c.machine_id) || [];
      
      const { data, error } = await supabase
        .from("vendx_machines")
        .select("id, name, machine_code, machine_type, location:locations(name, city)")
        .in("machine_type", ["arcade", "claw"])
        .eq("status", "active");
      
      if (error) throw error;
      return (data as Machine[]).filter(m => !configuredIds.includes(m.id));
    },
    enabled: !!configs,
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<TicketConfig>) => {
      if (editingConfig) {
        const { error } = await supabase
          .from("machine_ticket_config")
          .update({
            base_payout: data.base_payout,
            max_payout: data.max_payout,
            payout_multiplier: data.payout_multiplier,
            jackpot_enabled: data.jackpot_enabled,
            jackpot_amount: data.jackpot_amount,
            jackpot_odds: data.jackpot_odds,
            cooldown_seconds: data.cooldown_seconds,
            daily_limit_per_user: data.daily_limit_per_user,
            is_active: data.is_active,
          })
          .eq("id", editingConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("machine_ticket_config")
          .insert({
            machine_id: selectedMachine,
            ...data,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-configs"] });
      queryClient.invalidateQueries({ queryKey: ["arcade-machines-without-config"] });
      toast.success(editingConfig ? "Configuration updated" : "Configuration created");
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("machine_ticket_config")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-configs"] });
      queryClient.invalidateQueries({ queryKey: ["arcade-machines-without-config"] });
      toast.success("Configuration deleted");
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingConfig(null);
    setSelectedMachine("");
    setFormData({
      base_payout: 1,
      max_payout: 1000,
      payout_multiplier: 1.0,
      jackpot_enabled: false,
      jackpot_amount: 500,
      jackpot_odds: 0.001,
      cooldown_seconds: 0,
      daily_limit_per_user: null,
      is_active: true,
    });
  };

  const handleEdit = (config: TicketConfig) => {
    setEditingConfig(config);
    setFormData({
      base_payout: config.base_payout,
      max_payout: config.max_payout,
      payout_multiplier: config.payout_multiplier,
      jackpot_enabled: config.jackpot_enabled,
      jackpot_amount: config.jackpot_amount || 500,
      jackpot_odds: config.jackpot_odds || 0.001,
      cooldown_seconds: config.cooldown_seconds || 0,
      daily_limit_per_user: config.daily_limit_per_user,
      is_active: config.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!editingConfig && !selectedMachine) {
      toast.error("Please select a machine");
      return;
    }
    saveMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Ticket className="h-6 w-6 text-primary" />
            Virtual Ticket Configuration
          </h2>
          <p className="text-muted-foreground">
            Configure ticket payouts for arcade and claw machines
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingConfig(null)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Configuration
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingConfig ? "Edit Ticket Configuration" : "New Ticket Configuration"}
              </DialogTitle>
              <DialogDescription>
                Configure how tickets are awarded from this machine
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              {!editingConfig && (
                <div className="space-y-2">
                  <Label>Select Machine</Label>
                  <Select value={selectedMachine} onValueChange={setSelectedMachine}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a machine..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableMachines?.map((machine) => (
                        <SelectItem key={machine.id} value={machine.id}>
                          {machine.name} ({machine.machine_code})
                          {machine.location && ` - ${machine.location.name || machine.location.city}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Base Payout</Label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.base_payout}
                    onChange={(e) => setFormData({ ...formData, base_payout: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Payout</Label>
                  <Input
                    type="number"
                    min={formData.base_payout}
                    value={formData.max_payout}
                    onChange={(e) => setFormData({ ...formData, max_payout: parseInt(e.target.value) || 1000 })}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Payout Multiplier</Label>
                <Input
                  type="number"
                  step="0.1"
                  min={0}
                  value={formData.payout_multiplier}
                  onChange={(e) => setFormData({ ...formData, payout_multiplier: parseFloat(e.target.value) || 1 })}
                />
                <p className="text-xs text-muted-foreground">
                  Multiplies the raw ticket amount from the machine
                </p>
              </div>

              <div className="space-y-2">
                <Label>Daily Limit Per User (optional)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="No limit"
                  value={formData.daily_limit_per_user ?? ""}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    daily_limit_per_user: e.target.value ? parseInt(e.target.value) : null 
                  })}
                />
              </div>

              <div className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <Label>Jackpot Enabled</Label>
                  <p className="text-xs text-muted-foreground">Random bonus tickets</p>
                </div>
                <Switch
                  checked={formData.jackpot_enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, jackpot_enabled: checked })}
                />
              </div>

              {formData.jackpot_enabled && (
                <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-primary/20">
                  <div className="space-y-2">
                    <Label>Jackpot Amount</Label>
                    <Input
                      type="number"
                      min={1}
                      value={formData.jackpot_amount}
                      onChange={(e) => setFormData({ ...formData, jackpot_amount: parseInt(e.target.value) || 500 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Jackpot Odds</Label>
                    <Input
                      type="number"
                      step="0.001"
                      min={0}
                      max={1}
                      value={formData.jackpot_odds}
                      onChange={(e) => setFormData({ ...formData, jackpot_odds: parseFloat(e.target.value) || 0.001 })}
                    />
                    <p className="text-xs text-muted-foreground">
                      {((formData.jackpot_odds || 0) * 100).toFixed(2)}% chance
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <Label>Active</Label>
                  <p className="text-xs text-muted-foreground">Enable ticket payouts</p>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : "Save Configuration"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Machine Configurations
          </CardTitle>
          <CardDescription>
            Manage ticket payout settings for each arcade machine
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : configs?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Gamepad2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No ticket configurations yet</p>
              <p className="text-sm">Add a configuration to start awarding virtual tickets</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Machine</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-center">Base/Max</TableHead>
                  <TableHead className="text-center">Multiplier</TableHead>
                  <TableHead className="text-center">Jackpot</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs?.map((config) => (
                  <TableRow key={config.id}>
                    <TableCell>
                      <div className="font-medium">{config.machine?.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {config.machine?.machine_code}
                      </div>
                    </TableCell>
                    <TableCell>
                      {config.machine?.location?.name || config.machine?.location?.city || "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {config.base_payout} / {config.max_payout}
                    </TableCell>
                    <TableCell className="text-center">
                      {config.payout_multiplier}x
                    </TableCell>
                    <TableCell className="text-center">
                      {config.jackpot_enabled ? (
                        <Badge variant="secondary">
                          {config.jackpot_amount} @ {((config.jackpot_odds || 0) * 100).toFixed(2)}%
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">Off</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={config.is_active ? "default" : "outline"}>
                        {config.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(config)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(config.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TicketConfigManager;
