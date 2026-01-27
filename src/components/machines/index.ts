// Universal machine components for consistent UI across all dashboard pages
export { MachineStatusBadge, MachineStatusIcon } from "./MachineStatusBadge";
export { MachineFilters } from "./MachineFilters";
export { MachineStatsCards, MachineInlineStats } from "./MachineStatsCards";
export { MachineListItem, MachineTableRowData } from "./MachineListItem";

// Re-export utilities
export {
  MACHINE_TYPES,
  MACHINE_STATUSES,
  getOnlineStatus,
  getMachineTypeLabel,
  getMachineStatusLabel,
  calculateMachineStats,
  filterMachines,
  generateMachineCode,
  generateMachineApiKey,
  formatRevenue,
  getLocationDisplayName,
  type BaseMachine,
  type MachineLocation,
  type MachineType,
  type MachineStatus,
} from "@/lib/machineUtils";
