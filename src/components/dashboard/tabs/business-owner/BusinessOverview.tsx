import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  DollarSign, Monitor, Building2, TrendingUp, 
  BarChart3, Activity, Phone, Mail, Headphones, AlertCircle, Clock, CheckCircle2,
  Wrench, Calendar, Truck, ArrowRight, CircleDot, Shield
} from "lucide-react";
import { useBusinessOwnerData, type ScheduledServiceStop, type SupportRequest } from "./useBusinessOwnerData";
import BusinessOnboarding from "./BusinessOnboarding";

const VENDX_PHONE = "(781) 214-1806";
const VENDX_PHONE_TEL = "tel:+17812141806";
const VENDX_EMAIL = "partners@vendx.space";

const BusinessOverview = () => {
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const { 
    assignments, 
    machines, 
    machineRevenue,
    profitSplits, 
    payouts, 
    payoutSettings,
    supportRequests,
    scheduledStops,
    isLoading 
  } = useBusinessOwnerData();

  const completeOnboarding = () => {
    localStorage.setItem("vendx_bo_onboarded", "true");
    setShowOnboarding(false);
  };

  // Check if onboarding is needed — only show if never completed before
  useMemo(() => {
    if (!isLoading && showOnboarding === null) {
      const alreadyOnboarded = localStorage.getItem("vendx_bo_onboarded") === "true";
      setShowOnboarding(!alreadyOnboarded && !payoutSettings);
    }
  }, [isLoading, payoutSettings, showOnboarding]);

  // Calculate earnings from LIVE transaction data
  const earnings = useMemo(() => {
    if (!machines || !profitSplits) return { grossRevenue: 0, myShare: 0, pending: 0, lifetimeRevenue: 0, totalPaid: 0 };

    let grossRevenue = 0;
    let myShare = 0;
    let lifetimeRevenue = 0;

    machines.forEach(machine => {
      const split = profitSplits.find(s => s.machine_id === machine.id);
      const ownerPercentage = split?.business_owner_percentage || 30;
      const rev = machineRevenue.get(machine.id);
      const periodRev = rev?.period || 0;
      const lifetimeRev = rev?.lifetime || 0;
      
      grossRevenue += periodRev;
      myShare += periodRev * (ownerPercentage / 100);
      lifetimeRevenue += lifetimeRev;
    });

    const pending = payouts
      ?.filter(p => p.status === "pending")
      .reduce((sum, p) => sum + Number(p.amount), 0) || 0;

    const totalPaid = payouts
      ?.filter(p => p.status === "paid")
      .reduce((sum, p) => sum + Number(p.amount), 0) || 0;

    return { grossRevenue, myShare, pending, lifetimeRevenue, totalPaid };
  }, [machines, machineRevenue, profitSplits, payouts]);

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

  // Ticket summary stats
  const ticketStats = useMemo(() => {
    if (!supportRequests) return { open: 0, inProgress: 0, resolved: 0, total: 0 };
    return {
      open: supportRequests.filter(r => r.status === "open").length,
      inProgress: supportRequests.filter(r => r.status === "in_progress").length,
      resolved: supportRequests.filter(r => r.status === "resolved" || r.status === "closed").length,
      total: supportRequests.length,
    };
  }, [supportRequests]);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "open": return { icon: <AlertCircle className="w-4 h-4" />, label: "Open", color: "bg-yellow-500", textColor: "text-yellow-600", bgColor: "bg-yellow-500/10 border-yellow-500/30" };
      case "in_progress": return { icon: <Clock className="w-4 h-4" />, label: "In Progress", color: "bg-blue-500", textColor: "text-blue-600", bgColor: "bg-blue-500/10 border-blue-500/30" };
      case "resolved": return { icon: <CheckCircle2 className="w-4 h-4" />, label: "Resolved", color: "bg-green-500", textColor: "text-green-600", bgColor: "bg-green-500/10 border-green-500/30" };
      case "closed": return { icon: <CheckCircle2 className="w-4 h-4" />, label: "Closed", color: "bg-muted-foreground", textColor: "text-muted-foreground", bgColor: "bg-muted/50 border-muted" };
      default: return { icon: <CircleDot className="w-4 h-4" />, label: status, color: "bg-muted", textColor: "text-muted-foreground", bgColor: "bg-muted/50 border-muted" };
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent": return <Badge variant="destructive" className="text-xs">Urgent</Badge>;
      case "high": return <Badge variant="destructive" className="text-xs">High</Badge>;
      case "medium": return <Badge variant="secondary" className="text-xs">Medium</Badge>;
      default: return <Badge variant="outline" className="text-xs">Low</Badge>;
    }
  };

  const getServiceStopPriorityColor = (priority: string | null) => {
    switch (priority) {
      case "urgent": return "border-l-red-500";
      case "high": return "border-l-orange-500";
      default: return "border-l-blue-500";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading your dashboard...</p>
      </div>
    );
  }

  if (showOnboarding) {
    return (
      <BusinessOnboarding 
        onComplete={completeOnboarding} 
        assignments={assignments || []}
        machines={machines || []}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl lg:text-3xl font-bold text-foreground mb-1">Partner Dashboard</h2>
        <p className="text-muted-foreground">Live performance across your locations (30-day window)</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs lg:text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Your Share (30d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl lg:text-3xl font-bold text-green-500">${earnings.myShare.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-muted-foreground mt-1">From ${earnings.grossRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })} gross</p>
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
            <p className="text-2xl lg:text-3xl font-bold text-yellow-500">${earnings.pending.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
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

      {/* Scheduled Service Calls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-lg">
              <Truck className="w-5 h-5 text-blue-500" />
              Scheduled Service Calls
            </span>
            {scheduledStops && scheduledStops.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {scheduledStops.length} upcoming
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!scheduledStops || scheduledStops.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-10 h-10 mx-auto text-green-500/40 mb-2" />
              <p className="text-sm text-muted-foreground">No scheduled service calls</p>
              <p className="text-xs text-muted-foreground mt-1">Everything is running smoothly!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {scheduledStops.slice(0, 6).map((stop) => (
                <div 
                  key={stop.id} 
                  className={`flex items-start gap-3 p-3 rounded-lg border border-l-4 ${getServiceStopPriorityColor(stop.priority)} bg-card`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {stop.auto_scheduled ? (
                      <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                        <Wrench className="w-4 h-4 text-orange-500" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <Calendar className="w-4 h-4 text-blue-500" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{stop.stop_name}</p>
                      {stop.auto_scheduled && (
                        <Badge variant="outline" className="text-xs border-orange-500/30 text-orange-600">
                          From Ticket
                        </Badge>
                      )}
                    </div>
                    {stop.machine && (
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Monitor className="w-3 h-3" />
                        {stop.machine.name} ({stop.machine.machine_code})
                      </p>
                    )}
                    {stop.notes && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{stop.notes}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5">
                      {stop.scheduled_date && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(stop.scheduled_date + "T00:00:00").toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                      )}
                      {stop.estimated_duration_minutes && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          ~{stop.estimated_duration_minutes}m
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={`text-xs flex-shrink-0 capitalize ${
                      stop.status === "pending" ? "border-yellow-500/30 text-yellow-600" : "border-blue-500/30 text-blue-600"
                    }`}
                  >
                    {stop.status.replace("_", " ")}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Support Ticket Status Overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-lg">
              <Shield className="w-5 h-5 text-primary" />
              Support Ticket Status
            </span>
            {ticketStats.total > 0 && (
              <div className="flex items-center gap-2">
                {ticketStats.open > 0 && (
                  <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30 text-xs">
                    {ticketStats.open} open
                  </Badge>
                )}
                {ticketStats.inProgress > 0 && (
                  <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30 text-xs">
                    {ticketStats.inProgress} in progress
                  </Badge>
                )}
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Status pipeline visual */}
          {ticketStats.total > 0 && (
            <div className="mb-4">
              <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-muted">
                {ticketStats.open > 0 && (
                  <div 
                    className="bg-yellow-500 rounded-l-full" 
                    style={{ width: `${(ticketStats.open / ticketStats.total) * 100}%` }} 
                  />
                )}
                {ticketStats.inProgress > 0 && (
                  <div 
                    className="bg-blue-500" 
                    style={{ width: `${(ticketStats.inProgress / ticketStats.total) * 100}%` }} 
                  />
                )}
                {ticketStats.resolved > 0 && (
                  <div 
                    className="bg-green-500 rounded-r-full" 
                    style={{ width: `${(ticketStats.resolved / ticketStats.total) * 100}%` }} 
                  />
                )}
              </div>
              <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" /> Open ({ticketStats.open})</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> In Progress ({ticketStats.inProgress})</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Resolved ({ticketStats.resolved})</span>
              </div>
            </div>
          )}

          {!supportRequests || supportRequests.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No support requests yet</p>
          ) : (
            <div className="space-y-2">
              {supportRequests.slice(0, 6).map((request) => {
                const statusConfig = getStatusConfig(request.status);
                return (
                  <div key={request.id} className={`flex items-center gap-3 p-3 rounded-lg border ${statusConfig.bgColor}`}>
                    <div className={`flex-shrink-0 ${statusConfig.textColor}`}>
                      {statusConfig.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{request.subject}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          {new Date(request.created_at).toLocaleDateString()} · {request.request_type}
                        </span>
                      </div>
                      {request.resolution && request.status === "resolved" && (
                        <p className="text-xs text-green-600 mt-1 line-clamp-1">
                          ✓ {request.resolution}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <Badge variant="outline" className={`text-xs ${statusConfig.textColor}`}>
                        {statusConfig.label}
                      </Badge>
                      {getPriorityBadge(request.priority)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

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
              <span className="font-bold">${earnings.lifetimeRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">30-Day Revenue</span>
              <span className="font-bold text-green-500">${earnings.grossRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Your Earnings (30d)</span>
              <span className="font-bold text-primary">${earnings.myShare.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-muted-foreground">Total Paid Out</span>
              <span className="font-bold">${earnings.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
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
