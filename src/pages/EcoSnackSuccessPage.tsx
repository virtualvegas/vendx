import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, Loader2 } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import EcoSnackPostPaymentFlow from "@/components/ecosnack/EcoSnackPostPaymentFlow";

const EcoSnackSuccessPage = () => {
  const [searchParams] = useSearchParams();
  const purchaseId = searchParams.get("purchase_id");
  const lockerNum = searchParams.get("locker");
  const [purchaseData, setPurchaseData] = useState<{
    locker_code: string;
    locker_number: string;
    item_name: string;
    machine_code: string;
  } | null>(null);
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
          setPurchaseData({
            locker_code: data.locker_code,
            locker_number: data.locker_number || lockerNum || "?",
            item_name: data.item_name || "",
            machine_code: data.machine_code || "",
          });
        }
      } catch {
        setError("Could not verify payment.");
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(verify, 1500);
    return () => clearTimeout(timer);
  }, [purchaseId, lockerNum]);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 pt-32 pb-16 flex items-center justify-center">
        {loading ? (
          <Card className="max-w-md w-full border-accent/30 bg-card">
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-accent mx-auto" />
              <p className="text-muted-foreground">Verifying your payment...</p>
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="max-w-md w-full border-accent/30 bg-card">
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <div className="w-20 h-20 mx-auto rounded-full bg-destructive/20 flex items-center justify-center">
                <Lock className="h-10 w-10 text-destructive" />
              </div>
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        ) : purchaseData ? (
          <EcoSnackPostPaymentFlow
            lockerCode={purchaseData.locker_code}
            lockerNumber={purchaseData.locker_number}
            itemName={purchaseData.item_name}
            machineCode={purchaseData.machine_code}
            purchaseId={purchaseId || undefined}
          />
        ) : null}
      </div>
      <Footer />
    </div>
  );
};

export default EcoSnackSuccessPage;
