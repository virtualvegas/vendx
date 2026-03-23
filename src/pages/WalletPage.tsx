import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, Plus, History, Gift, QrCode, Star, TrendingUp, ArrowUpRight, ArrowDownRight, Gamepad2, Users, Ticket } from "lucide-react";
import WalletLoadDialog from "@/components/vendx-pay/WalletLoadDialog";
import QRCodeGenerator from "@/components/vendx-pay/QRCodeGenerator";
import { ArcadePaymentFlow, ArcadeMachineScanner, ChildWalletManager } from "@/components/arcade";
import { TicketBalanceCard, AutoReloadSettings } from "@/components/wallet";
import { useSEO } from "@/hooks/useSEO";

interface WalletData {
  id: string;
  balance: number;
  last_loaded: string | null;
}

interface RewardsData {
  balance: number;
  lifetime_points: number;
  tier: string;
}

interface Transaction {
  id: string;
  amount: number;
  transaction_type: string;
  description: string | null;
  created_at: string;
}

const TIER_INFO = {
  bronze: { color: "bg-amber-700", label: "Bronze", nextTier: "Silver", pointsNeeded: 5000 },
  silver: { color: "bg-slate-400", label: "Silver", nextTier: "Gold", pointsNeeded: 25000 },
  gold: { color: "bg-yellow-500", label: "Gold", nextTier: "Platinum", pointsNeeded: 100000 },
  platinum: { color: "bg-gradient-to-r from-purple-500 to-pink-500", label: "Platinum", nextTier: null, pointsNeeded: null },
};

const WalletPage = () => {
  useSEO({
    title: "VendX Pay — Digital Wallet",
    description: "Your digital wallet for all VendX machines. Add funds, pay at vending and arcade machines, and manage your rewards.",
  });
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [rewards, setRewards] = useState<RewardsData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [showArcadeScanner, setShowArcadeScanner] = useState(false);
  const [showArcadePayment, setShowArcadePayment] = useState(false);
  const [selectedMachineCode, setSelectedMachineCode] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        if (!session) {
          navigate("/auth");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Handle PayPal return
  useEffect(() => {
    const handlePayPalReturn = async () => {
      const isPayPal = searchParams.get("paypal") === "true";
      const token = searchParams.get("token"); // PayPal order ID
      const amount = searchParams.get("amount");
      
      if (isPayPal && token) {
        try {
          toast({
            title: "Processing Payment...",
            description: "Please wait while we confirm your PayPal payment.",
          });
          
          const { data, error } = await supabase.functions.invoke("paypal-capture", {
            body: { orderId: token, type: "wallet_load" }
          });
          
          if (error) throw error;
          
          if (data?.success) {
            toast({
              title: "Wallet Loaded!",
              description: `Successfully added $${amount} to your VendX wallet via PayPal.`,
            });
          }
        } catch (error: any) {
          console.error("PayPal capture error:", error);
          toast({
            title: "Payment Error",
            description: error.message || "Failed to process PayPal payment.",
            variant: "destructive",
          });
        }
        window.history.replaceState({}, "", "/wallet");
      } else if (searchParams.get("success") === "true") {
        toast({
          title: "Wallet Loaded!",
          description: `Successfully added $${amount} to your VendX wallet.`,
        });
        window.history.replaceState({}, "", "/wallet");
      } else if (searchParams.get("canceled") === "true") {
        toast({
          title: "Payment Canceled",
          description: "Your wallet load was canceled.",
          variant: "destructive",
        });
        window.history.replaceState({}, "", "/wallet");
      }
    };
    
    handlePayPalReturn();
  }, [searchParams, toast]);

  const refreshWalletData = async () => {
    if (!user) return;

    try {
      const { data: existingWallet, error } = await supabase
        .from("wallets")
        .select("id, balance, last_loaded")
        .eq("user_id", user.id)
        .in("wallet_type", ["standard", "guest"])
        .is("parent_wallet_id", null)
        .maybeSingle();

      if (error) throw error;

      let walletData = existingWallet as WalletData | null;

      if (!walletData) {
        const { data: created, error: createError } = await supabase
          .from("wallets")
          .insert({ user_id: user.id, wallet_type: "standard", balance: 0 })
          .select("id, balance, last_loaded")
          .single();

        if (createError) {
          const maybeCode = (createError as unknown as { code?: string }).code;
          if (maybeCode === "23505") {
            const { data: refetched, error: refetchError } = await supabase
              .from("wallets")
              .select("id, balance, last_loaded")
              .eq("user_id", user.id)
              .in("wallet_type", ["standard", "guest"])
              .is("parent_wallet_id", null)
              .maybeSingle();
            if (refetchError) throw refetchError;
            walletData = refetched as WalletData | null;
          } else {
            throw createError;
          }
        } else {
          walletData = created as WalletData;
        }
      }

      setWallet(walletData);
    } catch (error) {
      console.error("Refresh error:", error);
    }
  };

  const handleMachineSelected = (code: string) => {
    setSelectedMachineCode(code);
    setShowArcadePayment(true);
  };

  useEffect(() => {
    const fetchWalletData = async () => {
      if (!user) return;

      try {
        // Fetch parent wallet
        const { data: existingWallet, error: walletError } = await supabase
          .from("wallets")
          .select("id, balance, last_loaded")
          .eq("user_id", user.id)
          .in("wallet_type", ["standard", "guest"])
          .is("parent_wallet_id", null)
          .maybeSingle();

        if (walletError) throw walletError;

        let walletData = existingWallet as WalletData | null;

        if (!walletData) {
          const { data: created, error: createError } = await supabase
            .from("wallets")
            .insert({ user_id: user.id, wallet_type: "standard", balance: 0 })
            .select("id, balance, last_loaded")
            .single();

          if (createError) {
            const maybeCode = (createError as unknown as { code?: string }).code;
            if (maybeCode === "23505") {
              const { data: refetched, error: refetchError } = await supabase
                .from("wallets")
                .select("id, balance, last_loaded")
                .eq("user_id", user.id)
                .in("wallet_type", ["standard", "guest"])
                .is("parent_wallet_id", null)
                .maybeSingle();
              if (refetchError) throw refetchError;
              walletData = refetched as WalletData | null;
            } else {
              throw createError;
            }
          } else {
            walletData = created as WalletData;
          }
        }

        setWallet(walletData);

        // Fetch rewards
        const { data: rewardsData, error: rewardsError } = await supabase
          .from("rewards_points")
          .select("balance, lifetime_points, tier")
          .eq("user_id", user.id)
          .maybeSingle();

        if (rewardsError) throw rewardsError;
        setRewards(rewardsData);

        // Fetch transactions for parent wallet
        if (walletData) {
          const { data: txData } = await supabase
            .from("wallet_transactions")
            .select("id, amount, transaction_type, description, created_at")
            .eq("wallet_id", walletData.id)
            .order("created_at", { ascending: false })
            .limit(10);

          setTransactions(txData || []);
        } else {
          setTransactions([]);
        }
      } catch (error: unknown) {
        console.error("Error fetching wallet data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchWalletData();
  }, [user]);

  const tierInfo = TIER_INFO[rewards?.tier as keyof typeof TIER_INFO] || TIER_INFO.bronze;
  const progressToNextTier = tierInfo.pointsNeeded 
    ? Math.min(100, ((rewards?.lifetime_points || 0) / tierInfo.pointsNeeded) * 100)
    : 100;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading wallet...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 py-24">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <Wallet className="w-8 h-8 text-primary" />
                VendX Pay
              </h1>
              <p className="text-muted-foreground mt-1">Your digital wallet for all VendX machines</p>
            </div>
            <Badge className={`${tierInfo.color} text-white`}>
              <Star className="w-4 h-4 mr-1" />
              {tierInfo.label}
            </Badge>
          </div>

          {/* Balance Card */}
          <Card className="bg-gradient-to-br from-primary/20 to-accent/10 border-primary/30">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="text-center md:text-left">
                  <p className="text-muted-foreground text-sm">Available Balance</p>
                  <p className="text-5xl font-bold text-foreground mt-2">
                    ${(wallet?.balance || 0).toFixed(2)}
                  </p>
                  {wallet?.last_loaded && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Last loaded: {new Date(wallet.last_loaded).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => setShowLoadDialog(true)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Funds
                  </Button>
                  <Button variant="outline" onClick={() => setShowQRCode(true)} className="gap-2">
                    <QrCode className="w-4 h-4" />
                    Vending
                  </Button>
                  <Button variant="outline" onClick={() => setShowArcadeScanner(true)} className="gap-2">
                    <Gamepad2 className="w-4 h-4" />
                    Arcade
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs for Wallet Content */}
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="grid grid-cols-3 w-full max-w-md">
              <TabsTrigger value="overview" className="gap-2">
                <Wallet className="w-4 h-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="transactions" className="gap-2">
                <History className="w-4 h-4" />
                History
              </TabsTrigger>
              <TabsTrigger value="family" className="gap-2">
                <Users className="w-4 h-4" />
                Family
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {/* Ticket Balance Card */}
              <TicketBalanceCard />
              
              {/* Stats Row */}
              <div className="grid md:grid-cols-3 gap-4">
                {/* Points Balance */}
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-full bg-accent/20">
                        <Gift className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Points Balance</p>
                        <p className="text-2xl font-bold">{(rewards?.balance || 0).toLocaleString()}</p>
                      </div>
                    </div>
                    <Button 
                      variant="link" 
                      className="mt-3 p-0 h-auto text-accent"
                      onClick={() => navigate("/rewards")}
                    >
                      Redeem Points →
                    </Button>
                  </CardContent>
                </Card>

                {/* Lifetime Points */}
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-full bg-primary/20">
                        <TrendingUp className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Lifetime Points</p>
                        <p className="text-2xl font-bold">{(rewards?.lifetime_points || 0).toLocaleString()}</p>
                      </div>
                    </div>
                    {tierInfo.nextTier && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Progress to {tierInfo.nextTier}</span>
                          <span>{progressToNextTier.toFixed(0)}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all"
                            style={{ width: `${progressToNextTier}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Earn Rate */}
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-full bg-green-500/20">
                        <Star className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Earn Rate</p>
                        <p className="text-2xl font-bold">
                          {rewards?.tier === "platinum" ? "20" : rewards?.tier === "gold" ? "15" : rewards?.tier === "silver" ? "12" : "10"}x
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      Points per $1 spent
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="transactions" className="space-y-4">
              {/* Recent Transactions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="w-5 h-5" />
                    Recent Transactions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {transactions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No transactions yet. Add funds to get started!
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {transactions.map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${tx.amount > 0 ? "bg-green-500/20" : "bg-destructive/20"}`}>
                              {tx.amount > 0 ? (
                                <ArrowUpRight className="w-4 h-4 text-green-500" />
                              ) : (
                                <ArrowDownRight className="w-4 h-4 text-destructive" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium capitalize">{tx.transaction_type.replace(/_/g, " ")}</p>
                              <p className="text-sm text-muted-foreground">
                                {tx.description || "VendX transaction"}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-bold ${tx.amount > 0 ? "text-green-500" : "text-destructive"}`}>
                              {tx.amount > 0 ? "+" : ""}${Math.abs(tx.amount).toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(tx.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="family" className="space-y-4">
              {user && (
                <ChildWalletManager 
                  user={user} 
                  parentWalletBalance={wallet?.balance || 0}
                  onRefresh={refreshWalletData}
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />

      <WalletLoadDialog 
        open={showLoadDialog} 
        onOpenChange={setShowLoadDialog} 
      />
      
      <QRCodeGenerator
        open={showQRCode}
        onOpenChange={setShowQRCode}
      />

      <ArcadeMachineScanner
        open={showArcadeScanner}
        onOpenChange={setShowArcadeScanner}
        onMachineSelected={handleMachineSelected}
      />

      <ArcadePaymentFlow
        open={showArcadePayment}
        onOpenChange={setShowArcadePayment}
        machineCode={selectedMachineCode}
        onSuccess={() => refreshWalletData()}
      />
    </div>
  );
};

export default WalletPage;
