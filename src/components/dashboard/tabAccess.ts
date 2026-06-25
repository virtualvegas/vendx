import { AppRole } from "@/pages/DashboardPage";

// Single source of truth for which roles can access each dashboard tab.
// Used by both DashboardSidebar (visibility) and DashboardPage (route guard).
export const TAB_ACCESS: Record<string, AppRole[]> = {
  // Customer / personal
  "my-orders": ["customer", "business_owner", "employee_operator", "super_admin", "global_operations_manager", "regional_manager", "finance_accounting", "marketing_sales", "warehouse_logistics", "tech_support_lead", "event_manager", "support"],
  "my-wallet": ["customer", "business_owner", "employee_operator", "super_admin", "global_operations_manager", "regional_manager", "finance_accounting", "marketing_sales", "warehouse_logistics", "tech_support_lead", "event_manager", "support"],
  "my-tickets": ["customer", "business_owner", "employee_operator", "super_admin", "global_operations_manager", "regional_manager", "finance_accounting", "marketing_sales", "warehouse_logistics", "tech_support_lead", "event_manager", "support"],
  "my-rewards": ["customer", "business_owner", "employee_operator", "super_admin", "global_operations_manager", "regional_manager", "finance_accounting", "marketing_sales", "warehouse_logistics", "tech_support_lead", "event_manager", "support"],
  "my-business-card": ["business_owner", "employee_operator", "super_admin", "global_operations_manager", "regional_manager", "finance_accounting", "marketing_sales", "warehouse_logistics", "tech_support_lead", "event_manager", "support"],
  "linked-accounts": ["customer", "business_owner", "employee_operator", "super_admin", "global_operations_manager", "regional_manager", "finance_accounting", "marketing_sales", "warehouse_logistics", "tech_support_lead", "event_manager", "support"],
  "my-machines": ["customer", "business_owner", "employee_operator", "super_admin", "global_operations_manager", "regional_manager", "finance_accounting", "marketing_sales", "warehouse_logistics", "tech_support_lead", "event_manager", "support"],
  "my-subscriptions": ["customer", "business_owner", "employee_operator", "super_admin", "global_operations_manager", "regional_manager", "finance_accounting", "marketing_sales", "warehouse_logistics", "tech_support_lead", "event_manager", "support"],

  // Business owner
  "business-overview": ["business_owner", "super_admin"],
  "business-locations": ["business_owner", "super_admin"],
  "business-machines": ["business_owner", "super_admin"],
  "business-payouts": ["business_owner", "super_admin"],
  "business-adreach": ["business_owner", "super_admin"],
  "business-support": ["business_owner", "super_admin"],
  "business-external-service": ["business_owner", "super_admin"],

  // Field ops
  "my-route": ["super_admin", "global_operations_manager", "regional_manager", "employee_operator"],
  "service-tech": ["super_admin", "global_operations_manager", "employee_operator"],
  "daily-tasks": ["super_admin", "employee_operator"],

  // Arcade & prizes
  "arcade-game-titles": ["super_admin", "employee_operator"],
  "ticket-prizes": ["super_admin", "employee_operator"],
  "prize-inventory": ["super_admin", "warehouse_logistics", "employee_operator"],
  "prize-wins": ["super_admin", "finance_accounting", "employee_operator"],

  // Management overview
  "overview": ["super_admin", "global_operations_manager", "finance_accounting", "regional_manager"],
  "global-analytics": ["super_admin", "finance_accounting"],
  "global-operations": ["super_admin", "global_operations_manager"],
  "regional-reports": ["super_admin", "regional_manager"],
  "arcade-analytics": ["super_admin", "finance_accounting"],

  // Machines & tech
  "machine-registry": ["super_admin", "tech_support_lead", "support"],
  "ecosnack-lockers": ["super_admin", "employee_operator", "tech_support_lead", "support"],
  "ecovend-suggestions": ["super_admin", "global_operations_manager"],
  "ticket-config": ["super_admin"],
  "kiosk-categories": ["super_admin", "tech_support_lead"],
  "technical-support": ["super_admin", "tech_support_lead", "support"],
  "external-service": ["super_admin", "tech_support_lead", "support", "finance_accounting", "global_operations_manager", "regional_manager", "employee_operator"],
  "custom-arcade-requests": ["super_admin", "tech_support_lead", "support", "finance_accounting", "global_operations_manager", "regional_manager", "employee_operator"],

  // Routes & logistics
  "route-manager": ["super_admin", "global_operations_manager"],
  "warehouses": ["super_admin"],
  "inventory-logistics": ["super_admin", "warehouse_logistics"],
  "machine-inventory": ["super_admin", "warehouse_logistics", "employee_operator"],

  // Finance
  "finance": ["super_admin", "finance_accounting"],
  "finance-manager": ["super_admin", "finance_accounting"],
  "vendx-pay": ["super_admin", "finance_accounting"],
  "merchant-api": ["super_admin", "finance_accounting"],
  "gift-cards": ["super_admin"],
  "payouts": ["super_admin", "finance_accounting"],
  "artist-payouts": ["super_admin", "finance_accounting"],
  "profit-splits": ["super_admin", "finance_accounting"],

  // Marketing
  "marketing": ["super_admin", "marketing_sales"],
  "email-subscribers": ["super_admin", "marketing_sales"],
  "adreach-manager": ["super_admin"],
  "rewards-manager": ["super_admin", "marketing_sales"],
  "partner-offers": ["super_admin", "marketing_sales"],
  "brand-links": ["super_admin", "marketing_sales"],
  "quests-manager": ["super_admin", "marketing_sales"],

  // Online store
  "store-manager": ["super_admin"],
  "subscriptions-admin": ["super_admin", "finance_accounting", "support"],
  "products-manager": ["super_admin"],
  "waitlist-manager": ["super_admin"],
  "funnels": ["super_admin"],

  // Website content
  "news": ["super_admin"],
  "business-content": ["super_admin"],
  "careers": ["super_admin"],
  "site-policies": ["super_admin"],
  "divisions-manager": ["super_admin"],

  // Media
  "media-manager": ["super_admin"],
  "artists-manager": ["super_admin"],
  "releases-tracks": ["super_admin"],
  "media-shop-manager": ["super_admin"],
  "track-shop-manager": ["super_admin"],
  "video-games": ["super_admin"],

  // Locations
  "locations": ["super_admin"],
  "offices": ["super_admin"],
  "events-rentals": ["super_admin", "event_manager"],
  "stands-manager": ["super_admin"],

  // System admin
  "admin-settings": ["super_admin"],
  "income-streams": ["super_admin"],
  "audit-logs": ["super_admin"],
  "sso-apps": ["super_admin"],
};

export const hasTabAccess = (tabId: string, roles: AppRole[]): boolean => {
  const required = TAB_ACCESS[tabId];
  // Personal tabs (no entry) always allowed for any authenticated user
  if (!required) return true;
  return roles.some((r) => required.includes(r));
};
