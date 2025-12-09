import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Monitor, Plus, Key, RefreshCw, Copy, Eye, EyeOff, Wifi, WifiOff } from "lucide-react";

interface Machine {
  id: string;
  name: string;
  machine_code: string;
  machine_type: string;
  status: string;
  vendx_pay_enabled: boolean;
  api_key: string;
  last_seen: string | null;
  location_id: string | null;
  created_at: string;
}

interface Session {
  id: string;
  machine_id: string;
  session_code: string;
  session_type: string;
  status: string;
  created_at: string;
  expires_at: string;
  user_id: string | null;
}

const MachineRegistry = () => {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMachineDialog, setShowMachineDialog] = useState(false);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [machineForm, setMachineForm] = useState({
    name: "",
    machine_code: "",
    machine_type: "snack",
    vendx_pay_enabled: true,
  });
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: machinesData } = await supabase
        .from("vendx_machines")
        .select("*")
        .order("created_at", { ascending: false });

      setMachines(machinesData || []);

      const { data: sessionsData } = await supabase
        .from("machine_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      setSessions(sessionsData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const generateApiKey = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "vx_";
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleCreateMachine = async () => {
    try {
      const apiKey = generateApiKey();
      const { error } = await supabase
        .from("vendx_machines")
        .insert({
          name: machineForm.name,
          machine_code: machineForm.machine_code,
          machine_type: machineForm.machine_type,
          vendx_pay_enabled: machineForm.vendx_pay_enabled,
          api_key: apiKey,
        });

      if (error) throw error;

      toast({ title: "Machine registered successfully" });
      setShowMachineDialog(false);
      setMachineForm({
        name: "",
        machine_code: "",
        machine_type: "snack",
        vendx_pay_enabled: true,
      });
      fetchData();
    } catch (error) {
      console.error("Error creating machine:", error);
      toast({
        title: "Error",
        description: "Failed to register machine",
        variant: "destructive",
      });
    }
  };

  const handleRotateApiKey = async () => {
    if (!selectedMachine) return;

    try {
      const newApiKey = generateApiKey();
      const { error } = await supabase
        .from("vendx_machines")
        .update({ api_key: newApiKey })
        .eq("id", selectedMachine.id);

      if (error) throw error;

      toast({ title: "API key rotated successfully" });
      setSelectedMachine({ ...selectedMachine, api_key: newApiKey });
      fetchData();
    } catch (error) {
      console.error("Error rotating API key:", error);
      toast({
        title: "Error",
        description: "Failed to rotate API key",
        variant: "destructive",
      });
    }
  };

  const toggleMachineStatus = async (machine: Machine) => {
    const newStatus = machine.status === "active" ? "inactive" : "active";
    try {
      const { error } = await supabase
        .from("vendx_machines")
        .update({ status: newStatus })
        .eq("id", machine.id);

      if (error) throw error;
      toast({ title: `Machine ${newStatus}` });
      fetchData();
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const toggleVendxPay = async (machine: Machine) => {
    try {
      const { error } = await supabase
        .from("vendx_machines")
        .update({ vendx_pay_enabled: !machine.vendx_pay_enabled })
        .eq("id", machine.id);

      if (error) throw error;
      toast({ title: `VendX Pay ${machine.vendx_pay_enabled ? "disabled" : "enabled"}` });
      fetchData();
    } catch (error) {
      console.error("Error toggling VendX Pay:", error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const getOnlineStatus = (lastSeen: string | null) => {
    if (!lastSeen) return false;
    const diff = Date.now() - new Date(lastSeen).getTime();
    return diff < 5 * 60 * 1000; // 5 minutes
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Monitor className="w-6 h-6 text-primary" />
          Machine Registry
        </h2>
        <div className="flex gap-2">
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowMachineDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Register Machine
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Total Machines</p>
            <p className="text-2xl font-bold">{machines.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Active</p>
            <p className="text-2xl font-bold text-green-500">
              {machines.filter((m) => m.status === "active").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">VendX Pay Enabled</p>
            <p className="text-2xl font-bold text-accent">
              {machines.filter((m) => m.vendx_pay_enabled).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Online Now</p>
            <p className="text-2xl font-bold text-primary">
              {machines.filter((m) => getOnlineStatus(m.last_seen)).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Machines Table */}
      <Card>
        <CardHeader>
          <CardTitle>Registered Machines</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>VendX Pay</TableHead>
                <TableHead>Online</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {machines.map((machine) => {
                const isOnline = getOnlineStatus(machine.last_seen);
                return (
                  <TableRow key={machine.id}>
                    <TableCell className="font-medium">{machine.name}</TableCell>
                    <TableCell className="font-mono">{machine.machine_code}</TableCell>
                    <TableCell className="capitalize">{machine.machine_type}</TableCell>
                    <TableCell>
                      <Badge variant={machine.status === "active" ? "default" : "secondary"}>
                        {machine.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={machine.vendx_pay_enabled}
                        onCheckedChange={() => toggleVendxPay(machine)}
                      />
                    </TableCell>
                    <TableCell>
                      {isOnline ? (
                        <div className="flex items-center gap-2 text-green-500">
                          <Wifi className="w-4 h-4" />
                          <span className="text-xs">Online</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <WifiOff className="w-4 h-4" />
                          <span className="text-xs">Offline</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedMachine(machine);
                            setShowApiKeyDialog(true);
                          }}
                        >
                          <Key className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={machine.status === "active" ? "destructive" : "default"}
                          onClick={() => toggleMachineStatus(machine)}
                        >
                          {machine.status === "active" ? "Disable" : "Enable"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Machine</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Expires</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.slice(0, 10).map((session) => {
                const machine = machines.find((m) => m.id === session.machine_id);
                return (
                  <TableRow key={session.id}>
                    <TableCell className="font-medium">{machine?.name || "Unknown"}</TableCell>
                    <TableCell className="capitalize">{session.session_type}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          session.status === "verified"
                            ? "default"
                            : session.status === "expired"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {session.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(session.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(session.expires_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Machine Dialog */}
      <Dialog open={showMachineDialog} onOpenChange={setShowMachineDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register New Machine</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Machine Name</Label>
              <Input
                value={machineForm.name}
                onChange={(e) => setMachineForm({ ...machineForm, name: e.target.value })}
                placeholder="HQ Lobby Snack Machine"
              />
            </div>
            <div className="space-y-2">
              <Label>Machine Code</Label>
              <Input
                value={machineForm.machine_code}
                onChange={(e) => setMachineForm({ ...machineForm, machine_code: e.target.value })}
                placeholder="VX-001-A"
              />
            </div>
            <div className="space-y-2">
              <Label>Machine Type</Label>
              <Select
                value={machineForm.machine_type}
                onValueChange={(v) => setMachineForm({ ...machineForm, machine_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="snack">Snack</SelectItem>
                  <SelectItem value="beverage">Beverage</SelectItem>
                  <SelectItem value="combo">Combo</SelectItem>
                  <SelectItem value="fresh">Fresh Food</SelectItem>
                  <SelectItem value="digital">Digital Kiosk</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Enable VendX Pay</Label>
              <Switch
                checked={machineForm.vendx_pay_enabled}
                onCheckedChange={(v) => setMachineForm({ ...machineForm, vendx_pay_enabled: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMachineDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateMachine}>
              Register Machine
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* API Key Dialog */}
      <Dialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Machine API Key</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Machine</p>
              <p className="font-medium">{selectedMachine?.name}</p>
            </div>
            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="flex gap-2">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={selectedMachine?.api_key || ""}
                  readOnly
                  className="font-mono"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(selectedMachine?.api_key || "")}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Keep this key secure. It's used to authenticate the machine with VendX Pay.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApiKeyDialog(false)}>
              Close
            </Button>
            <Button variant="destructive" onClick={handleRotateApiKey}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Rotate Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MachineRegistry;
