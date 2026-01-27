import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  DollarSign, Monitor, Building2, TrendingUp, 
  BarChart3, Activity, Phone, Mail, Headphones, AlertCircle, Clock, CheckCircle2, Plus
} from "lucide-react";
import { useBusinessOwnerData } from "./useBusinessOwnerData";
import BusinessOnboarding from "./BusinessOnboarding";

const VENDX_PHONE = "(781) 214-1806";
const VENDX_PHONE_TEL = "tel:+17812141806";
const VENDX_EMAIL = "partners@vendx.space";

const BusinessOverview = () => {
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const { 
    assignments, 
    machines, 
    profitSplits, 
    payouts, 
    payoutSettings,
    supportRequests,
    isLoading 
  } = useBusinessOwnerData();

  // Check if onboarding is needed (no payout settings configured)
  useMemo(() => {
    if (!isLoading && showOnboarding === null) {
      setShowOnboarding(!payoutSettings);
    }
  }, [isLoading, payoutSettings, showOnboarding]);

  // Calculate earnings summary
  const earnings = useMemo(() => {
    if (!machines || !profitSplits) return { grossRevenue: 0, myShare: 0, pending: 0, lifetimeRevenue: 0, totalPaid: 0 };

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

    const totalPaid = payouts
      ?.filter(p => p.status === "paid")
      .reduce((sum, p) => sum + Number(p.amount), 0) || 0;

    return { grossRevenue, myShare, pending, lifetimeRevenue, totalPaid };
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "open": return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case "in_progress": return <Clock className="w-4 h-4 text-blue-500" />;
      case "resolved": return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      default: return <CheckCircle2 className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": case "high": return "destructive";
      case "medium": return "secondary";
      default: return "outline";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading your dashboard...</p>
      </div>
    );
  }

  // Show onboarding if needed
  if (showOnboarding) {
    return (
      <BusinessOnboarding 
        onComplete={() => setShowOnboarding(false)} 
        assignments={assignments || []}
        machines={machines || []}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl lg:text-3xl font-bold text-foreground mb-1">Partner Dashboard</h2>
        <p className="text-muted-foreground">View performance and manage your locations</p>
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
              <TrendingUp className="w-4 h-4" />
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
              <span className="font-bold">${earnings.totalPaid.toLocaleString()}</span>
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Headphones className="w-5 h-5" />
            Recent Support Requests
          </CardTitle>
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
    </div>
  );
};

export default BusinessOverview;
