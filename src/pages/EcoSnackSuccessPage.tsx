import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Copy, Lock, Loader2, Leaf } from "lucide-react";
import { toast } from "sonner";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const EcoSnackSuccessPage = () => {
  const [searchParams] = useSearchParams();
  const purchaseId = searchParams.get("purchase_id");
  const lockerNum = searchParams.get("locker");
  const [lockerCode, setLockerCode] = useState<string | null>(null);
  const [itemName, setItemName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!purchaseId) {
      setError("No purchase found.");
      setLoading(false);
      return;
    }

    const verify = async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke("ecosnack-checkout", {
          body: { action: "verify_payment", purchase_id: purchaseId },
        });

        if (fnError || !data?.success) {
          setError(data?.error || "Payment verification failed.");
        } else {
          setLockerCode(data.locker_code);
          setItemName(data.item_name || "");
        }
      } catch {
        setError("Could not verify payment.");
      } finally {
        setLoading(false);
      }
    };

    // Small delay for Stripe to process
    const timer = setTimeout(verify, 1500);
    return () => clearTimeout(timer);
  }, [purchaseId]);

  const copyCode = () => {
    if (lockerCode) {
      navigator.clipboard.writeText(lockerCode);
      toast.success("Code copied!");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 pt-32 pb-16 flex items-center justify-center">
        <Card className="max-w-md w-full border-accent/30 bg-card">
          <CardContent className="pt-8 pb-8 text-center space-y-6">
            {loading ? (
              <div className="space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-accent mx-auto" />
                <p className="text-muted-foreground">Verifying your payment...</p>
              </div>
            ) : error ? (
              <div className="space-y-4">
                <div className="w-20 h-20 mx-auto rounded-full bg-destructive/20 flex items-center justify-center">
                  <Lock className="h-10 w-10 text-destructive" />
                </div>
                <p className="text-destructive">{error}</p>
              </div>
            ) : (
              <>
                <div className="w-20 h-20 mx-auto rounded-full bg-accent/20 flex items-center justify-center">
                  <CheckCircle className="h-10 w-10 text-accent" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-1">Payment Successful!</h2>
                  <p className="text-muted-foreground">Your locker is ready to open</p>
                </div>
                <div className="bg-muted rounded-xl p-6 space-y-3">
                  <p className="text-sm text-muted-foreground uppercase tracking-wider">Your Locker Code</p>
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-5xl font-mono font-bold tracking-[0.3em] text-accent">
                      {lockerCode}
                    </span>
                    <Button variant="ghost" size="icon" onClick={copyCode}>
                      <Copy className="h-5 w-5" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Lock className="h-4 w-4" />
                    <span>Locker #{lockerNum?.padStart(2, "0")}</span>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  {itemName && <p><strong className="text-foreground">{itemName}</strong></p>}
                  <p>Enter the 3-digit code on the locker dial to unlock your item.</p>
                  <p className="text-xs">Code expires in 24 hours.</p>
                </div>
                <Badge />
              </>
            )}
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
};

// Quick badge component for branding
const Badge = () => (
  <div className="flex items-center justify-center gap-1 text-xs text-accent/60 pt-2">
    <Leaf className="h-3 w-3" />
    <span>EcoSnack by VendX</span>
  </div>
);

export default EcoSnackSuccessPage;
