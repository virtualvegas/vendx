import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Ticket, Gift, TrendingUp, Loader2 } from "lucide-react";
import { useTickets } from "@/hooks/useTickets";

const TicketBalanceCard = () => {
  const navigate = useNavigate();
  const { balance, lifetimeEarned, lifetimeRedeemed, isLoading } = useTickets();

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/30">
        <CardContent className="p-6 flex items-center justify-center min-h-[120px]">
          <Loader2 className="w-6 h-6 animate-spin text-yellow-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/30">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Ticket className="w-4 h-4 text-yellow-500" />
              Arcade Tickets
            </p>
            <p className="text-3xl font-bold text-foreground">
              {balance.toLocaleString()}
            </p>
          </div>
          <Badge variant="outline" className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">
            <Gift className="w-3 h-3 mr-1" />
            Redeemable
          </Badge>
        </div>

        {/* Stats row */}
        <div className="mt-4 grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-green-500 text-sm">
              <TrendingUp className="w-3 h-3" />
              Earned
            </div>
            <p className="font-semibold">{lifetimeEarned.toLocaleString()}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-purple-500 text-sm">
              <Gift className="w-3 h-3" />
              Redeemed
            </div>
            <p className="font-semibold">{lifetimeRedeemed.toLocaleString()}</p>
          </div>
        </div>

        <Button 
          variant="outline" 
          className="w-full mt-4 border-yellow-500/30 hover:bg-yellow-500/10"
          onClick={() => navigate("/tickets/redeem")}
        >
          <Gift className="w-4 h-4 mr-2 text-yellow-500" />
          Redeem for Prizes
        </Button>
      </CardContent>
    </Card>
  );
};

export default TicketBalanceCard;
