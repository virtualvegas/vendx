import { useState } from "react";
import { KioskNumpad } from "@/components/kiosk/KioskNumpad";
import { KioskVerifying } from "@/components/kiosk/KioskVerifying";
import { KioskWelcome } from "@/components/kiosk/KioskWelcome";
import { KioskError } from "@/components/kiosk/KioskError";
import { KioskSuccess } from "@/components/kiosk/KioskSuccess";
import { supabase } from "@/integrations/supabase/client";

type KioskState = "idle" | "entering" | "verifying" | "welcome" | "error" | "success";

interface SessionData {
  sessionId: string;
  userId: string;
  userName: string;
  walletBalance: number;
}

const KioskPage = () => {
  const [state, setState] = useState<KioskState>("idle");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [session, setSession] = useState<SessionData | null>(null);

  // Get machine ID from URL or use demo
  const machineId = new URLSearchParams(window.location.search).get("machine") || "demo";

  const handleCodeSubmit = async (submittedCode: string) => {
    setState("verifying");
    
    try {
      const { data, error } = await supabase.functions.invoke("vendx-pay-session", {
        body: {
          action: "verify",
          machine_id: machineId,
          totp_code: submittedCode
        }
      });

      if (error || !data?.success) {
        setError(data?.error || "Invalid code. Please try again.");
        setState("error");
        return;
      }

      setSession({
        sessionId: data.session_id,
        userId: data.user_id,
        userName: data.user_name || "Customer",
        walletBalance: data.wallet_balance || 0
      });
      setState("welcome");
    } catch (err) {
      setError("Connection error. Please try again.");
      setState("error");
    }
  };

  const handleStartOver = () => {
    setCode("");
    setError("");
    setSession(null);
    setState("idle");
  };

  const handlePurchase = async (amount: number, itemName: string) => {
    if (!session) return;

    setState("verifying");
    
    try {
      const { data, error } = await supabase.functions.invoke("vendx-pay-process", {
        body: {
          session_id: session.sessionId,
          amount,
          item_name: itemName
        }
      });

      if (error || !data?.success) {
        setError(data?.error || "Payment failed. Please try again.");
        setState("error");
        return;
      }

      setState("success");
      setTimeout(handleStartOver, 5000);
    } catch (err) {
      setError("Connection error. Please try again.");
      setState("error");
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {state === "idle" && (
        <KioskNumpad 
          code={code} 
          setCode={setCode} 
          onSubmit={handleCodeSubmit}
          onStart={() => setState("entering")}
        />
      )}
      {state === "entering" && (
        <KioskNumpad 
          code={code} 
          setCode={setCode} 
          onSubmit={handleCodeSubmit}
          isEntering
          onCancel={handleStartOver}
        />
      )}
      {state === "verifying" && <KioskVerifying />}
      {state === "welcome" && session && (
        <KioskWelcome 
          userName={session.userName}
          balance={session.walletBalance}
          onPurchase={handlePurchase}
          onCancel={handleStartOver}
        />
      )}
      {state === "error" && (
        <KioskError message={error} onRetry={handleStartOver} />
      )}
      {state === "success" && <KioskSuccess onDone={handleStartOver} />}
    </div>
  );
};

export default KioskPage;
