import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Leaf, Lock, CreditCard, Wallet, Loader2, TreePine } from "lucide-react";
import { toast } from "sonner";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import EcoSnackPostPaymentFlow from "@/components/ecosnack/EcoSnackPostPaymentFlow";

interface LockerItem {
  locker_number: string;
  item_name: string;
  price: number;
  available: boolean;
}

const EcoSnackCheckoutPage = () => {
  const { machineCode } = useParams<{ machineCode: string }>();
  const [searchParams] = useSearchParams();
  const [selectedLocker, setSelectedLocker] = useState<LockerItem | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "stripe">("stripe");
  const [isProcessing, setIsProcessing] = useState(false);
  const [lockerCode, setLockerCode] = useState<string | null>(null);
  const [purchaseComplete, setPurchaseComplete] = useState(false);

  const canceled = searchParams.get("canceled");

  useEffect(() => {
    if (canceled) toast.error("Payment was canceled.");
  }, [canceled]);

  // Fetch machine info
  const { data: machine, isLoading: machineLoading } = useQuery({
    queryKey: ["ecosnack-machine", machineCode],
    queryFn: async () => {
      if (!machineCode) return null;
      const { data, error } = await supabase
        .from("vendx_machines")
        .select("id, name, machine_code, machine_type, status, location:locations(name, city, address)")
        .eq("machine_code", machineCode)
        .eq("machine_type", "ecosnack")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!machineCode,
  });

  // Fetch inventory for this machine
  const { data: inventory } = useQuery({
    queryKey: ["ecosnack-inventory", machine?.id],
    queryFn: async () => {
      if (!machine?.id) return [];
      const { data, error } = await supabase
        .from("machine_inventory")
        .select("*")
        .eq("machine_id", machine.id)
        .gt("quantity", 0)
        .order("slot_number");
      if (error) throw error;
      return (data || []).map(item => ({
        locker_number: item.slot_number || "01",
        item_name: item.product_name,
        price: item.unit_price,
        available: item.quantity > 0,
      })) as LockerItem[];
    },
    enabled: !!machine?.id,
  });

  // Check auth for wallet option
  const { data: session } = useQuery({
    queryKey: ["auth-session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const handlePurchase = async () => {
    if (!selectedLocker || !machineCode) return;
    setIsProcessing(true);

    try {
      if (paymentMethod === "wallet") {
        const { data, error } = await supabase.functions.invoke("ecosnack-checkout", {
          body: {
            action: "wallet_purchase",
            machine_code: machineCode,
            locker_number: selectedLocker.locker_number,
            item_name: selectedLocker.item_name,
            amount: selectedLocker.price,
          },
        });

        if (error) {
          const errorBody = error?.context ? await error.context.json().catch(() => null) : null;
          toast.error(errorBody?.error || "Insufficient wallet balance. Please load funds or use a card.");
          return;
        }
        if (!data?.success) {
          toast.error(data?.error || "Payment failed");
          return;
        }

        setLockerCode(data.locker_code);
        setPurchaseComplete(true);
        toast.success("Payment successful!");
      } else {
        const { data, error } = await supabase.functions.invoke("ecosnack-checkout", {
          body: {
            action: "stripe_checkout",
            machine_code: machineCode,
            locker_number: selectedLocker.locker_number,
            item_name: selectedLocker.item_name,
            amount: selectedLocker.price,
          },
        });

        if (error || !data?.url) {
          toast.error(data?.error || "Could not create checkout session");
          return;
        }

        window.location.href = data.url;
      }
    } catch (err) {
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const copyCode = () => {
    if (lockerCode) {
      navigator.clipboard.writeText(lockerCode);
      toast.success("Code copied!");
    }
  };

  if (machineLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!machine) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 pt-32 pb-16 text-center">
          <TreePine className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Machine Not Found</h1>
          <p className="text-muted-foreground">This EcoSnack machine doesn't exist or isn't available.</p>
        </div>
        <Footer />
      </div>
    );
  }

  // Success screen
  if (purchaseComplete && lockerCode && selectedLocker) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 pt-32 pb-16 flex items-center justify-center">
          <EcoSnackPostPaymentFlow
            lockerCode={lockerCode}
            lockerNumber={selectedLocker.locker_number}
            itemName={selectedLocker.item_name}
            machineCode={machineCode || ""}
          />
        </div>
        <Footer />
      </div>
    );
  }

  const lockerItems = inventory || [];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 pt-28 pb-16">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
              <Leaf className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{machine.name}</h1>
              <p className="text-sm text-muted-foreground">
                {(machine.location as any)?.name || (machine.location as any)?.city || "EcoSnack Nature Trail Machine"}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="border-accent/50 text-accent">
            <Leaf className="h-3 w-3 mr-1" /> EcoSnack
          </Badge>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Locker grid */}
          <div className="lg:col-span-2">
            <h2 className="text-lg font-semibold text-foreground mb-4">Select a Locker</h2>
            {lockerItems.length === 0 ? (
              <Card className="border-border bg-card">
                <CardContent className="py-12 text-center">
                  <Lock className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No items currently stocked in this machine.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {lockerItems.map((item) => (
                  <button
                    key={item.locker_number}
                    onClick={() => item.available && setSelectedLocker(item)}
                    disabled={!item.available}
                    className={`
                      relative p-4 rounded-xl border-2 transition-all text-left
                      ${selectedLocker?.locker_number === item.locker_number
                        ? "border-accent bg-accent/10 shadow-[0_0_15px_hsl(var(--accent)/0.3)]"
                        : item.available
                          ? "border-border bg-card hover:border-accent/50 hover:bg-accent/5"
                          : "border-border/50 bg-muted/50 opacity-50 cursor-not-allowed"
                      }
                    `}
                  >
                    <span className="text-xs font-mono text-accent font-bold">
                      #{item.locker_number.padStart(2, "0")}
                    </span>
                    <Lock className={`h-6 w-6 my-2 ${
                      selectedLocker?.locker_number === item.locker_number ? "text-accent" : "text-muted-foreground"
                    }`} />
                    <p className="text-xs font-medium text-foreground truncate">{item.item_name}</p>
                    <p className="text-xs text-accent font-semibold">${item.price.toFixed(2)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Checkout panel */}
          <div>
            <Card className="border-border bg-card sticky top-24">
              <CardHeader>
                <CardTitle className="text-lg">Checkout</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedLocker ? (
                  <>
                    <div className="bg-muted rounded-lg p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Item</span>
                        <span className="text-foreground font-medium">{selectedLocker.item_name}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Locker</span>
                        <span className="text-foreground font-medium">#{selectedLocker.locker_number.padStart(2, "0")}</span>
                      </div>
                      <div className="border-t border-border pt-2 flex justify-between">
                        <span className="font-semibold text-foreground">Total</span>
                        <span className="font-bold text-accent text-lg">${selectedLocker.price.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Payment method */}
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">Payment Method</p>
                      <button
                        onClick={() => setPaymentMethod("stripe")}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                          paymentMethod === "stripe"
                            ? "border-accent bg-accent/10"
                            : "border-border hover:border-accent/50"
                        }`}
                      >
                        <CreditCard className="h-5 w-5 text-accent" />
                        <span className="text-sm text-foreground">Debit / Credit Card</span>
                      </button>
                      {session && (
                        <button
                          onClick={() => setPaymentMethod("wallet")}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                            paymentMethod === "wallet"
                              ? "border-accent bg-accent/10"
                              : "border-border hover:border-accent/50"
                          }`}
                        >
                          <Wallet className="h-5 w-5 text-accent" />
                          <span className="text-sm text-foreground">VendX Pay Wallet</span>
                        </button>
                      )}
                    </div>

                    <Button
                      onClick={handlePurchase}
                      disabled={isProcessing}
                      className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold"
                    >
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Lock className="h-4 w-4 mr-2" />
                      )}
                      {isProcessing ? "Processing..." : `Pay $${selectedLocker.price.toFixed(2)}`}
                    </Button>

                    <p className="text-xs text-center text-muted-foreground">
                      After payment, you'll receive a 3-digit code to unlock your locker.
                    </p>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Lock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Select a locker to continue</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default EcoSnackCheckoutPage;
