import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, Wrench, Activity, Power, PowerOff } from "lucide-react";
import { getOnlineStatus } from "@/lib/machineUtils";
import { cn } from "@/lib/utils";

export type StatusDisplayMode = "text" | "icon" | "both";
export type OnlineCheckMode = "status-only" | "last-seen" | "combined";

interface MachineStatusBadgeProps {
  status: string;
  lastSeen?: string | null;
  displayMode?: StatusDisplayMode;
  onlineCheckMode?: OnlineCheckMode;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const statusConfig = {
  active: {
    label: "Active",
    icon: Wifi,
    className: "bg-green-500/20 text-green-500 border-green-500/30",
  },
  online: {
    label: "Online",
    icon: Wifi,
    className: "bg-green-500/20 text-green-500 border-green-500/30",
  },
  offline: {
    label: "Offline",
    icon: WifiOff,
    className: "bg-red-500/20 text-red-500 border-red-500/30",
  },
  maintenance: {
    label: "Maintenance",
    icon: Wrench,
    className: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
  },
  inactive: {
    label: "Inactive",
    icon: PowerOff,
    className: "bg-muted text-muted-foreground border-border",
  },
};

const sizeConfig = {
  sm: { badge: "text-xs px-1.5 py-0.5", icon: "w-3 h-3" },
  md: { badge: "text-xs px-2.5 py-0.5", icon: "w-3.5 h-3.5" },
  lg: { badge: "text-sm px-3 py-1", icon: "w-4 h-4" },
};

export const MachineStatusBadge = ({
  status,
  lastSeen,
  displayMode = "both",
  onlineCheckMode = "combined",
  size = "md",
  className,
}: MachineStatusBadgeProps) => {
  // Determine effective status based on mode
  let effectiveStatus = status;
  
  if (onlineCheckMode === "last-seen" || onlineCheckMode === "combined") {
    const isOnline = getOnlineStatus(lastSeen);
    
    if (onlineCheckMode === "combined") {
      // Machine must be active AND have recent last_seen to be considered online
      if (status === "active") {
        effectiveStatus = isOnline ? "online" : "offline";
      }
    } else if (onlineCheckMode === "last-seen") {
      effectiveStatus = isOnline ? "online" : "offline";
    }
  }

  const config = statusConfig[effectiveStatus as keyof typeof statusConfig] || {
    label: status,
    icon: Activity,
    className: "bg-muted text-muted-foreground border-border",
  };

  const sizes = sizeConfig[size];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 font-medium border",
        config.className,
        sizes.badge,
        className
      )}
    >
      {(displayMode === "icon" || displayMode === "both") && (
        <Icon className={sizes.icon} />
      )}
      {(displayMode === "text" || displayMode === "both") && (
        <span>{config.label}</span>
      )}
    </Badge>
  );
};

// Simple icon-only status indicator
interface MachineStatusIconProps {
  status: string;
  lastSeen?: string | null;
  size?: "sm" | "md" | "lg";
  onlineCheckMode?: OnlineCheckMode;
  className?: string;
}

export const MachineStatusIcon = ({
  status,
  lastSeen,
  size = "md",
  onlineCheckMode = "combined",
  className,
}: MachineStatusIconProps) => {
  let effectiveStatus = status;
  
  if (onlineCheckMode === "last-seen" || onlineCheckMode === "combined") {
    const isOnline = getOnlineStatus(lastSeen);
    if (onlineCheckMode === "combined" && status === "active") {
      effectiveStatus = isOnline ? "online" : "offline";
    } else if (onlineCheckMode === "last-seen") {
      effectiveStatus = isOnline ? "online" : "offline";
    }
  }

  const iconSizes = { sm: "w-3 h-3", md: "w-4 h-4", lg: "w-5 h-5" };
  
  const icons: Record<string, { Icon: typeof Wifi; color: string }> = {
    active: { Icon: Wifi, color: "text-green-500" },
    online: { Icon: Wifi, color: "text-green-500" },
    offline: { Icon: WifiOff, color: "text-red-500" },
    maintenance: { Icon: Wrench, color: "text-yellow-500" },
    inactive: { Icon: PowerOff, color: "text-muted-foreground" },
  };

  const { Icon, color } = icons[effectiveStatus] || { Icon: Activity, color: "text-muted-foreground" };

  return <Icon className={cn(iconSizes[size], color, className)} />;
};
