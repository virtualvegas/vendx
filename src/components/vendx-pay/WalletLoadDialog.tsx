import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CreditCard, DollarSign } from "lucide-react";

interface WalletLoadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRESET_AMOUNTS = [10, 25, 50, 100];

const WalletLoadDialog = ({ open, onOpenChange }: WalletLoadDialogProps) => {
  const [amount, setAmount] = useState<number>(25);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [loading, setLoading] = useState(false);
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

      const { data, error } = await supabase.functions.invoke("vendx-pay-create-checkout", {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            Add Funds to Wallet
          </DialogTitle>
          <DialogDescription>
            Choose an amount to add to your VendX wallet. Minimum $5, maximum $500.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
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
                <CreditCard className="w-5 h-5 mr-2" />
                Pay with Card
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Secure payment powered by Stripe. Your card details are never stored on our servers.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WalletLoadDialog;
