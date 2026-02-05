import { WifiOff, AlertTriangle, RefreshCw } from "lucide-react";

interface KioskMachineOfflineProps {
  machineCode: string;
  reason: "not_found" | "offline" | "maintenance";
}

export const KioskMachineOffline = ({ machineCode, reason }: KioskMachineOfflineProps) => {
  const handleRefresh = () => {
    window.location.reload();
  };

  const getMessage = () => {
    switch (reason) {
      case "not_found":
        return {
          title: "Machine Not Found",
          description: `Machine "${machineCode}" is not registered in our system.`,
          icon: AlertTriangle,
        };
      case "maintenance":
        return {
          title: "Under Maintenance",
          description: "This machine is temporarily unavailable for maintenance.",
          icon: AlertTriangle,
        };
      case "offline":
      default:
        return {
          title: "Machine Offline",
          description: "This machine is currently not available. Please try again later.",
          icon: WifiOff,
        };
    }
  };

  const { title, description, icon: Icon } = getMessage();

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 gap-8">
      <div className="flex flex-col items-center gap-4">
        <div className="w-24 h-24 rounded-full bg-yellow-500/20 flex items-center justify-center">
          <Icon className="w-12 h-12 text-yellow-500" />
        </div>
        <p className="text-2xl sm:text-3xl font-bold text-yellow-500 text-center">
          {title}
        </p>
        <p className="text-lg text-gray-400 text-center max-w-sm">
          {description}
        </p>
      </div>
      
      <button
        onClick={handleRefresh}
        className="flex items-center gap-3 px-8 py-6 text-xl font-bold bg-gray-800 hover:bg-gray-700 active:bg-gray-600 rounded-2xl transition-all touch-manipulation border border-gray-700"
      >
        <RefreshCw className="w-6 h-6" />
        RETRY
      </button>

      <p className="text-gray-600 text-sm">
        Machine: {machineCode}
      </p>
    </div>
  );
};
