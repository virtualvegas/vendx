import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, ChevronRight, DollarSign } from "lucide-react";
import { MachineStatusBadge, MachineStatusIcon } from "./MachineStatusBadge";
import { getMachineTypeLabel, formatRevenue, getLocationDisplayName, BaseMachine, MachineLocation } from "@/lib/machineUtils";
import { cn } from "@/lib/utils";

interface MachineListItemProps {
  machine: BaseMachine;
  location?: MachineLocation | null;
  onClick?: () => void;
  showRevenue?: boolean;
  showLocation?: boolean;
  profitSplit?: { business_owner_percentage: number; vendx_percentage: number } | null;
  className?: string;
}

export const MachineListItem = ({
  machine,
  location,
  onClick,
  showRevenue = true,
  showLocation = true,
  profitSplit,
  className,
}: MachineListItemProps) => {
  const revenue = Number(machine.current_period_revenue || 0);
  const ownerPercentage = profitSplit?.business_owner_percentage || 30;
  const share = revenue * (ownerPercentage / 100);

  return (
    <Card 
      className={cn(
        "transition-all hover:bg-muted/50",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <MachineStatusIcon 
            status={machine.status} 
            lastSeen={machine.last_seen} 
            size="lg"
          />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-medium truncate">{machine.name}</p>
              <Badge variant="outline" className="shrink-0 text-xs">
                {getMachineTypeLabel(machine.machine_type)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-mono">{machine.machine_code}</p>
            
            {showLocation && location && (
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3" />
                <span className="truncate">{getLocationDisplayName(location)}</span>
              </div>
            )}
          </div>

          {showRevenue && (
            <div className="text-right shrink-0">
              <p className="font-semibold">{formatRevenue(revenue)}</p>
              {profitSplit && (
                <p className="text-xs text-green-500">
                  Your share: {formatRevenue(share)}
                </p>
              )}
            </div>
          )}

          {onClick && (
            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Compact row version for tables
interface MachineTableRowProps {
  machine: BaseMachine;
  location?: MachineLocation | null;
  profitSplit?: { business_owner_percentage: number; vendx_percentage: number } | null;
  showVendxPay?: boolean;
  onRowClick?: () => void;
  actions?: React.ReactNode;
}

export const MachineTableRowData = ({
  machine,
  location,
  profitSplit,
  showVendxPay = false,
}: MachineTableRowProps) => {
  const revenue = Number(machine.current_period_revenue || 0);
  const ownerPercentage = profitSplit?.business_owner_percentage || 30;
  const share = revenue * (ownerPercentage / 100);

  return {
    machine: (
      <div>
        <p className="font-medium">{machine.name}</p>
        <p className="text-xs text-muted-foreground font-mono">{machine.machine_code}</p>
      </div>
    ),
    location: location ? (
      <div className="flex items-center gap-1">
        <MapPin className="w-3 h-3 text-muted-foreground" />
        <span className="text-sm">{getLocationDisplayName(location)}</span>
      </div>
    ) : (
      <span className="text-muted-foreground">Unassigned</span>
    ),
    type: (
      <Badge variant="outline">
        {getMachineTypeLabel(machine.machine_type)}
      </Badge>
    ),
    status: (
      <MachineStatusBadge 
        status={machine.status} 
        lastSeen={machine.last_seen}
        displayMode="both"
        size="sm"
      />
    ),
    vendxPay: showVendxPay ? (
      <Badge variant={machine.vendx_pay_enabled ? "default" : "outline"}>
        {machine.vendx_pay_enabled ? "Enabled" : "Disabled"}
      </Badge>
    ) : null,
    revenue: formatRevenue(revenue),
    profitSplit: profitSplit ? (
      <span className="text-sm">
        {ownerPercentage}% / {profitSplit.vendx_percentage || 100 - ownerPercentage}%
      </span>
    ) : null,
    share: profitSplit ? (
      <span className="text-green-500 font-medium">{formatRevenue(share)}</span>
    ) : null,
  };
};
