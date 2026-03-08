import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Percent, Search, RefreshCw, Edit, Plus, Monitor, Building2, ShieldAlert } from "lucide-react";

const ProfitSplitsManager = () => {
  const [showDialog, setShowDialog] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState<string>("");
  const [vendxPercentage, setVendxPercentage] = useState(70);
  const [editingSplit, setEditingSplit] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check if current user is admin
  const { data: isAdmin, isLoading: adminLoading } = useQuery({
    queryKey: ["is-admin-profit-splits"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin");
      return (data && data.length > 0) || false;
    },
  });

  // Fetch machines with their current profit splits
  const { data: machines, isLoading } = useQuery({
    queryKey: ["machines-with-splits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendx_machines")
        .select(`
          id, name, machine_code, machine_type, location_id, status,
          location:locations(id, name, city, country)
        `)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch profit splits
  const { data: profitSplits } = useQuery({
    queryKey: ["profit-splits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("machine_profit_splits")
        .select("*")
        .is("effective_to", null);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch locations for filter
  const { data: locations } = useQuery({
    queryKey: ["locations-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name, city, country")
        .eq("status", "active");
      if (error) throw error;
      return data || [];
    },
  });

  // Create/update profit split mutation
  const splitMutation = useMutation({
    mutationFn: async ({ machineId, vendxPct }: { machineId: string; vendxPct: number }) => {
      if (editingSplit) {
        await supabase
          .from("machine_profit_splits")
          .update({ effective_to: new Date().toISOString().split("T")[0] })
          .eq("id", editingSplit.id);
      } else {
        const { data: existingSplit } = await supabase
          .from("machine_profit_splits")
          .select("id")
          .eq("machine_id", machineId)
          .is("effective_to", null)
          .single();

        if (existingSplit) {
          await supabase
            .from("machine_profit_splits")
            .update({ effective_to: new Date().toISOString().split("T")[0] })
            .eq("id", existingSplit.id);
        }
      }

      const { error } = await supabase.from("machine_profit_splits").insert({
        machine_id: machineId,
        vendx_percentage: vendxPct,
        business_owner_percentage: 100 - vendxPct,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profit-splits"] });
      toast({ title: "Profit split saved" });
      setShowDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setSelectedMachine("");
    setVendxPercentage(70);
    setEditingSplit(null);
  };

  const openEditDialog = (machine: any, split: any) => {
    if (!isAdmin) return;
    setSelectedMachine(machine.id);
    setVendxPercentage(split?.vendx_percentage || 70);
    setEditingSplit(split);
    setShowDialog(true);
  };

  const openNewDialog = () => {
    if (!isAdmin) return;
    resetForm();
    setShowDialog(true);
  };

  const machinesWithSplits = useMemo(() => {
    if (!machines) return [];
    return machines.map(machine => {
      const split = profitSplits?.find(s => s.machine_id === machine.id);
      return { ...machine, split };
    });
  }, [machines, profitSplits]);

  const filteredMachines = useMemo(() => {
    return machinesWithSplits.filter(m => {
      const matchesSearch = 
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.machine_code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesLocation = locationFilter === "all" || m.location_id === locationFilter;
      return matchesSearch && matchesLocation;
    });
  }, [machinesWithSplits, searchTerm, locationFilter]);

  const stats = useMemo(() => {
    const configured = machinesWithSplits.filter(m => m.split).length;
    const unconfigured = machinesWithSplits.filter(m => !m.split).length;
    const avgVendxPct = profitSplits?.length 
      ? profitSplits.reduce((sum, s) => sum + Number(s.vendx_percentage), 0) / profitSplits.length 
      : 70;
    return { configured, unconfigured, avgVendxPct: avgVendxPct.toFixed(1) };
  }, [machinesWithSplits, profitSplits]);

  const unconfiguredMachines = useMemo(() => {
    return machines?.filter(m => !profitSplits?.find(s => s.machine_id === m.id)) || [];
  }, [machines, profitSplits]);

  if (isLoading || adminLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  // Non-admin view: read-only
  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-6 h-6 text-yellow-500" />
          <div>
            <h2 className="text-2xl font-bold">Profit Splits</h2>
            <p className="text-muted-foreground">Only administrators can modify profit splits. You can view the current configuration below.</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground">Configured</p><p className="text-2xl font-bold text-green-500">{stats.configured}</p></CardContent></Card>
          <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground">Not Configured</p><p className="text-2xl font-bold text-yellow-500">{stats.unconfigured}</p></CardContent></Card>
          <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground">Avg VendX Share</p><p className="text-2xl font-bold text-primary">{stats.avgVendxPct}%</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Machine Profit Splits ({filteredMachines.length})</CardTitle></CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Machine</TableHead>
                    <TableHead className="hidden sm:table-cell">Location</TableHead>
                    <TableHead>VendX Share</TableHead>
                    <TableHead>Owner Share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMachines.map((machine: any) => (
                    <TableRow key={machine.id}>
                      <TableCell>
                        <p className="font-medium">{machine.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{machine.machine_code}</p>
                      </TableCell>
                      <TableCell>{machine.location ? (machine.location.name || machine.location.city) : "Unassigned"}</TableCell>
                      <TableCell><span className="font-bold text-primary">{machine.split?.vendx_percentage || 70}%</span></TableCell>
                      <TableCell><span className="font-bold text-green-500">{machine.split?.business_owner_percentage || 30}%</span></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Percent className="w-6 h-6 text-primary" />
          Profit Splits Manager
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["profit-splits"] })}>
            <RefreshCw className="w-4 h-4 mr-2" />Refresh
          </Button>
          <Button onClick={openNewDialog} disabled={unconfiguredMachines.length === 0}>
            <Plus className="w-4 h-4 mr-2" />Configure Split
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground">Configured</p><p className="text-2xl font-bold text-green-500">{stats.configured}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground">Not Configured</p><p className="text-2xl font-bold text-yellow-500">{stats.unconfigured}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground">Avg VendX Share</p><p className="text-2xl font-bold text-primary">{stats.avgVendxPct}%</p></CardContent></Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search machines..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Location" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations?.map(loc => (
                  <SelectItem key={loc.id} value={loc.id}>{loc.name || `${loc.city}, ${loc.country}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Machines Table */}
      <Card>
        <CardHeader><CardTitle>Machine Profit Splits ({filteredMachines.length})</CardTitle></CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Machine</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>VendX Share</TableHead>
                  <TableHead>Owner Share</TableHead>
                  <TableHead>Effective From</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMachines.map((machine: any) => (
                  <TableRow key={machine.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{machine.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{machine.machine_code}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {machine.location ? (
                        <div className="flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-muted-foreground" />
                          <span className="text-sm">{machine.location.name || machine.location.city}</span>
                        </div>
                      ) : <span className="text-muted-foreground text-sm">Unassigned</span>}
                    </TableCell>
                    <TableCell><Badge variant="outline">{machine.machine_type}</Badge></TableCell>
                    <TableCell>
                      {machine.split ? <span className="font-bold text-primary">{machine.split.vendx_percentage}%</span> : <Badge variant="secondary">Default (70%)</Badge>}
                    </TableCell>
                    <TableCell>
                      {machine.split ? <span className="font-bold text-green-500">{machine.split.business_owner_percentage}%</span> : <span className="text-muted-foreground">30%</span>}
                    </TableCell>
                    <TableCell>
                      {machine.split ? <span className="text-sm">{new Date(machine.split.effective_from).toLocaleDateString()}</span> : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => openEditDialog(machine, machine.split)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Configure Split Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSplit ? "Edit Profit Split" : "Configure Profit Split"}</DialogTitle>
            <DialogDescription>Set the revenue sharing percentage between VendX and the business owner</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {!editingSplit && (
              <div className="space-y-2">
                <Label>Select Machine</Label>
                <Select value={selectedMachine} onValueChange={setSelectedMachine}>
                  <SelectTrigger><SelectValue placeholder="Choose a machine" /></SelectTrigger>
                  <SelectContent>
                    {unconfiguredMachines.map(machine => (
                      <SelectItem key={machine.id} value={machine.id}>{machine.name} ({machine.machine_code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span>VendX Global: <strong className="text-primary">{vendxPercentage}%</strong></span>
                <span>Business Owner: <strong className="text-green-500">{100 - vendxPercentage}%</strong></span>
              </div>
              <Slider value={[vendxPercentage]} onValueChange={(v) => setVendxPercentage(v[0])} min={0} max={100} step={5} />
              <div className="flex justify-between text-xs text-muted-foreground"><span>0%</span><span>50%</span><span>100%</span></div>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">Revenue Split Example ($1,000)</p>
              <div className="flex justify-between">
                <div><p className="text-xs text-muted-foreground">VendX Global</p><p className="font-bold text-primary">${((vendxPercentage / 100) * 1000).toFixed(0)}</p></div>
                <div className="text-right"><p className="text-xs text-muted-foreground">Business Owner</p><p className="font-bold text-green-500">${(((100 - vendxPercentage) / 100) * 1000).toFixed(0)}</p></div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button 
              onClick={() => splitMutation.mutate({ machineId: selectedMachine || editingSplit?.machine_id, vendxPct: vendxPercentage })}
              disabled={!selectedMachine && !editingSplit}
            >Save Split</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProfitSplitsManager;