import { useTickets, TicketTransaction } from "@/hooks/useTickets";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Ticket, Trophy, Gift, ArrowUp, ArrowDown, Gamepad2, Sparkles } from "lucide-react";

const CustomerTickets = () => {
  const { balance, lifetimeEarned, lifetimeRedeemed, transactions, isLoading } = useTickets();

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "earn":
        return <ArrowUp className="h-4 w-4 text-emerald-500" />;
      case "redeem":
        return <ArrowDown className="h-4 w-4 text-amber-600" />;
      case "admin_grant":
        return <Gift className="h-4 w-4 text-primary" />;
      default:
        return <Ticket className="h-4 w-4" />;
    }
  };

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case "earn":
        return "Earned";
      case "redeem":
        return "Redeemed";
      case "admin_grant":
        return "Bonus";
      case "admin_revoke":
        return "Adjusted";
      case "transfer_in":
        return "Received";
      case "transfer_out":
        return "Sent";
      case "expiry":
        return "Expired";
      default:
        return type;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-secondary/10 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-full bg-primary/20">
                <Ticket className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Your Tickets</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-primary">
                    {balance.toLocaleString()}
                  </span>
                  <Sparkles className="h-5 w-5 text-primary/70" />
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-8 text-right">
              <div>
                <p className="text-xs text-muted-foreground">Lifetime Earned</p>
                <p className="text-lg font-semibold text-emerald-500">
                  +{lifetimeEarned.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Lifetime Redeemed</p>
                <p className="text-lg font-semibold text-amber-600">
                  -{lifetimeRedeemed.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* How to Earn */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gamepad2 className="h-5 w-5 text-primary" />
            Earn Tickets
          </CardTitle>
          <CardDescription>
            Win tickets at arcade and claw machines across all VendX locations
          </CardDescription>
        </CardHeader>
        <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <Trophy className="h-8 w-8 text-primary mb-2" />
              <h4 className="font-medium">Play Games</h4>
              <p className="text-sm text-muted-foreground">
                Earn tickets based on your score at arcade machines
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <Sparkles className="h-8 w-8 text-primary mb-2" />
              <h4 className="font-medium">Hit Jackpots</h4>
              <p className="text-sm text-muted-foreground">
                Get lucky and win bonus jackpot tickets
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <Gift className="h-8 w-8 text-primary mb-2" />
              <h4 className="font-medium">Redeem Prizes</h4>
              <p className="text-sm text-muted-foreground">
                Exchange tickets for rewards at any VendX location
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>Ticket History</CardTitle>
          <CardDescription>
            Your recent ticket transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Ticket className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No ticket transactions yet</p>
              <p className="text-sm">Play games at VendX arcade machines to earn tickets!</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx: TicketTransaction) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(tx.created_at), "MMM d, h:mm a")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTransactionIcon(tx.transaction_type)}
                          <span>{getTransactionLabel(tx.transaction_type)}</span>
                          {tx.metadata?.is_jackpot && (
                            <Badge variant="secondary" className="text-xs">
                              <Sparkles className="h-3 w-3 mr-1" />
                              Jackpot!
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          {tx.game_name && <span className="font-medium">{tx.game_name}</span>}
                          {tx.machine && (
                            <span className="text-muted-foreground text-sm block">
                              {tx.machine.name}
                            </span>
                          )}
                          {tx.location && (
                            <span className="text-muted-foreground text-xs">
                              {tx.location.name || tx.location.city}
                            </span>
                          )}
                          {!tx.game_name && !tx.machine && (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={tx.amount > 0 ? "text-emerald-500" : "text-amber-600"}>
                          {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {tx.balance_after.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerTickets;
