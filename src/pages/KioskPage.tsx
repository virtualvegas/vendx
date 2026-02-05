import { useState } from "react";
import { KioskNumpad } from "@/components/kiosk/KioskNumpad";
import { KioskVerifying } from "@/components/kiosk/KioskVerifying";
import { KioskArcadeMode } from "@/components/kiosk/KioskArcadeMode";
import { KioskVendingMode } from "@/components/kiosk/KioskVendingMode";
import { KioskError } from "@/components/kiosk/KioskError";
import { KioskSuccess, type PurchaseResult } from "@/components/kiosk/KioskSuccess";
import { KioskMachineLoading } from "@/components/kiosk/KioskMachineLoading";
import { KioskMachineOffline } from "@/components/kiosk/KioskMachineOffline";
import { useKiosk } from "@/hooks/useKiosk";

type KioskState = "idle" | "entering" | "verifying" | "active" | "error" | "success";

const KioskPage = () => {
  const [state, setState] = useState<KioskState>("idle");
  const [code, setCode] = useState("");
  const [purchaseResult, setPurchaseResult] = useState<PurchaseResult | undefined>(undefined);

  // Get machine ID from URL or use demo
  const machineId = new URLSearchParams(window.location.search).get("machine") || "demo";

  const {
    machineInfo,
    machineLoading,
    isArcade,
    arcadePricing,
    vendingCategories,
    session,
    isVerifying,
    error,
    verifyCode,
    processVendingPurchase,
    processArcadePurchase,
    clearSession,
    clearError,
  } = useKiosk(machineId);

  const handleCodeSubmit = async (submittedCode: string) => {
    setState("verifying");
    const success = await verifyCode(submittedCode);
    if (success) {
      setState("active");
    } else {
      setState("error");
    }
  };

  const handleStartOver = () => {
    setCode("");
    setPurchaseResult(undefined);
    clearSession();
    clearError();
    setState("idle");
  };

  const handleVendingPurchase = async (amount: number, itemName: string): Promise<boolean> => {
    setState("verifying");
    const result = await processVendingPurchase(amount, itemName);
    if (result) {
      setPurchaseResult(result);
      setState("success");
      setTimeout(handleStartOver, 5000);
      return true;
    } else {
      setState("error");
      return false;
    }
  };

  const handleArcadePurchase = async (plays: number, amount: number, bundleLabel?: string): Promise<boolean> => {
    const result = await processArcadePurchase(plays, amount, bundleLabel);
    if (result) {
      setPurchaseResult(result);
      setState("success");
      setTimeout(handleStartOver, 5000);
      return true;
    }
    return false;
  };

  // Loading state for machine info
  if (machineLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <KioskMachineLoading />
      </div>
    );
  }

  // Machine not found or offline
  if (!machineInfo || machineInfo.status !== "active") {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <KioskMachineOffline 
          machineCode={machineId}
          reason={!machineInfo ? "not_found" : "offline"}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Idle - Tap to Pay screen */}
      {state === "idle" && (
        <KioskNumpad 
          code={code} 
          setCode={setCode} 
          onSubmit={handleCodeSubmit}
          onStart={() => setState("entering")}
        />
      )}

      {/* Entering code */}
      {state === "entering" && (
        <KioskNumpad 
          code={code} 
          setCode={setCode} 
          onSubmit={handleCodeSubmit}
          isEntering
          onCancel={handleStartOver}
        />
      )}

      {/* Verifying code */}
      {state === "verifying" && <KioskVerifying />}

      {/* Active session - show appropriate mode */}
      {state === "active" && session && (
        isArcade ? (
          <KioskArcadeMode
            session={session}
            machineName={machineInfo.name}
            pricing={arcadePricing}
            onPurchase={handleArcadePurchase}
            onCancel={handleStartOver}
            isProcessing={isVerifying}
          />
        ) : (
          <KioskVendingMode
            session={session}
            machineName={machineInfo.name}
            categories={vendingCategories}
            onPurchase={handleVendingPurchase}
            onCancel={handleStartOver}
            isProcessing={isVerifying}
          />
        )
      )}

      {/* Error state */}
      {state === "error" && (
        <KioskError message={error || "An error occurred"} onRetry={handleStartOver} />
      )}

      {/* Success state */}
      {state === "success" && (
        <KioskSuccess result={purchaseResult} onDone={handleStartOver} />
      )}
    </div>
  );
};

export default KioskPage;
