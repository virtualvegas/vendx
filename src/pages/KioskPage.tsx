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
      // For demo mode, we'll simulate the verification on client side
      // In production, the kiosk would call the edge function with its API key
      if (machineId === "demo") {
        // Demo mode: verify locally by calling the session endpoint
        const { data, error } = await supabase.functions.invoke("vendx-pay-session", {
          body: {
            action: "verify_totp",
            totp_code: submittedCode
          },
          headers: {
            // Demo API key - in production this would be a real machine API key
            "x-machine-api-key": "demo-api-key"
          }
        });

        if (error) {
          console.error("Session error:", error);
          setError("Connection error. Please try again.");
          setState("error");
          return;
        }

        if (!data?.success) {
          setError(data?.error || "Invalid code. Please try again.");
          setState("error");
          return;
        }

        setSession({
          sessionId: data.session_code || "",
          userId: "",
          userName: "Customer",
          walletBalance: data.balance || 0
        });
        setState("welcome");
      } else {
        // Production mode would use the real machine API key
        setError("Machine not configured. Please contact support.");
        setState("error");
      }
    } catch (err) {
      console.error("Kiosk error:", err);
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
          session_code: session.sessionId,
          amount,
          item_name: itemName
        },
        headers: {
          "x-machine-api-key": "demo-api-key"
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
          machineId={machineId}
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
