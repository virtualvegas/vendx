import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  DollarSign, MapPin, Monitor, TrendingUp, Wallet, 
  Calendar, Download, Building2, Headphones, Wrench,
  AlertCircle, Clock, CheckCircle2, Phone, Mail, Plus,
  BarChart3, Package, Activity, FileText
} from "lucide-react";

// Contact info
const VENDX_PHONE = "(781) 214-1806";
const VENDX_PHONE_TEL = "tel:+17812141806";
const VENDX_EMAIL = "partners@vendx.space";

interface SupportRequest {
  id: string;
  location_id: string | null;
  machine_id: string | null;
  request_type: string;
  priority: string;
  subject: string;
  description: string;
  status: string;
  resolution: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

const BusinessOwnerDashboard = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [supportDialogOpen, setSupportDialogOpen] = useState(false);
  const [supportFormData, setSupportFormData] = useState({
    location_id: "",
    machine_id: "",
    request_type: "support",
    priority: "medium",
    subject: "",
    description: ""
  });

  // Fetch current user
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Fetch assigned locations
  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ["business-owner-assignments"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("location_assignments")
        .select(`
          id, location_id, is_active,
          location:locations(id, name, city, country, address, status, machine_count, location_type)
        `)
        .eq("business_owner_id", user.id)
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch machines at assigned locations
  const { data: machines } = useQuery({
    queryKey: ["business-owner-machines", assignments],
    queryFn: async () => {
      if (!assignments || assignments.length === 0) return [];
      
      const locationIds = assignments.map(a => a.location_id);
      const { data, error } = await supabase
        .from("vendx_machines")
        .select("id, name, machine_code, machine_type, status, location_id, current_period_revenue, lifetime_revenue")
        .in("location_id", locationIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!assignments && assignments.length > 0,
  });

  // Fetch profit splits for machines
  const { data: profitSplits } = useQuery({
    queryKey: ["business-owner-profit-splits", machines],
    queryFn: async () => {
      if (!machines || machines.length === 0) return [];
      
      const machineIds = machines.map(m => m.id);
      const { data, error } = await supabase
        .from("machine_profit_splits")
        .select("*")
        .in("machine_id", machineIds)
        .is("effective_to", null);
      if (error) throw error;
      return data || [];
    },
    enabled: !!machines && machines.length > 0,
  });

  // Fetch payouts
  const { data: payouts } = useQuery({
    queryKey: ["business-owner-payouts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payouts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch payout settings
  const { data: payoutSettings } = useQuery({
    queryKey: ["business-owner-payout-settings"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data, error } = await supabase
        .from("payout_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
  });

  // Fetch support requests
  const { data: supportRequests } = useQuery({
    queryKey: ["business-owner-support-requests"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("partner_support_requests")
        .select("*")
        .eq("business_owner_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SupportRequest[];
    },
  });

  // Create support request mutation
  const createSupportMutation = useMutation({
    mutationFn: async (formData: typeof supportFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      const { error } = await supabase
        .from("partner_support_requests")
        .insert({
          business_owner_id: user.id,
          location_id: formData.location_id || null,
          machine_id: formData.machine_id || null,
          request_type: formData.request_type,
          priority: formData.priority,
          subject: formData.subject,
          description: formData.description,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-owner-support-requests"] });
      setSupportDialogOpen(false);
      setSupportFormData({
        location_id: "",
        machine_id: "",
        request_type: "support",
        priority: "medium",
        subject: "",
        description: ""
      });
      toast({ title: "Request Submitted", description: "Our team will respond shortly." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Calculate earnings summary
  const earnings = useMemo(() => {
    if (!machines || !profitSplits) return { grossRevenue: 0, myShare: 0, pending: 0, lifetimeRevenue: 0 };

    let grossRevenue = 0;
    let myShare = 0;
    let lifetimeRevenue = 0;

    machines.forEach(machine => {
      const split = profitSplits.find(s => s.machine_id === machine.id);
      const ownerPercentage = split?.business_owner_percentage || 30;
      const machineRevenue = Number(machine.current_period_revenue || 0);
      const machineLifetime = Number(machine.lifetime_revenue || 0);
      
      grossRevenue += machineRevenue;
      myShare += machineRevenue * (ownerPercentage / 100);
      lifetimeRevenue += machineLifetime;
    });

    const pending = payouts
      ?.filter(p => p.status === "pending")
      .reduce((sum, p) => sum + Number(p.amount), 0) || 0;

    return { grossRevenue, myShare, pending, lifetimeRevenue };
  }, [machines, profitSplits, payouts]);

  // Calculate machine stats
  const machineStats = useMemo(() => {
    if (!machines) return { total: 0, active: 0, offline: 0, maintenance: 0 };
    return {
      total: machines.length,
      active: machines.filter(m => m.status === "active").length,
      offline: machines.filter(m => m.status === "offline").length,
      maintenance: machines.filter(m => m.status === "maintenance").length,
    };
  }, [machines]);

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case "bank_transfer": return "Bank Transfer";
      case "stripe_connect": return "Stripe Connect";
      case "check": return "Check";
      default: return method;
    }
  };

  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case "weekly": return "Weekly";
      case "bi_weekly": return "Bi-Weekly";
      case "monthly": return "Monthly";
      default: return freq;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "open": return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case "in_progress": return <Clock className="w-4 h-4 text-blue-500" />;
      case "resolved": return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "closed": return <CheckCircle2 className="w-4 h-4 text-muted-foreground" />;
      default: return null;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "destructive";
      case "high": return "destructive";
      case "medium": return "secondary";
      case "low": return "outline";
      default: return "secondary";
    }
  };

  const handleSupportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportFormData.subject || !supportFormData.description) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    createSupportMutation.mutate(supportFormData);
  };

  // Get machines for selected location in support form
  const filteredMachinesForForm = useMemo(() => {
    if (!supportFormData.location_id || !machines) return [];
    return machines.filter(m => m.location_id === supportFormData.location_id);
  }, [supportFormData.location_id, machines]);

  if (assignmentsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold text-foreground mb-1">Partner Dashboard</h2>
          <p className="text-muted-foreground">View performance and manage your locations</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={supportDialogOpen} onOpenChange={setSupportDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Request Support
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Submit Support Request</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSupportSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Request Type *</Label>
                    <Select 
                      value={supportFormData.request_type} 
                      onValueChange={(v) => setSupportFormData({...supportFormData, request_type: v})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="support">General Support</SelectItem>
                        <SelectItem value="service">Machine Service</SelectItem>
                        <SelectItem value="billing">Billing Question</SelectItem>
                        <SelectItem value="emergency">Emergency</SelectItem>
                        <SelectItem value="general">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select 
                      value={supportFormData.priority} 
                      onValueChange={(v) => setSupportFormData({...supportFormData, priority: v})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Location (Optional)</Label>
                    <Select 
                      value={supportFormData.location_id} 
                      onValueChange={(v) => setSupportFormData({...supportFormData, location_id: v, machine_id: ""})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Locations</SelectItem>
                        {assignments?.map((a: any) => (
                          <SelectItem key={a.location_id} value={a.location_id}>
                            {a.location?.name || `${a.location?.city}, ${a.location?.country}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Machine (Optional)</Label>
                    <Select 
                      value={supportFormData.machine_id} 
                      onValueChange={(v) => setSupportFormData({...supportFormData, machine_id: v})}
                      disabled={!supportFormData.location_id}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select machine" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Machines</SelectItem>
                        {filteredMachinesForForm.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name} ({m.machine_code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Subject *</Label>
                  <Input 
                    value={supportFormData.subject}
                    onChange={(e) => setSupportFormData({...supportFormData, subject: e.target.value})}
                    placeholder="Brief description of your request"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description *</Label>
                  <Textarea 
                    value={supportFormData.description}
                    onChange={(e) => setSupportFormData({...supportFormData, description: e.target.value})}
                    placeholder="Provide details about your request..."
                    rows={4}
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setSupportDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createSupportMutation.isPending}>
                    {createSupportMutation.isPending ? "Submitting..." : "Submit Request"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Button variant="outline" asChild>
            <a href={VENDX_PHONE_TEL}>
              <Phone className="w-4 h-4 mr-2" />
              Call Support
            </a>
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs lg:text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Your Share (Period)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl lg:text-3xl font-bold text-green-500">${earnings.myShare.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">From ${earnings.grossRevenue.toLocaleString()} gross</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs lg:text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Pending Payout
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl lg:text-3xl font-bold text-yellow-500">${earnings.pending.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs lg:text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Locations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl lg:text-3xl font-bold">{assignments?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs lg:text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Monitor className="w-4 h-4" />
              Machines
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl lg:text-3xl font-bold">{machineStats.total}</p>
            <div className="flex gap-2 mt-1 text-xs">
              <span className="text-green-500">{machineStats.active} active</span>
              {machineStats.offline > 0 && <span className="text-red-500">{machineStats.offline} offline</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="text-xs lg:text-sm">Overview</TabsTrigger>
          <TabsTrigger value="locations" className="text-xs lg:text-sm">Locations</TabsTrigger>
          <TabsTrigger value="machines" className="text-xs lg:text-sm">Machines</TabsTrigger>
          <TabsTrigger value="support" className="text-xs lg:text-sm">Support</TabsTrigger>
          <TabsTrigger value="payouts" className="text-xs lg:text-sm">Payouts</TabsTrigger>
          <TabsTrigger value="settings" className="text-xs lg:text-sm">Settings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Performance Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="w-5 h-5" />
                  Performance Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Lifetime Revenue</span>
                  <span className="font-bold">${earnings.lifetimeRevenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Current Period Revenue</span>
                  <span className="font-bold text-green-500">${earnings.grossRevenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Your Earnings (Period)</span>
                  <span className="font-bold text-primary">${earnings.myShare.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">Total Paid Out</span>
                  <span className="font-bold">
                    ${payouts?.filter(p => p.status === "paid").reduce((s, p) => s + Number(p.amount), 0).toLocaleString() || 0}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Machine Status Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Activity className="w-5 h-5" />
                  Machine Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-green-500/10 rounded-lg">
                    <p className="text-3xl font-bold text-green-500">{machineStats.active}</p>
                    <p className="text-sm text-muted-foreground">Active</p>
                  </div>
                  <div className="text-center p-4 bg-red-500/10 rounded-lg">
                    <p className="text-3xl font-bold text-red-500">{machineStats.offline}</p>
                    <p className="text-sm text-muted-foreground">Offline</p>
                  </div>
                  <div className="text-center p-4 bg-yellow-500/10 rounded-lg">
                    <p className="text-3xl font-bold text-yellow-500">{machineStats.maintenance}</p>
                    <p className="text-sm text-muted-foreground">Maintenance</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-3xl font-bold">{machineStats.total}</p>
                    <p className="text-sm text-muted-foreground">Total</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Support Requests */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Headphones className="w-5 h-5" />
                  Recent Support Requests
                </CardTitle>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSupportDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New Request
              </Button>
            </CardHeader>
            <CardContent>
              {!supportRequests || supportRequests.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No support requests yet</p>
              ) : (
                <div className="space-y-3">
                  {supportRequests.slice(0, 5).map((request) => (
                    <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(request.status)}
                        <div>
                          <p className="font-medium text-sm">{request.subject}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(request.created_at).toLocaleDateString()} · {request.request_type}
                          </p>
                        </div>
                      </div>
                      <Badge variant={getPriorityColor(request.priority) as any}>{request.priority}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contact Card */}
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <h3 className="font-bold text-lg">Need Help?</h3>
                  <p className="text-muted-foreground">Our partner support team is here to help 24/7</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button asChild>
                    <a href={VENDX_PHONE_TEL}>
                      <Phone className="w-4 h-4 mr-2" />
                      {VENDX_PHONE}
                    </a>
                  </Button>
                  <Button variant="outline" asChild>
                    <a href={`mailto:${VENDX_EMAIL}`}>
                      <Mail className="w-4 h-4 mr-2" />
                      Email Us
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Locations Tab */}
        <TabsContent value="locations">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Your Locations
              </CardTitle>
              <CardDescription>Locations assigned to your partnership</CardDescription>
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
        </TabsContent>

        {/* Machines Tab */}
        <TabsContent value="machines">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="w-5 h-5" />
                Machines at Your Locations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Machine</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Your Split</TableHead>
                      <TableHead>Period Revenue</TableHead>
                      <TableHead>Your Share</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {machines?.map((machine) => {
                      const split = profitSplits?.find(s => s.machine_id === machine.id);
                      const ownerPercentage = split?.business_owner_percentage || 30;
                      const revenue = Number(machine.current_period_revenue || 0);
                      const share = revenue * (ownerPercentage / 100);
                      
                      return (
                        <TableRow key={machine.id}>
                          <TableCell>
                            <p className="font-medium">{machine.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{machine.machine_code}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{machine.machine_type}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={machine.status === "active" ? "default" : machine.status === "offline" ? "destructive" : "secondary"}>
                              {machine.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{ownerPercentage}%</span>
                          </TableCell>
                          <TableCell>${revenue.toLocaleString()}</TableCell>
                          <TableCell className="font-bold text-green-500">${share.toLocaleString()}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Support Tab */}
        <TabsContent value="support" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Headphones className="w-5 h-5" />
                  Support Requests
                </CardTitle>
                <CardDescription>Track your service and support requests</CardDescription>
              </div>
              <Button onClick={() => setSupportDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New Request
              </Button>
            </CardHeader>
            <CardContent>
              {!supportRequests || supportRequests.length === 0 ? (
                <div className="text-center py-8">
                  <Headphones className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No support requests yet</p>
                  <Button onClick={() => setSupportDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Request
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supportRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(request.status)}
                              <span className="capitalize">{request.status.replace("_", " ")}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium">{request.subject}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">{request.description}</p>
                          </TableCell>
                          <TableCell className="capitalize">{request.request_type}</TableCell>
                          <TableCell>
                            <Badge variant={getPriorityColor(request.priority) as any} className="capitalize">
                              {request.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>{new Date(request.created_at).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payouts Tab */}
        <TabsContent value="payouts">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Payout History
              </CardTitle>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Gross Revenue</TableHead>
                      <TableHead>VendX Share</TableHead>
                      <TableHead>Your Payout</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Paid Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payouts?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No payouts yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      payouts?.map((payout) => (
                        <TableRow key={payout.id}>
                          <TableCell>
                            <p className="font-medium">
                              {new Date(payout.period_start).toLocaleDateString()} - {new Date(payout.period_end).toLocaleDateString()}
                            </p>
                          </TableCell>
                          <TableCell>${Number(payout.gross_revenue).toLocaleString()}</TableCell>
                          <TableCell>${Number(payout.vendx_share).toLocaleString()}</TableCell>
                          <TableCell className="font-bold text-green-500">
                            ${Number(payout.amount).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              payout.status === "paid" ? "default" :
                              payout.status === "pending" ? "secondary" :
                              payout.status === "processing" ? "outline" : "destructive"
                            }>
                              {payout.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {payout.paid_at ? new Date(payout.paid_at).toLocaleDateString() : "-"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                Payout Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!payoutSettings ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No payout settings configured</p>
                  <p className="text-sm text-muted-foreground mb-6">Contact VendX to set up your payout preferences</p>
                  <div className="flex justify-center gap-3">
                    <Button asChild>
                      <a href={VENDX_PHONE_TEL}>
                        <Phone className="w-4 h-4 mr-2" />
                        Call Us
                      </a>
                    </Button>
                    <Button variant="outline" asChild>
                      <a href={`mailto:${VENDX_EMAIL}`}>
                        <Mail className="w-4 h-4 mr-2" />
                        Email Us
                      </a>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Payment Method</p>
                      <p className="font-medium text-lg">{getPaymentMethodLabel(payoutSettings.payment_method)}</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Payout Frequency</p>
                      <p className="font-medium text-lg">{getFrequencyLabel(payoutSettings.payout_frequency)}</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Minimum Payout Amount</p>
                      <p className="font-medium text-lg">${Number(payoutSettings.minimum_payout_amount).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {payoutSettings.payment_method === "bank_transfer" && payoutSettings.bank_name && (
                      <>
                        <div className="p-4 border rounded-lg">
                          <p className="text-sm text-muted-foreground">Bank</p>
                          <p className="font-medium text-lg">{payoutSettings.bank_name}</p>
                        </div>
                        {payoutSettings.bank_account_last4 && (
                          <div className="p-4 border rounded-lg">
                            <p className="text-sm text-muted-foreground">Account</p>
                            <p className="font-medium text-lg">****{payoutSettings.bank_account_last4}</p>
                          </div>
                        )}
                      </>
                    )}
                    {payoutSettings.payment_method === "stripe_connect" && payoutSettings.stripe_account_id && (
                      <div className="p-4 border rounded-lg">
                        <p className="text-sm text-muted-foreground">Stripe Account</p>
                        <p className="font-medium text-lg">Connected ✓</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Documents Section */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Partner Resources
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <Button variant="outline" className="h-auto p-4 justify-start" asChild>
                  <a href="/business">
                    <div className="text-left">
                      <p className="font-medium">Partner Agreement</p>
                      <p className="text-xs text-muted-foreground">View partnership terms</p>
                    </div>
                  </a>
                </Button>
                <Button variant="outline" className="h-auto p-4 justify-start" asChild>
                  <a href="/contact">
                    <div className="text-left">
                      <p className="font-medium">Contact Support</p>
                      <p className="text-xs text-muted-foreground">Get help from our team</p>
                    </div>
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BusinessOwnerDashboard;
