import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Gamepad2, QrCode, Wallet, Plus, Star, MapPin, 
  ArrowLeft, Loader2, AlertCircle, Gift, History
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ArcadeMachineScanner } from "@/components/arcade/ArcadeMachineScanner";
import { ArcadePaymentFlow } from "@/components/arcade/ArcadePaymentFlow";

interface RecentMachine {
  machine_code: string;
  machine_name: string;
  location_name: string;
  last_played: string;
  total_plays: number;
}

const ArcadePayPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [user, setUser] = useState<any>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [ticketBalance, setTicketBalance] = useState(0);
  const [recentMachines, setRecentMachines] = useState<RecentMachine[]>([]);
  const [loading, setLoading] = useState(true);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [selectedMachineCode, setSelectedMachineCode] = useState<string | null>(null);

  // Check for machine code from URL
  useEffect(() => {
    const machineCode = searchParams.get("machine");
    if (machineCode) {
      setSelectedMachineCode(machineCode);
      setPaymentOpen(true);
    }
  }, [searchParams]);

  // Fetch user data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate("/auth?redirect=/arcade-pay");
          return;
        }
        setUser(user);

        // Get wallet balance (parent wallet)
        const { data: wallet, error: walletError } = await supabase
          .from("wallets")
          .select("balance")
          .eq("user_id", user.id)
          .in("wallet_type", ["standard", "guest"])
          .is("parent_wallet_id", null)
          .maybeSingle();
        if (walletError) throw walletError;
        setWalletBalance(wallet?.balance || 0);

        // Get ticket balance
        const { data: tickets } = await supabase
          .from("user_tickets")
          .select("balance")
          .eq("user_id", user.id)
          .maybeSingle();
        setTicketBalance(tickets?.balance || 0);

        // Get recent play history
        const { data: recentPlays } = await supabase
          .from("arcade_play_sessions")
          .select(`
            machine_id,
            vendx_machines (machine_code, name, location:locations(name, city))
          `)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5);

        if (recentPlays) {
          const machineMap = new Map<string, RecentMachine>();
          for (const play of recentPlays) {
            const machine = play.vendx_machines as any;
            if (machine && !machineMap.has(machine.machine_code)) {
              machineMap.set(machine.machine_code, {
                machine_code: machine.machine_code,
                machine_name: machine.name,
                location_name: machine.location?.name || machine.location?.city || "Unknown",
                last_played: "",
                total_plays: 1,
              });
            }
          }
          setRecentMachines(Array.from(machineMap.values()).slice(0, 3));
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  const handleMachineSelected = (code: string) => {
    setSelectedMachineCode(code);
    setScannerOpen(false);
    setPaymentOpen(true);
  };

  const handlePaymentSuccess = (sessionId: string, plays: number) => {
    toast({
      title: "🎮 Game Ready!",
      description: `${plays} play${plays > 1 ? "s" : ""} activated. Start playing!`,
    });
    // Refresh balances
    supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", user?.id)
      .in("wallet_type", ["standard", "guest"])
      .is("parent_wallet_id", null)
      .maybeSingle()
      .then(({ data }) => setWalletBalance(data?.balance || 0));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Gamepad2 className="h-6 w-6 text-purple-500" />
            <span className="font-bold text-lg">Arcade Pay</span>
          </div>
        </div>
      </header>

      <main className="container max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Quick Balance Cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-gradient-to-br from-green-500/10 to-transparent border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="h-4 w-4 text-green-500" />
                <span className="text-xs text-muted-foreground">Balance</span>
              </div>
              <p className="text-2xl font-bold text-green-500">
                ${walletBalance.toFixed(2)}
              </p>
              <Button variant="link" size="sm" className="p-0 h-auto text-xs" onClick={() => navigate("/wallet")}>
                <Plus className="h-3 w-3 mr-1" />
                Add Funds
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-500/10 to-transparent border-yellow-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Star className="h-4 w-4 text-yellow-500" />
                <span className="text-xs text-muted-foreground">Tickets</span>
              </div>
              <p className="text-2xl font-bold text-yellow-500">
                {ticketBalance.toLocaleString()}
              </p>
              <Button variant="link" size="sm" className="p-0 h-auto text-xs" onClick={() => navigate("/tickets")}>
                <Gift className="h-3 w-3 mr-1" />
                Redeem
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Main Action - Scan to Pay */}
        <Card className="bg-gradient-to-br from-purple-500/20 via-purple-500/10 to-transparent border-purple-500/30">
          <CardContent className="p-6">
            <div className="text-center mb-4">
              <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-3">
                <QrCode className="w-8 h-8 text-purple-500" />
              </div>
              <h2 className="text-xl font-bold mb-1">Scan to Play</h2>
              <p className="text-sm text-muted-foreground">
                Scan the QR code on any arcade machine to start playing
              </p>
            </div>

            <Button 
              size="lg" 
              className="w-full h-14 text-lg bg-purple-600 hover:bg-purple-500"
              onClick={() => setScannerOpen(true)}
            >
              <QrCode className="w-6 h-6 mr-2" />
              Scan Machine QR
            </Button>
          </CardContent>
        </Card>

        {/* Insufficient Balance Warning */}
        {walletBalance < 1 && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Low Balance</p>
                <p className="text-xs text-muted-foreground">
                  Add funds to your wallet before playing arcade games.
                </p>
                <Button size="sm" variant="outline" className="mt-2" onClick={() => navigate("/wallet")}>
                  Add Funds
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Machines */}
        {recentMachines.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="w-4 h-4" />
                Recent Machines
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentMachines.map((machine) => (
                <button
                  key={machine.machine_code}
                  onClick={() => handleMachineSelected(machine.machine_code)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Gamepad2 className="w-5 h-5 text-purple-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{machine.machine_name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {machine.location_name}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {machine.machine_code}
                  </Badge>
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        {/* How It Works */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { step: 1, text: "Scan the QR code on the arcade machine" },
              { step: 2, text: "Select how many plays you want" },
              { step: 3, text: "Confirm payment from your wallet" },
              { step: 4, text: "Machine activates - start playing!" },
            ].map(({ step, text }) => (
              <div key={step} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-500 font-bold text-sm">
                  {step}
                </div>
                <p className="text-sm">{text}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>

      {/* Machine Scanner Dialog */}
      <ArcadeMachineScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onMachineSelected={handleMachineSelected}
      />

      {/* Payment Flow Dialog */}
      <ArcadePaymentFlow
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        machineCode={selectedMachineCode || undefined}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
};

export default ArcadePayPage;
