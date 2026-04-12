import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PurchaseResult } from "@/components/kiosk/KioskSuccess";

export type MachineType = "arcade" | "claw" | "snack" | "beverage" | "combo" | "fresh" | "digital" | "ecosnack" | "other";

export interface KioskMachineInfo {
  id: string;
  name: string;
  machine_code: string;
  machine_type: MachineType;
  status: string;
  location: {
    id: string;
    name: string;
    city: string;
    address: string;
  } | null;
}

export interface PriceBundle {
  plays: number;
  price: number;
  label: string;
  savings?: number;
  savingsPercent?: number;
}

export interface ArcadePricing {
  price_per_play: number;
  bundles: PriceBundle[];
  template_name: string | null;
  has_bundles: boolean;
}

export interface KioskCategory {
  id: string;
  category_name: string;
  base_price: number;
  display_order: number;
}

export interface KioskSessionData {
  sessionId: string;
  userId: string;
  userName: string;
  walletBalance: number;
  ticketBalance?: number;
}

export const useKiosk = (machineId: string) => {
  const [session, setSession] = useState<KioskSessionData | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPurchase, setLastPurchase] = useState<PurchaseResult | null>(null);

  // Fetch machine info using RPC (safe public access without exposing api_key)
  const { data: machineInfo, isLoading: machineLoading } = useQuery({
    queryKey: ["kiosk-machine", machineId],
    queryFn: async () => {
      if (machineId === "demo") {
        return null; // Demo mode no longer supported
      }

      // Try RPC for public access first (no auth needed)
      const { data: rpcData, error: rpcError } = await supabase.rpc("get_public_machine_info", {
        p_machine_code: machineId,
      });

      if (!rpcError && rpcData && rpcData.length > 0) {
        const m = rpcData[0];
        return {
          id: m.id,
          name: m.name,
          machine_code: m.machine_code,
          machine_type: m.machine_type as MachineType,
          status: m.status,
          location: null,
        } as KioskMachineInfo;
      }

      // Fallback: try direct query (works for authenticated staff)
      const { data, error } = await supabase
        .from("vendx_machines")
        .select(`
          id, name, machine_code, machine_type, status,
          location:locations(id, name, city, address)
        `)
        .or(`id.eq.${machineId},machine_code.eq.${machineId}`)
        .maybeSingle();

      if (error) throw error;
      return data as KioskMachineInfo | null;
    },
    enabled: !!machineId,
  });

  // Fetch arcade pricing if arcade/claw machine
  const isArcade = machineInfo?.machine_type === "arcade" || machineInfo?.machine_type === "claw";
  
  const { data: arcadePricing } = useQuery({
    queryKey: ["kiosk-arcade-pricing", machineInfo?.id],
    queryFn: async () => {
      if (!machineInfo?.id || machineId === "demo") {
        return {
          price_per_play: 1.00,
          bundles: [
            { plays: 5, price: 4.00, label: "5 Plays", savings: 1.00, savingsPercent: 20 },
            { plays: 10, price: 7.50, label: "10 Plays", savings: 2.50, savingsPercent: 25 },
          ],
          template_name: null,
          has_bundles: true,
        } as ArcadePricing;
      }

      const { data, error } = await supabase.functions.invoke("arcade-machine-info", {
        body: { machine_id: machineInfo.id }
      });

      if (error) throw error;
      return data?.pricing as ArcadePricing;
    },
    enabled: isArcade && !!machineInfo?.id,
  });

  // Fetch vending categories
  const { data: vendingCategories } = useQuery({
    queryKey: ["kiosk-categories", machineInfo?.id],
    queryFn: async () => {
      if (!machineInfo?.id || machineId === "demo") return null;

      const { data, error } = await supabase
        .from("machine_kiosk_categories")
        .select("id, category_name, base_price, display_order")
        .eq("machine_id", machineInfo.id)
        .eq("is_active", true)
        .order("display_order");

      if (error) throw error;
      return data as KioskCategory[];
    },
    enabled: !isArcade && !!machineInfo?.id,
  });

  // Verify TOTP code
  const verifyCode = useCallback(async (code: string): Promise<boolean> => {
    setIsVerifying(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke("vendx-pay-session", {
        body: {
          action: "verify_totp",
          totp_code: code,
          machine_id: machineInfo?.id || ""
        }
      });

      if (error) {
        setError("Connection error. Please try again.");
        return false;
      }

      if (!data?.success) {
        setError(data?.error || "Invalid code. Please try again.");
        return false;
      }

      setSession({
        sessionId: data.session_code || "",
        userId: data.user_id || "",
        userName: data.user_name || "Customer",
        walletBalance: data.balance || 0,
        ticketBalance: data.ticket_balance || 0,
      });

      return true;
    } catch (err) {
      console.error("Kiosk verification error:", err);
      setError("Connection error. Please try again.");
      return false;
    } finally {
      setIsVerifying(false);
    }
  }, [machineInfo, machineId]);

  // Process vending purchase
  const processVendingPurchase = useCallback(async (amount: number, itemName: string): Promise<PurchaseResult | null> => {
    if (!session) return null;
    setIsVerifying(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke("vendx-pay-process", {
        body: {
          session_code: session.sessionId,
          amount,
          item_name: itemName,
          machine_id: machineInfo?.id || ""
        }
      });

      if (error || !data?.success) {
        setError(data?.error || "Payment failed. Please try again.");
        return null;
      }

      const result: PurchaseResult = {
        type: "vending",
        amount,
        newBalance: data.new_balance,
        pointsEarned: data.points_earned || 0,
        itemName,
      };

      // Update session balance
      setSession(prev => prev ? {
        ...prev,
        walletBalance: data.new_balance
      } : null);
      
      setLastPurchase(result);
      return result;
    } catch (err) {
      setError("Connection error. Please try again.");
      return null;
    } finally {
      setIsVerifying(false);
    }
  }, [session, machineInfo, machineId]);

  // Process arcade play purchase
  const processArcadePurchase = useCallback(async (plays: number, amount: number, bundleLabel?: string): Promise<PurchaseResult | null> => {
    if (!session) return null;
    setIsVerifying(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke("arcade-play-purchase", {
        body: {
          machine_id: machineInfo?.id || "demo",
          plays,
          amount,
          pricing_type: bundleLabel ? "bundle" : "single",
          payment_method: "wallet",
          session_code: session.sessionId
        }
      });

      if (error || !data?.success) {
        setError(data?.error || "Purchase failed. Please try again.");
        return null;
      }

      const result: PurchaseResult = {
        type: "arcade",
        amount: data.amount_charged,
        newBalance: data.new_balance,
        pointsEarned: data.points_earned || 0,
        playsGranted: data.plays_purchased,
        bundleLabel: data.pricing_label,
      };

      // Update session balance
      setSession(prev => prev ? {
        ...prev,
        walletBalance: data.new_balance
      } : null);

      setLastPurchase(result);
      return result;
    } catch (err) {
      setError("Connection error. Please try again.");
      return null;
    } finally {
      setIsVerifying(false);
    }
  }, [session, machineInfo]);

  const clearSession = useCallback(() => {
    setSession(null);
    setError(null);
    setLastPurchase(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    machineInfo,
    machineLoading,
    isArcade,
    arcadePricing,
    vendingCategories,
    session,
    isVerifying,
    error,
    lastPurchase,
    verifyCode,
    processVendingPurchase,
    processArcadePurchase,
    clearSession,
    clearError,
  };
};
