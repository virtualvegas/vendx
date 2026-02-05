import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Ticket, Gift, ShieldCheck, Truck } from "lucide-react";
import { cn } from "@/lib/utils";

interface TicketPrize {
  id: string;
  name: string;
  description: string | null;
  ticket_cost: number;
  category: string;
  image_url: string | null;
  requires_approval: boolean;
  requires_shipping: boolean;
  min_age: number | null;
  shipping_fee_type?: string;
  shipping_fee_amount?: number;
}

interface TicketPrizeCardProps {
  prize: TicketPrize;
  userBalance: number;
  onRedeem: (prize: TicketPrize) => void;
  inventoryCount?: number;
}

export const TicketPrizeCard = ({ 
  prize, 
  userBalance, 
  onRedeem,
  inventoryCount 
}: TicketPrizeCardProps) => {
  const canAfford = userBalance >= prize.ticket_cost;
  const inStock = inventoryCount === undefined || inventoryCount > 0;

  return (
    <Card className={cn(
      "overflow-hidden transition-all hover:shadow-lg",
      !canAfford && "opacity-60"
    )}>
      {/* Prize Image */}
      <div className="relative aspect-square bg-muted">
        {prize.image_url ? (
          <img
            src={prize.image_url}
            alt={prize.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Gift className="h-16 w-16 text-muted-foreground/30" />
          </div>
        )}
        
        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          <Badge variant="secondary" className="text-xs">
            {prize.category}
          </Badge>
          {prize.requires_approval && (
            <Badge variant="outline" className="bg-background/80 text-xs">
              <ShieldCheck className="h-3 w-3 mr-1" />
              Approval
            </Badge>
          )}
          {prize.requires_shipping && (
            <Badge variant="outline" className="bg-background/80 text-xs">
              <Truck className="h-3 w-3 mr-1" />
              {prize.shipping_fee_type === "free" || !prize.shipping_fee_amount 
                ? "Free Ship" 
                : prize.shipping_fee_type === "tickets" 
                  ? `+${prize.shipping_fee_amount} tix` 
                  : `+$${prize.shipping_fee_amount}`}
            </Badge>
          )}
        </div>

        {/* Stock indicator */}
        {inventoryCount !== undefined && (
          <div className="absolute bottom-2 right-2">
            <Badge 
              variant={inventoryCount > 5 ? "secondary" : inventoryCount > 0 ? "outline" : "destructive"}
              className="text-xs"
            >
              {inventoryCount > 0 ? `${inventoryCount} left` : "Out of stock"}
            </Badge>
          </div>
        )}
      </div>

      <CardContent className="p-4">
        <h3 className="font-semibold truncate">{prize.name}</h3>
        {prize.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
            {prize.description}
          </p>
        )}
        
        <div className="flex items-center gap-1 mt-3 text-lg font-bold text-primary">
          <Ticket className="h-5 w-5" />
          {prize.ticket_cost.toLocaleString()}
          <span className="text-sm font-normal text-muted-foreground ml-1">tickets</span>
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <Button
          className="w-full"
          disabled={!canAfford || !inStock}
          onClick={() => onRedeem(prize)}
        >
          {!inStock ? (
            "Out of Stock"
          ) : !canAfford ? (
            `Need ${(prize.ticket_cost - userBalance).toLocaleString()} more`
          ) : (
            <>
              <Gift className="h-4 w-4 mr-2" />
              Redeem Prize
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default TicketPrizeCard;
