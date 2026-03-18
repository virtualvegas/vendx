import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Leaf, Lock, CreditCard, Wallet, Loader2, TreePine, ChevronUp, X } from "lucide-react";
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
  const [checkoutExpanded, setCheckoutExpanded] = useState(false);

  const canceled = searchParams.get("canceled");

  useEffect(() => {
    if (canceled) toast.error("Payment was canceled.");
  }, [canceled]);

  // Auto-expand checkout on mobile when locker selected
  useEffect(() => {
    if (selectedLocker) setCheckoutExpanded(true);
  }, [selectedLocker]);

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
        <div className="container mx-auto px-4 pt-24 pb-16 text-center">
          <TreePine className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <h1 className="text-xl font-bold text-foreground mb-2">Machine Not Found</h1>
          <p className="text-sm text-muted-foreground">This EcoVend machine doesn't exist or isn't available.</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (purchaseComplete && lockerCode && selectedLocker) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 pt-24 pb-16 flex items-center justify-center">
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
      
      {/* Main content - extra bottom padding on mobile for sticky checkout */}
      <div className="container mx-auto px-3 sm:px-4 pt-20 sm:pt-28 pb-48 sm:pb-16">
        {/* Header - compact on mobile */}
        <div className="mb-4 sm:mb-8">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
              <Leaf className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-foreground truncate">{machine.name}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                {(machine.location as any)?.name || (machine.location as any)?.city || "EcoVend Machine"}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="border-accent/50 text-accent text-xs">
            <Leaf className="h-3 w-3 mr-1" /> EcoVend
          </Badge>
        </div>

        <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Locker grid - optimized for mobile */}
          <div className="lg:col-span-2">
            <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">Select a Locker</h2>
            {lockerItems.length === 0 ? (
              <div className="border border-border bg-card rounded-xl py-10 text-center">
                <Lock className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No items currently stocked.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
                {lockerItems.map((item) => (
                  <button
                    key={item.locker_number}
                    onClick={() => item.available && setSelectedLocker(item)}
                    disabled={!item.available}
                    className={`
                      relative p-3 sm:p-4 rounded-xl border-2 transition-all text-left active:scale-95
                      ${selectedLocker?.locker_number === item.locker_number
                        ? "border-accent bg-accent/10 shadow-[0_0_15px_hsl(var(--accent)/0.3)]"
                        : item.available
                          ? "border-border bg-card hover:border-accent/50 active:bg-accent/5"
                          : "border-border/50 bg-muted/50 opacity-50 cursor-not-allowed"
                      }
                    `}
                  >
                    <div className="flex items-center justify-between sm:block">
                      <div>
                        <span className="text-xs font-mono text-accent font-bold">
                          #{item.locker_number.padStart(2, "0")}
                        </span>
                        <Lock className={`h-5 w-5 sm:h-6 sm:w-6 my-1 sm:my-2 ${
                          selectedLocker?.locker_number === item.locker_number ? "text-accent" : "text-muted-foreground"
                        }`} />
                      </div>
                      <div className="text-right sm:text-left">
                        <p className="text-xs font-medium text-foreground truncate max-w-[100px] sm:max-w-full">{item.item_name}</p>
                        <p className="text-sm sm:text-xs text-accent font-bold">${item.price.toFixed(2)}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Desktop checkout panel - hidden on mobile */}
          <div className="hidden lg:block">
            <div className="border border-border bg-card rounded-xl sticky top-24 p-5">
              <h3 className="text-lg font-semibold text-foreground mb-4">Checkout</h3>
              <CheckoutContent
                selectedLocker={selectedLocker}
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                session={session}
                isProcessing={isProcessing}
                handlePurchase={handlePurchase}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky checkout bottom sheet */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50">
        {/* Collapsed bar - always visible when locker selected */}
        {selectedLocker && !checkoutExpanded && (
          <button
            onClick={() => setCheckoutExpanded(true)}
            className="w-full bg-card border-t border-border px-4 py-3 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                <Lock className="h-4 w-4 text-accent" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-foreground">{selectedLocker.item_name}</p>
                <p className="text-xs text-muted-foreground">Locker #{selectedLocker.locker_number.padStart(2, "0")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-accent">${selectedLocker.price.toFixed(2)}</span>
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            </div>
          </button>
        )}

        {/* Expanded checkout sheet */}
        {selectedLocker && checkoutExpanded && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setCheckoutExpanded(false)}
            />
            <div className="relative z-50 bg-card border-t border-border rounded-t-2xl px-4 pt-3 pb-6 max-h-[70vh] overflow-y-auto">
              {/* Handle bar */}
              <div className="flex justify-center mb-2">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              </div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-foreground">Checkout</h3>
                <button
                  onClick={() => setCheckoutExpanded(false)}
                  className="p-1 rounded-full hover:bg-muted"
                >
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <CheckoutContent
                selectedLocker={selectedLocker}
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                session={session}
                isProcessing={isProcessing}
                handlePurchase={handlePurchase}
              />
            </div>
          </>
        )}

        {/* No locker selected - prompt bar */}
        {!selectedLocker && (
          <div className="w-full bg-card/95 backdrop-blur-sm border-t border-border px-4 py-4 text-center">
            <p className="text-sm text-muted-foreground">Tap a locker above to start</p>
          </div>
        )}
      </div>

      <div className="hidden lg:block">
        <Footer />
      </div>
    </div>
  );
};

/* Shared checkout content used in both desktop sidebar and mobile bottom sheet */
const CheckoutContent = ({
  selectedLocker,
  paymentMethod,
  setPaymentMethod,
  session,
  isProcessing,
  handlePurchase,
}: {
  selectedLocker: LockerItem | null;
  paymentMethod: "wallet" | "stripe";
  setPaymentMethod: (m: "wallet" | "stripe") => void;
  session: any;
  isProcessing: boolean;
  handlePurchase: () => void;
}) => {
  if (!selectedLocker) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <Lock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Select a locker to continue</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Order summary */}
      <div className="bg-muted rounded-lg p-3 space-y-2">
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

      {/* Payment methods */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Payment Method</p>
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
        className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold h-12 text-base"
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Lock className="h-4 w-4 mr-2" />
        )}
        {isProcessing ? "Processing..." : `Pay $${selectedLocker.price.toFixed(2)}`}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        You'll receive a 3-digit code to unlock your locker.
      </p>
    </div>
  );
};

export default EcoSnackCheckoutPage;
