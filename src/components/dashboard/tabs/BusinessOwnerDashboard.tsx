import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DollarSign, MapPin, Monitor, TrendingUp, Wallet, 
  Calendar, Download, Building2 
} from "lucide-react";

const BusinessOwnerDashboard = () => {
  // Fetch assigned locations
  const { data: assignments } = useQuery({
    queryKey: ["business-owner-assignments"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("location_assignments")
        .select(`
          id, location_id, is_active,
          location:locations(id, name, city, country, address, status, machine_count)
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

  // Calculate earnings summary
  const earnings = useMemo(() => {
    if (!machines || !profitSplits) return { grossRevenue: 0, myShare: 0, pending: 0 };

    let grossRevenue = 0;
    let myShare = 0;

    machines.forEach(machine => {
      const split = profitSplits.find(s => s.machine_id === machine.id);
      const ownerPercentage = split?.business_owner_percentage || 30;
      const machineRevenue = Number(machine.current_period_revenue || 0);
      
      grossRevenue += machineRevenue;
      myShare += machineRevenue * (ownerPercentage / 100);
    });

    const pending = payouts
      ?.filter(p => p.status === "pending")
      .reduce((sum, p) => sum + Number(p.amount), 0) || 0;

    return { grossRevenue, myShare, pending };
  }, [machines, profitSplits, payouts]);

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Business Owner Dashboard</h2>
        <p className="text-muted-foreground">View performance and earnings for your locations</p>
      </div>

      {/* Earnings Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Gross Revenue (Period)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-500">${earnings.grossRevenue.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Your Share
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-500">${earnings.myShare.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Pending Payout
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-500">${earnings.pending.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              My Locations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{assignments?.length || 0}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="locations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="locations">My Locations</TabsTrigger>
          <TabsTrigger value="machines">Machines</TabsTrigger>
          <TabsTrigger value="payouts">Payout History</TabsTrigger>
          <TabsTrigger value="settings">Payout Settings</TabsTrigger>
        </TabsList>

        {/* Locations Tab */}
        <TabsContent value="locations">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Assigned Locations
              </CardTitle>
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
                    
                    return (
                      <Card key={assignment.id} className="border-border/50">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h3 className="font-semibold">{loc?.name || `${loc?.city}, ${loc?.country}`}</h3>
                              {loc?.address && <p className="text-sm text-muted-foreground">{loc.address}</p>}
                            </div>
                            <Badge variant={loc?.status === "active" ? "default" : "secondary"}>
                              {loc?.status}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-4 mt-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Machines</p>
                              <p className="text-lg font-bold">{locationMachines.length}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Revenue</p>
                              <p className="text-lg font-bold text-green-500">${locationRevenue.toLocaleString()}</p>
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
                            <Badge variant={machine.status === "active" ? "default" : "secondary"}>
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
                    {payouts?.map((payout) => (
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
                    ))}
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
                  <p className="text-sm text-muted-foreground">Contact VendX Global to set up your payout preferences</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Payment Method</p>
                      <p className="font-medium">{getPaymentMethodLabel(payoutSettings.payment_method)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Payout Frequency</p>
                      <p className="font-medium">{getFrequencyLabel(payoutSettings.payout_frequency)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Minimum Payout Amount</p>
                      <p className="font-medium">${Number(payoutSettings.minimum_payout_amount).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {payoutSettings.payment_method === "bank_transfer" && payoutSettings.bank_name && (
                      <>
                        <div>
                          <p className="text-sm text-muted-foreground">Bank</p>
                          <p className="font-medium">{payoutSettings.bank_name}</p>
                        </div>
                        {payoutSettings.bank_account_last4 && (
                          <div>
                            <p className="text-sm text-muted-foreground">Account</p>
                            <p className="font-medium">****{payoutSettings.bank_account_last4}</p>
                          </div>
                        )}
                      </>
                    )}
                    {payoutSettings.payment_method === "stripe_connect" && payoutSettings.stripe_account_id && (
                      <div>
                        <p className="text-sm text-muted-foreground">Stripe Account</p>
                        <p className="font-medium font-mono text-sm">{payoutSettings.stripe_account_id}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BusinessOwnerDashboard;
