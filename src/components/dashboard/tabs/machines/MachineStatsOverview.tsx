import { Card, CardContent } from "@/components/ui/card";
import { Monitor, Wifi, WifiOff, DollarSign, Gamepad2, ShoppingCart, Activity } from "lucide-react";

interface MachineStats {
  total: number;
  active: number;
  online: number;
  offline: number;
  totalRevenue: number;
  totalPlays: number;
  totalVends: number;
  vendingCount: number;
  arcadeCount: number;
}

interface MachineStatsOverviewProps {
  stats: MachineStats;
}

export const MachineStatsOverview = ({ stats }: MachineStatsOverviewProps) => {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Monitor className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Machines</p>
              <p className="text-2xl font-bold">{stats.total}</p>
              <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                <span>{stats.vendingCount} vending</span>
                <span>•</span>
                <span>{stats.arcadeCount} arcade</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/10 rounded-lg">
              <Wifi className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Online Now</p>
              <p className="text-2xl font-bold text-green-500">{stats.online}</p>
              <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                <span className="text-red-400">{stats.offline} offline</span>
                <span>•</span>
                <span>{stats.active} active</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-accent/10 rounded-lg">
              <DollarSign className="w-6 h-6 text-accent" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-500/10 rounded-lg">
              <Activity className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Activity</p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <Gamepad2 className="w-4 h-4 text-purple-500" />
                  <span className="font-bold">{stats.totalPlays.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1">
                  <ShoppingCart className="w-4 h-4 text-green-500" />
                  <span className="font-bold">{stats.totalVends.toLocaleString()}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">plays / vends</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
