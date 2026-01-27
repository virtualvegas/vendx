import { Card, CardContent } from "@/components/ui/card";
import { Monitor, Wifi, WifiOff, Wrench, DollarSign, TrendingUp, CreditCard } from "lucide-react";
import { calculateMachineStats, BaseMachine, formatRevenue } from "@/lib/machineUtils";
import { cn } from "@/lib/utils";

interface MachineStatsCardsProps {
  machines: BaseMachine[];
  showRevenue?: boolean;
  showVendxPay?: boolean;
  totalRevenue?: number;
  yourShare?: number;
  className?: string;
  compact?: boolean;
}

interface StatCard {
  label: string;
  value: number | string;
  icon: typeof Monitor;
  color: string;
  bgColor: string;
  showWhenZero?: boolean;
  isFormatted?: boolean;
  highlight?: boolean;
}

export const MachineStatsCards = ({
  machines,
  showRevenue = false,
  showVendxPay = false,
  totalRevenue = 0,
  yourShare = 0,
  className,
  compact = false,
}: MachineStatsCardsProps) => {
  const stats = calculateMachineStats(machines);

  const baseCards: StatCard[] = [
    {
      label: "Total Machines",
      value: stats.total,
      icon: Monitor,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      label: "Online",
      value: stats.online,
      icon: Wifi,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      label: "Offline",
      value: stats.offline,
      icon: WifiOff,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      showWhenZero: false,
    },
    {
      label: "Maintenance",
      value: stats.maintenance,
      icon: Wrench,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      showWhenZero: false,
    },
  ];

  const revenueCards: StatCard[] = showRevenue ? [
    {
      label: "Period Revenue",
      value: formatRevenue(totalRevenue),
      icon: DollarSign,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      isFormatted: true,
    },
    {
      label: "Your Share",
      value: formatRevenue(yourShare),
      icon: TrendingUp,
      color: "text-green-500",
      bgColor: "bg-green-500/20",
      isFormatted: true,
      highlight: true,
    },
  ] : [];

  const vendxPayCard: StatCard[] = showVendxPay ? [
    {
      label: "VendX Pay Enabled",
      value: stats.vendxPayEnabled,
      icon: CreditCard,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
  ] : [];

  // Filter out cards with zero values unless explicitly shown
  const allCards = [...baseCards, ...revenueCards, ...vendxPayCard].filter(
    card => card.showWhenZero !== false || card.value !== 0
  );

  // Determine grid columns based on card count
  const gridCols = compact 
    ? "grid-cols-2 md:grid-cols-4" 
    : allCards.length <= 4 
      ? "grid-cols-2 lg:grid-cols-4" 
      : "grid-cols-2 lg:grid-cols-3 xl:grid-cols-6";

  return (
    <div className={cn(`grid gap-4 ${gridCols}`, className)}>
      {allCards.map((card) => {
        const Icon = card.icon;
        return (
          <Card 
            key={card.label}
            className={cn(
              card.highlight && "bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20"
            )}
          >
            <CardContent className={compact ? "p-4" : "p-6"}>
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", card.bgColor)}>
                  <Icon className={cn(compact ? "w-4 h-4" : "w-5 h-5", card.color)} />
                </div>
                <div>
                  <p className={cn(
                    "font-bold",
                    compact ? "text-xl" : "text-2xl",
                    card.color
                  )}>
                    {card.isFormatted ? card.value : card.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

// Simpler inline stats for smaller displays
interface MachineInlineStatsProps {
  machines: BaseMachine[];
  className?: string;
}

export const MachineInlineStats = ({ machines, className }: MachineInlineStatsProps) => {
  const stats = calculateMachineStats(machines);

  return (
    <div className={cn("flex items-center gap-4 text-sm", className)}>
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-green-500" />
        <span className="text-muted-foreground">{stats.online} online</span>
      </span>
      {stats.offline > 0 && (
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-muted-foreground">{stats.offline} offline</span>
        </span>
      )}
      {stats.maintenance > 0 && (
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-yellow-500" />
          <span className="text-muted-foreground">{stats.maintenance} maintenance</span>
        </span>
      )}
    </div>
  );
};
