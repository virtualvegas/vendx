import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, KeyRound, Clock, Copy, Check, Users } from "lucide-react";
import { format } from "date-fns";
import WalletLoadDialog from "@/components/vendx-pay/WalletLoadDialog";
import { WalletHierarchyView } from "@/components/wallet";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChildWalletManager } from "@/components/arcade";

const CustomerWallet = () => {
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [currentCode, setCurrentCode] = useState<string>("------");
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [copied, setCopied] = useState(false);
  const [hasTotp, setHasTotp] = useState(false);
  const { toast } = useToast();
  const TIME_STEP = 60;

  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ["customer-wallet"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user.id)
        .eq("wallet_type", "standard")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const fetchCode = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("totp-generate-code");
      if (error) throw error;
      if (data?.code) {
        setCurrentCode(data.code);
        setTimeRemaining(data.time_remaining || TIME_STEP);
        setHasTotp(true);
      }
    } catch (error) {
      console.error("Error fetching TOTP code:", error);
    }
  }, []);

  useEffect(() => {
    fetchCode();
  }, [fetchCode]);

  useEffect(() => {
    if (!hasTotp) return;
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          fetchCode();
          return TIME_STEP;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [hasTotp, fetchCode]);

  const copyCode = () => {
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    toast({ title: "Code Copied", description: "Payment code copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const getProgressColor = () => {
    if (timeRemaining <= 10) return "text-destructive";
    if (timeRemaining <= 20) return "text-amber-500";
    return "text-primary";
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">My Wallet</h2>
        <p className="text-muted-foreground">
          Manage your VendX Pay balance, child wallets, and transactions
        </p>
      </div>

      <Tabs defaultValue="hierarchy" className="w-full">
        <TabsList>
          <TabsTrigger value="hierarchy" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Wallets
          </TabsTrigger>
          <TabsTrigger value="children" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Child Wallets
          </TabsTrigger>
          <TabsTrigger value="pay" className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Payment Code
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hierarchy" className="mt-4">
          <WalletHierarchyView />
        </TabsContent>

        <TabsContent value="children" className="mt-4">
          <ChildWalletManager />
        </TabsContent>

        <TabsContent value="pay" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-gradient-to-br from-primary/20 to-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5" />
                  Wallet Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                {walletLoading ? (
                  <div className="animate-pulse h-12 bg-muted rounded w-32" />
                ) : (
                  <>
                    <p className="text-4xl font-bold text-foreground mb-4">
                      ${Number(wallet?.balance || 0).toFixed(2)}
                    </p>
                    <Button onClick={() => setLoadDialogOpen(true)} className="w-full sm:w-auto">
                      Add Funds
                    </Button>
                    {wallet?.last_loaded && (
                      <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Last loaded: {format(new Date(wallet.last_loaded), "MMM d, yyyy")}
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="w-5 h-5" />
                  Payment Code
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center space-y-4">
                  <div className="p-6 bg-gradient-to-br from-primary/10 to-accent/10 rounded-xl border border-primary/20">
                    <p className="text-sm text-muted-foreground mb-2">Enter this code at VendX machines</p>
                    <div className="flex items-center justify-center gap-2">
                      <p className="text-4xl font-mono font-bold tracking-[0.2em] text-foreground">
                        {currentCode}
                      </p>
                      <Button variant="ghost" size="icon" onClick={copyCode}>
                        {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <Clock className={`w-4 h-4 ${getProgressColor()}`} />
                    <span className={`text-sm font-medium ${getProgressColor()}`}>
                      New code in {timeRemaining}s
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-1000 ease-linear"
                      style={{ width: `${(timeRemaining / TIME_STEP) * 100}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <WalletLoadDialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen} />
    </div>
  );
};

export default CustomerWallet;
