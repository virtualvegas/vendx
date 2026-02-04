import { CreditCard, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PaymentMethod = "stripe" | "paypal" | "vendx";

interface PaymentMethodSelectorProps {
  selected: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
  disabled?: boolean;
  className?: string;
  showVendxPay?: boolean;
  walletBalance?: number;
}

const PaymentMethodSelector = ({ 
  selected, 
  onSelect, 
  disabled = false,
  className,
  showVendxPay = true,
  walletBalance,
}: PaymentMethodSelectorProps) => {
  return (
    <div className={cn("grid gap-3", showVendxPay ? "grid-cols-3" : "grid-cols-2", className)}>
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

      {showVendxPay && (
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
          <span className="text-xs font-medium">VendX Pay</span>
          {walletBalance !== undefined && (
            <span className="text-[10px] opacity-80">${walletBalance.toFixed(2)}</span>
          )}
        </Button>
      )}
    </div>
  );
};

export default PaymentMethodSelector;
