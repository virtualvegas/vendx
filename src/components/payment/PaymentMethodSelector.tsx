import { CreditCard, Wallet, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PaymentMethod = "stripe" | "paypal" | "vendx" | "vendx_stripe" | "vendx_paypal";

interface PaymentMethodSelectorProps {
  selected: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
  disabled?: boolean;
  className?: string;
  showVendxPay?: boolean;
  walletBalance?: number;
  orderTotal?: number;
}

const PaymentMethodSelector = ({ 
  selected, 
  onSelect, 
  disabled = false,
  className,
  showVendxPay = true,
  walletBalance = 0,
  orderTotal = 0,
}: PaymentMethodSelectorProps) => {
  const hasBalance = walletBalance > 0;
  const canPayFull = walletBalance >= orderTotal;
  const remainingAfterWallet = Math.max(0, orderTotal - walletBalance);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Standard payment methods */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant={selected === "stripe" ? "default" : "outline"}
          className={cn(
            "h-14 flex flex-col items-center justify-center gap-1 transition-all",
            selected === "stripe" && "ring-2 ring-primary ring-offset-2 ring-offset-background"
          )}
          onClick={() => onSelect("stripe")}
          disabled={disabled}
        >
          <CreditCard className="w-5 h-5" />
          <span className="text-xs font-medium">Debit/Credit</span>
        </Button>
        
        <Button
          type="button"
          variant={selected === "paypal" ? "default" : "outline"}
          className={cn(
            "h-14 flex flex-col items-center justify-center gap-1 transition-all",
            selected === "paypal" && "ring-2 ring-primary ring-offset-2 ring-offset-background"
          )}
          onClick={() => onSelect("paypal")}
          disabled={disabled}
        >
          <svg 
            viewBox="0 0 24 24" 
            className="w-5 h-5" 
            fill="currentColor"
          >
            <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 2.23c.065-.38.399-.648.784-.648h7.51c2.48 0 4.346.654 5.547 1.942 1.136 1.217 1.558 2.814 1.282 4.727-.016.113-.033.227-.052.34-.61 3.608-2.735 5.997-6.24 6.79-.506.114-1.032.17-1.575.17H9.96c-.382 0-.707.28-.765.655l-.638 4.08-.481 3.051z"/>
            <path d="M18.97 8.26c-.022.136-.046.273-.072.41-.712 4.21-3.15 6.304-7.265 6.304H9.39c-.437 0-.806.312-.873.74L7.6 21.339a.531.531 0 0 0 .524.614h3.68c.383 0 .708-.28.766-.656l.031-.165.606-3.85.04-.213a.77.77 0 0 1 .761-.656h.48c3.113 0 5.548-1.263 6.261-4.916.298-1.523.143-2.795-.642-3.69a3.04 3.04 0 0 0-.878-.653l.001.006z"/>
          </svg>
          <span className="text-xs font-medium">PayPal</span>
        </Button>
      </div>

      {/* VendX Pay options */}
      {showVendxPay && hasBalance && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="w-3 h-3 text-accent" />
            <span>Use your VendX Pay balance (${walletBalance.toFixed(2)})</span>
          </div>
          
          <div className={cn("grid gap-3", canPayFull ? "grid-cols-1" : "grid-cols-3")}>
            {/* Full VendX Pay (only if balance covers total) */}
            {canPayFull && (
              <Button
                type="button"
                variant={selected === "vendx" ? "default" : "outline"}
                className={cn(
                  "h-14 flex flex-col items-center justify-center gap-1 transition-all",
                  selected === "vendx" && "ring-2 ring-accent ring-offset-2 ring-offset-background bg-accent text-accent-foreground hover:bg-accent/90"
                )}
                onClick={() => onSelect("vendx")}
                disabled={disabled}
              >
                <Wallet className="w-5 h-5" />
                <span className="text-xs font-medium">Pay with VendX Pay</span>
                <span className="text-[10px] opacity-80">Full balance: ${walletBalance.toFixed(2)}</span>
              </Button>
            )}
            
            {/* Partial VendX Pay + Stripe */}
            {!canPayFull && (
              <>
                <Button
                  type="button"
                  variant={selected === "vendx_stripe" ? "default" : "outline"}
                  className={cn(
                    "h-16 flex flex-col items-center justify-center gap-0.5 transition-all p-2",
                    selected === "vendx_stripe" && "ring-2 ring-accent ring-offset-2 ring-offset-background bg-accent text-accent-foreground hover:bg-accent/90"
                  )}
                  onClick={() => onSelect("vendx_stripe")}
                  disabled={disabled}
                >
                  <div className="flex items-center gap-1">
                    <Wallet className="w-4 h-4" />
                    <span className="text-[10px]">+</span>
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-medium">VendX + Card</span>
                  <span className="text-[9px] opacity-80">${walletBalance.toFixed(2)} + ${remainingAfterWallet.toFixed(2)}</span>
                </Button>

                {/* Partial VendX Pay + PayPal */}
                <Button
                  type="button"
                  variant={selected === "vendx_paypal" ? "default" : "outline"}
                  className={cn(
                    "h-16 flex flex-col items-center justify-center gap-0.5 transition-all p-2",
                    selected === "vendx_paypal" && "ring-2 ring-accent ring-offset-2 ring-offset-background bg-accent text-accent-foreground hover:bg-accent/90"
                  )}
                  onClick={() => onSelect("vendx_paypal")}
                  disabled={disabled}
                >
                  <div className="flex items-center gap-1">
                    <Wallet className="w-4 h-4" />
                    <span className="text-[10px]">+</span>
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                      <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 2.23c.065-.38.399-.648.784-.648h7.51c2.48 0 4.346.654 5.547 1.942 1.136 1.217 1.558 2.814 1.282 4.727-.016.113-.033.227-.052.34-.61 3.608-2.735 5.997-6.24 6.79-.506.114-1.032.17-1.575.17H9.96c-.382 0-.707.28-.765.655l-.638 4.08-.481 3.051z"/>
                    </svg>
                  </div>
                  <span className="text-[10px] font-medium">VendX + PayPal</span>
                  <span className="text-[9px] opacity-80">${walletBalance.toFixed(2)} + ${remainingAfterWallet.toFixed(2)}</span>
                </Button>

                {/* VendX Pay only (insufficient but show for context) */}
                <Button
                  type="button"
                  variant="outline"
                  className="h-16 flex flex-col items-center justify-center gap-0.5 transition-all p-2 opacity-50"
                  disabled={true}
                >
                  <Wallet className="w-4 h-4" />
                  <span className="text-[10px] font-medium">VendX Only</span>
                  <span className="text-[9px] text-destructive">Need ${remainingAfterWallet.toFixed(2)} more</span>
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Show VendX Pay option even without balance for awareness */}
      {showVendxPay && !hasBalance && (
        <div className="text-xs text-muted-foreground flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
          <Wallet className="w-4 h-4" />
          <span>
            <a href="/wallet" className="text-accent hover:underline">Load your VendX Pay wallet</a> to use it for faster checkout
          </span>
        </div>
      )}
    </div>
  );
};

export default PaymentMethodSelector;
