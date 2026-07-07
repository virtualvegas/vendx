// Universal machine utilities for consistent behavior across all dashboard pages

export const MACHINE_TYPES = [
  // Vending
  { value: "snack", label: "Snack" },
  { value: "beverage", label: "Beverage" },
  { value: "combo", label: "Combo" },
  { value: "fresh", label: "Fresh Food" },
  { value: "coffee", label: "Coffee / Hot Drink" },
  { value: "ice_cream", label: "Ice Cream / Frozen" },
  { value: "healthy_snack", label: "Healthy Snack" },
  { value: "micro_market", label: "Micro Market" },
  { value: "ecosnack", label: "EcoVend Locker" },
  { value: "smart_locker", label: "Smart Locker" },
  { value: "medical_vending", label: "Medical / PPE Vending" },
  { value: "cannabis_vending", label: "Cannabis Vending" },
  { value: "beauty_vending", label: "Beauty Products Vending" },
  { value: "electronics_vending", label: "Electronics Vending" },
  // Arcade & Entertainment
  { value: "arcade", label: "Arcade Cabinet" },
  { value: "claw", label: "Claw Machine" },
  { value: "redemption_game", label: "Redemption Game" },
  { value: "pinball", label: "Pinball" },
  { value: "photo_booth", label: "Photo Booth" },
  { value: "vr_pod", label: "VR Pod" },
  { value: "racing_simulator", label: "Racing Simulator" },
  { value: "ticket_dispenser", label: "Ticket / Prize Dispenser" },
  { value: "prize_kiosk", label: "Prize Redemption Kiosk" },
  // Kiosks & Digital
  { value: "digital", label: "Digital Kiosk" },
  { value: "self_checkout", label: "Self-Checkout Kiosk" },
  { value: "info_kiosk", label: "Info / Wayfinding Kiosk" },
  { value: "ordering_kiosk", label: "Ordering Kiosk" },
  { value: "check_in_kiosk", label: "Check-In Kiosk" },
  { value: "ad_display", label: "Digital Ad Display" },
  // Financial & Cash
  { value: "atm", label: "ATM" },
  { value: "bill_changer", label: "Bill / Coin Changer" },
  { value: "crypto_atm", label: "Crypto ATM" },
  { value: "gift_card_kiosk", label: "Gift Card Kiosk" },
  // Charging & Utility
  { value: "phone_charger", label: "Phone Charging Station" },
  { value: "ev_charger", label: "EV Charging Station" },
  { value: "wifi_hotspot", label: "WiFi Hotspot" },
  { value: "battery_swap", label: "Battery Swap Station" },
  // Laundry & Services
  { value: "laundry", label: "Laundry Machine" },
  { value: "car_wash", label: "Car Wash Bay" },
  { value: "air_water", label: "Air / Water Station" },
  { value: "vacuum", label: "Vacuum Station" },
  // Health & Convenience
  { value: "massage_chair", label: "Massage Chair" },
  { value: "kiddie_ride", label: "Kiddie Ride" },
  { value: "scale", label: "Weight / Health Scale" },
  { value: "blood_pressure", label: "Blood Pressure Kiosk" },
  // Other
  { value: "other", label: "Other" },
] as const;

export const MACHINE_STATUSES = [
  { value: "active", label: "Active", color: "green" },
  { value: "inactive", label: "Inactive", color: "gray" },
  { value: "maintenance", label: "Maintenance", color: "yellow" },
  { value: "offline", label: "Offline", color: "red" },
] as const;

export type MachineType = typeof MACHINE_TYPES[number]["value"];
export type MachineStatus = typeof MACHINE_STATUSES[number]["value"];

export interface BaseMachine {
  id: string;
  name: string;
  machine_code: string;
  machine_type: string;
  status: string;
  vendx_pay_enabled?: boolean;
  accepts_cash?: boolean;
  accepts_coins?: boolean;
  accepts_cards?: boolean;
  last_seen?: string | null;
  location_id?: string | null;
  current_period_revenue?: number | null;
  lifetime_revenue?: number | null;
}

// Get payment methods display for a machine
export const getPaymentMethodsDisplay = (machine: BaseMachine): string[] => {
  const methods: string[] = [];
  if (machine.accepts_cash) methods.push("Cash");
  if (machine.accepts_coins) methods.push("Coins");
  if (machine.accepts_cards) methods.push("Cards");
  if (machine.vendx_pay_enabled) methods.push("VendX Pay");
  return methods;
};

export interface MachineLocation {
  id: string;
  name: string | null;
  city: string;
  country: string;
  address?: string | null;
}

// Check if machine is online based on last_seen timestamp (within 5 minutes)
export const getOnlineStatus = (lastSeen: string | null | undefined): boolean => {
  if (!lastSeen) return false;
  const diff = Date.now() - new Date(lastSeen).getTime();
  return diff < 5 * 60 * 1000; // 5 minutes
};

// Get machine type label
export const getMachineTypeLabel = (type: string): string => {
  const found = MACHINE_TYPES.find(t => t.value === type);
  return found?.label || type;
};

// Get machine status label
export const getMachineStatusLabel = (status: string): string => {
  const found = MACHINE_STATUSES.find(s => s.value === status);
  return found?.label || status;
};

// Calculate machine stats from array of machines
export const calculateMachineStats = (machines: BaseMachine[]) => {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

  return {
    total: machines.length,
    active: machines.filter(m => m.status === "active").length,
    online: machines.filter(m => 
      m.status === "active" && m.last_seen && new Date(m.last_seen).getTime() > fiveMinutesAgo
    ).length,
    offline: machines.filter(m => 
      m.status === "active" && (!m.last_seen || new Date(m.last_seen).getTime() <= fiveMinutesAgo)
    ).length,
    maintenance: machines.filter(m => m.status === "maintenance").length,
    vendxPayEnabled: machines.filter(m => m.vendx_pay_enabled).length,
  };
};

// Filter machines based on search and filters
export const filterMachines = <T extends BaseMachine>(
  machines: T[],
  options: {
    searchTerm?: string;
    status?: string;
    type?: string;
    locationId?: string;
  }
): T[] => {
  const { searchTerm = "", status = "all", type = "all", locationId = "all" } = options;
  
  return machines.filter(m => {
    const matchesSearch = searchTerm === "" || 
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.machine_code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = status === "all" || m.status === status;
    const matchesType = type === "all" || m.machine_type === type;
    const matchesLocation = locationId === "all" || m.location_id === locationId;
    
    return matchesSearch && matchesStatus && matchesType && matchesLocation;
  });
};

// Generate machine code
export const generateMachineCode = (): string => {
  const prefix = "VX";
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${random}`;
};

// Generate API key for machine
export const generateMachineApiKey = (): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "vx_";
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Format revenue value
export const formatRevenue = (value: number | null | undefined): string => {
  const num = Number(value || 0);
  return num.toLocaleString("en-US", { style: "currency", currency: "USD" });
};

// Get location display name
export const getLocationDisplayName = (location: MachineLocation | null | undefined): string => {
  if (!location) return "Unassigned";
  return location.name || `${location.city}, ${location.country}`;
};
