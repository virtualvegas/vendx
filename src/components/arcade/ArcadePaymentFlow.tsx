import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Gamepad2, Wallet, Check, AlertCircle, Sparkles, MapPin } from "lucide-react";

interface PriceBundle {
  plays: number;
  price: number;
  label: string;
  savings: number;
  savingsPercent: number;
}

interface MachineInfo {
  id: string;
  name: string;
  machine_code: string;
  machine_type: string;
  status: string;
  location?: {
    id: string;
    name: string | null;
    city: string;
    address: string | null;
  };
}

interface PricingInfo {
  price_per_play: number;
  bundles: PriceBundle[];
  template_name: string | null;
  has_bundles: boolean;
}

interface ArcadePaymentFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  machineId?: string;
  machineCode?: string;
  childWalletId?: string;
  onSuccess?: (sessionId: string, plays: number) => void;
}

type FlowState = "loading" | "select" | "processing" | "success" | "error";

export const ArcadePaymentFlow = ({
  open,
  onOpenChange,
  machineId,
  machineCode,
  childWalletId,
  onSuccess,
}: ArcadePaymentFlowProps) => {
  const [state, setState] = useState<FlowState>("loading");
  const [machine, setMachine] = useState<MachineInfo | null>(null);
  const [pricing, setPricing] = useState<PricingInfo | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [selectedOption, setSelectedOption] = useState<"single" | number>("single");
  const [result, setResult] = useState<{
    plays: number;
    newBalance: number;
    pointsEarned: number;
    sessionId: string;
  } | null>(null);
  const [error, setError] = useState("");
  const { toast } = useToast();

  // Fetch machine info when dialog opens
  useEffect(() => {
    if (!open) return;
    
    const fetchMachineInfo = async () => {
      setState("loading");
      setError("");

      try {
        // Get machine info
        const { data: machineData, error: machineError } = await supabase.functions.invoke(
          "arcade-machine-info",
          {
            body: { machine_id: machineId, machine_code: machineCode },
          }
        );

        if (machineError || !machineData?.success) {
          throw new Error(machineData?.error || "Failed to load machine info");
        }

        setMachine(machineData.machine);
        setPricing(machineData.pricing);

        if (!machineData.available) {
          setError("This machine is currently unavailable");
          setState("error");
          return;
        }

        // Get wallet balance
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError("Please sign in to continue");
          setState("error");
          return;
        }

        let walletBalanceRow: { balance: number } | null = null;

        if (childWalletId) {
          const { data: childWallet, error: childWalletError } = await supabase
            .from("wallets")
            .select("balance")
            .eq("id", childWalletId)
            .eq("user_id", user.id)
            .eq("wallet_type", "child")
            .maybeSingle();
          if (childWalletError) throw childWalletError;
          walletBalanceRow = childWallet;
        } else {
          const { data: parentWallet, error: parentWalletError } = await supabase
            .from("wallets")
            .select("balance")
            .eq("user_id", user.id)
            .in("wallet_type", ["standard", "guest"])
            .is("parent_wallet_id", null)
            .maybeSingle();
          if (parentWalletError) throw parentWalletError;
          walletBalanceRow = parentWallet;
        }

        setWalletBalance(walletBalanceRow?.balance || 0);
        setState("select");
      } catch (err: any) {
        console.error("Error fetching machine info:", err);
        setError(err.message || "Failed to load machine info");
        setState("error");
      }
    };

    fetchMachineInfo();
  }, [open, machineId, machineCode, childWalletId]);

  const handlePurchase = async () => {
    if (!machine || !pricing) return;

    setState("processing");

    try {
      const body: Record<string, unknown> = {
        machine_id: machine.id,
        pricing_type: selectedOption === "single" ? "single" : "template_bundle",
      };

      if (selectedOption !== "single") {
        body.bundle_index = selectedOption;
      }

      if (childWalletId) {
        body.child_wallet_id = childWalletId;
      }

      const { data, error } = await supabase.functions.invoke("arcade-play-purchase", {
        body,
      });

      if (error || !data?.success) {
        throw new Error(data?.error || "Purchase failed");
      }

      setResult({
        plays: data.plays_purchased,
        newBalance: data.new_balance,
        pointsEarned: data.points_earned,
        sessionId: data.session_id,
      });
      setState("success");

      toast({
        title: "Game Ready!",
        description: `${data.plays_purchased} play${data.plays_purchased > 1 ? "s" : ""} purchased. Start playing!`,
      });

      onSuccess?.(data.session_id, data.plays_purchased);
    } catch (err: any) {
      console.error("Purchase error:", err);
      setError(err.message || "Purchase failed");
      setState("error");
    }
  };

  const getSelectedPrice = () => {
    if (!pricing) return 0;
    if (selectedOption === "single") return pricing.price_per_play;
    return pricing.bundles[selectedOption as number]?.price || 0;
  };

  const getSelectedPlays = () => {
    if (!pricing) return 1;
    if (selectedOption === "single") return 1;
    return pricing.bundles[selectedOption as number]?.plays || 1;
  };

  const canAfford = walletBalance >= getSelectedPrice();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-purple-500" />
            Arcade Payment
          </DialogTitle>
        </DialogHeader>

        {state === "loading" && (
          <div className="py-12 flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            <p className="text-muted-foreground">Loading machine info...</p>
          </div>
        )}

        {state === "select" && machine && pricing && (
          <div className="space-y-4">
            {/* Machine Info */}
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{machine.name}</h3>
                    <p className="text-sm text-muted-foreground font-mono">{machine.machine_code}</p>
                    {machine.location && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" />
                        {machine.location.name || machine.location.city}
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary" className="capitalize">
                    {machine.machine_type}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Wallet Balance */}
            <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
              <span className="flex items-center gap-2 text-sm">
                <Wallet className="w-4 h-4 text-primary" />
                Wallet Balance
              </span>
              <span className="font-bold">${walletBalance.toFixed(2)}</span>
            </div>

            {/* Pricing Options */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Select Play Option:</p>
              
              {/* Single Play */}
              <button
                onClick={() => setSelectedOption("single")}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                  selectedOption === "single"
                    ? "border-purple-500 bg-purple-500/10"
                    : "border-border hover:border-purple-500/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Single Play</p>
                    <p className="text-sm text-muted-foreground">1 game play</p>
                  </div>
                  <p className="text-xl font-bold">${pricing.price_per_play.toFixed(2)}</p>
                </div>
              </button>

              {/* Bundles */}
              {pricing.bundles.map((bundle, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedOption(index)}
                  className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                    selectedOption === index
                      ? "border-purple-500 bg-purple-500/10"
                      : "border-border hover:border-purple-500/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{bundle.label}</p>
                        {bundle.savingsPercent > 0 && (
                          <Badge variant="secondary" className="bg-green-500/10 text-green-500 text-xs">
                            Save {bundle.savingsPercent}%
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{bundle.plays} game plays</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold">${bundle.price.toFixed(2)}</p>
                      {bundle.savings > 0 && (
                        <p className="text-xs text-muted-foreground line-through">
                          ${(pricing.price_per_play * bundle.plays).toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Purchase Button */}
            <Button
              className="w-full h-12 text-lg"
              onClick={handlePurchase}
              disabled={!canAfford}
            >
              {canAfford ? (
                <>
                  <Gamepad2 className="w-5 h-5 mr-2" />
                  Pay ${getSelectedPrice().toFixed(2)} for {getSelectedPlays()} Play{getSelectedPlays() > 1 ? "s" : ""}
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 mr-2" />
                  Insufficient Balance
                </>
              )}
            </Button>

            {!canAfford && (
              <p className="text-sm text-center text-muted-foreground">
                You need ${(getSelectedPrice() - walletBalance).toFixed(2)} more to purchase.
              </p>
            )}
          </div>
        )}

        {state === "processing" && (
          <div className="py-12 flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
            <p className="font-medium">Processing payment...</p>
            <p className="text-sm text-muted-foreground">Please wait</p>
          </div>
        )}

        {state === "success" && result && (
          <div className="py-8 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
              <Check className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-xl font-bold">Game Ready!</h3>
            <p className="text-muted-foreground">
              {result.plays} play{result.plays > 1 ? "s" : ""} purchased
            </p>

            <div className="w-full space-y-2 text-sm">
              <div className="flex justify-between p-2 bg-muted rounded">
                <span>New Balance</span>
                <span className="font-medium">${result.newBalance.toFixed(2)}</span>
              </div>
              {result.pointsEarned > 0 && (
                <div className="flex justify-between p-2 bg-accent/10 rounded">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-4 h-4 text-accent" />
                    Points Earned
                  </span>
                  <span className="font-medium text-accent">+{result.pointsEarned}</span>
                </div>
              )}
            </div>

            <Button className="w-full mt-4" onClick={() => onOpenChange(false)}>
              Start Playing!
            </Button>
          </div>
        )}

        {state === "error" && (
          <div className="py-8 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <h3 className="text-xl font-bold">Payment Failed</h3>
            <p className="text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={() => setState("select")} className="mt-4">
              Try Again
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
