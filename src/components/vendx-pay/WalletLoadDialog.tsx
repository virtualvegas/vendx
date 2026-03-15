import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, DollarSign, Wallet, Gift, CheckCircle } from "lucide-react";
import PaymentMethodSelector, { PaymentMethod } from "@/components/payment/PaymentMethodSelector";

interface WalletLoadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRESET_AMOUNTS = [10, 25, 50, 100];

const WalletLoadDialog = ({ open, onOpenChange }: WalletLoadDialogProps) => {
  const [amount, setAmount] = useState<number>(25);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("stripe");
  const [giftCardCode, setGiftCardCode] = useState("");
  const [giftCardSuccess, setGiftCardSuccess] = useState<{ amount: number; balance: number } | null>(null);
  const { toast } = useToast();

  const handleLoadWallet = async () => {
    const finalAmount = customAmount ? parseFloat(customAmount) : amount;
    
    if (!finalAmount || finalAmount < 5 || finalAmount > 500) {
      toast({
        title: "Invalid Amount",
        description: "Please enter an amount between $5 and $500.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Not Logged In",
          description: "Please log in to load your wallet.",
          variant: "destructive",
        });
        return;
      }

      const functionName = paymentMethod === "paypal" 
        ? "vendx-pay-paypal-checkout" 
        : "vendx-pay-create-checkout";
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { amount: finalAmount },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (error: unknown) {
      console.error("Error creating checkout:", error);
      toast({
        title: "Error",
        description: "Failed to create checkout session. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRedeemGiftCard = async () => {
    if (!giftCardCode.trim()) {
      toast({ title: "Enter Code", description: "Please enter a gift card code.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Not Logged In", description: "Please log in first.", variant: "destructive" });
        return;
      }

      const { data, error } = await supabase.functions.invoke("redeem-gift-card", {
        body: { code: giftCardCode.trim() },
      });

      if (error) throw error;

      if (data?.success) {
        setGiftCardSuccess({ amount: data.amount, balance: data.new_balance });
        setGiftCardCode("");
        toast({ title: "Gift Card Redeemed!", description: data.message });
      } else {
        throw new Error(data?.error || "Failed to redeem gift card");
      }
    } catch (error: any) {
      const msg = error?.message || "Failed to redeem gift card.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (val: boolean) => {
    if (!val) {
      setGiftCardSuccess(null);
      setGiftCardCode("");
    }
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Add Funds to Wallet
          </DialogTitle>
          <DialogDescription>
            Add funds via payment or redeem a VendX gift card.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="payment" className="w-full">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="payment" className="gap-2">
              <DollarSign className="w-4 h-4" />
              Payment
            </TabsTrigger>
            <TabsTrigger value="giftcard" className="gap-2">
              <Gift className="w-4 h-4" />
              Gift Card
            </TabsTrigger>
          </TabsList>

          <TabsContent value="payment" className="space-y-6 py-4">
            {/* Preset amounts */}
            <div className="grid grid-cols-4 gap-3">
              {PRESET_AMOUNTS.map((preset) => (
                <Button
                  key={preset}
                  variant={amount === preset && !customAmount ? "default" : "outline"}
                  onClick={() => {
                    setAmount(preset);
                    setCustomAmount("");
                  }}
                  className="h-14 text-lg font-semibold"
                >
                  ${preset}
                </Button>
              ))}
            </div>

            {/* Custom amount */}
            <div className="space-y-2">
              <Label htmlFor="custom-amount">Or enter a custom amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="custom-amount"
                  type="number"
                  placeholder="Custom amount"
                  min={5}
                  max={500}
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="pl-10 text-lg h-12"
                />
              </div>
            </div>

            {/* Summary */}
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Amount to add:</span>
                <span className="text-2xl font-bold">
                  ${(customAmount ? parseFloat(customAmount) || 0 : amount).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Payment Method Selection */}
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <PaymentMethodSelector
                selected={paymentMethod}
                onSelect={setPaymentMethod}
                disabled={loading}
                showVendxPay={false}
              />
            </div>

            <Button
              onClick={handleLoadWallet}
              disabled={loading}
              className="w-full h-12 text-lg"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {paymentMethod === "stripe" ? "Pay with Card" : "Pay with PayPal"}
                </>
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Secure payment. Your payment details are never stored on our servers.
            </p>
          </TabsContent>

          <TabsContent value="giftcard" className="space-y-6 py-4">
            {giftCardSuccess ? (
              <div className="text-center space-y-4 py-6">
                <CheckCircle className="w-16 h-16 text-primary mx-auto" />
                <h3 className="text-xl font-bold">Gift Card Redeemed!</h3>
                <p className="text-muted-foreground">
                  <span className="text-2xl font-bold text-foreground">${giftCardSuccess.amount.toFixed(2)}</span> added to your wallet
                </p>
                <p className="text-sm text-muted-foreground">
                  New balance: <span className="font-semibold">${giftCardSuccess.balance.toFixed(2)}</span>
                </p>
                <Button onClick={() => handleClose(false)} className="w-full">Done</Button>
              </div>
            ) : (
              <>
                <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-xl p-6 text-center border border-primary/20">
                  <Gift className="w-12 h-12 text-primary mx-auto mb-3" />
                  <h3 className="font-semibold text-lg mb-1">Have a VendX Gift Card?</h3>
                  <p className="text-sm text-muted-foreground">Enter your code below to add funds to your wallet</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gift-code">Gift Card Code</Label>
                  <Input
                    id="gift-code"
                    placeholder="VXG-XXXX-XXXX-XXXX"
                    value={giftCardCode}
                    onChange={(e) => setGiftCardCode(e.target.value.toUpperCase())}
                    className="text-center text-lg font-mono tracking-wider h-14"
                    maxLength={24}
                  />
                </div>

                <Button
                  onClick={handleRedeemGiftCard}
                  disabled={loading || !giftCardCode.trim()}
                  className="w-full h-12 text-lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Redeeming...
                    </>
                  ) : (
                    <>
                      <Gift className="w-5 h-5 mr-2" />
                      Redeem Gift Card
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Gift cards are one-time use and the full value will be added to your wallet.
                </p>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default WalletLoadDialog;
