import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, Plus, ArrowUpRight, ArrowDownLeft, Clock, Copy, Check, KeyRound } from "lucide-react";
import { format } from "date-fns";
import WalletLoadDialog from "@/components/vendx-pay/WalletLoadDialog";
import { useToast } from "@/hooks/use-toast";

// TOTP generation utilities
function base32ToBytes(base32: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of base32.toUpperCase()) {
    const val = alphabet.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, (i + 1) * 8), 2);
  }
  return bytes;
}

async function hmacSha1(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, message.buffer as ArrayBuffer);
  return new Uint8Array(signature);
}

async function generateTOTP(secret: string, timeStep: number = 60): Promise<string> {
  const counter = Math.floor(Date.now() / 1000 / timeStep);
  const counterBytes = new Uint8Array(8);
  let temp = counter;
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = temp & 0xff;
    temp = Math.floor(temp / 256);
  }
  const key = base32ToBytes(secret);
  const hmac = await hmacSha1(key, counterBytes);
  const offset = hmac[19] & 0xf;
  const code = (
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  ) % 1000000;
  return code.toString().padStart(6, '0');
}

function getTimeRemaining(timeStep: number = 60): number {
  return timeStep - (Math.floor(Date.now() / 1000) % timeStep);
}

const CustomerWallet = () => {
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [currentCode, setCurrentCode] = useState<string>("------");
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const TIME_STEP = 60;

  const { data: wallet, isLoading: walletLoading, refetch } = useQuery({
    queryKey: ["customer-wallet"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ["wallet-transactions", wallet?.id],
    enabled: !!wallet?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("wallet_id", wallet!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const generateCode = useCallback(async (secret: string) => {
    try {
      const code = await generateTOTP(secret, TIME_STEP);
      setCurrentCode(code);
    } catch (error) {
      console.error("Error generating TOTP:", error);
    }
  }, []);

  useEffect(() => {
    const fetchSecret = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("totp_secret")
          .eq("id", user.id)
          .single();
        if (profile?.totp_secret) {
          setTotpSecret(profile.totp_secret);
          await generateCode(profile.totp_secret);
        }
      }
    };
    fetchSecret();
  }, [generateCode]);

  useEffect(() => {
    if (!totpSecret) return;
    const interval = setInterval(async () => {
      const remaining = getTimeRemaining(TIME_STEP);
      setTimeRemaining(remaining);
      if (remaining === TIME_STEP) {
        await generateCode(totpSecret);
      }
    }, 1000);
    setTimeRemaining(getTimeRemaining(TIME_STEP));
    return () => clearInterval(interval);
  }, [totpSecret, generateCode]);

  const copyCode = () => {
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    toast({ title: "Code Copied", description: "Payment code copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const getProgressColor = () => {
    if (timeRemaining <= 10) return "text-red-500";
    if (timeRemaining <= 20) return "text-yellow-500";
    return "text-primary";
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">My Wallet</h2>
        <p className="text-muted-foreground">
          Manage your VendX Pay balance and view transactions
        </p>
      </div>

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
                  <Plus className="w-4 h-4 mr-2" />
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
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
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

      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {transactionsLoading ? (
            <p className="text-muted-foreground">Loading transactions...</p>
          ) : transactions && transactions.length > 0 ? (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 border border-border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      tx.transaction_type === "load" ? "bg-green-500/10" : "bg-red-500/10"
                    }`}>
                      {tx.transaction_type === "load" ? (
                        <ArrowDownLeft className="w-4 h-4 text-green-500" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-foreground capitalize">
                        {tx.transaction_type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(tx.created_at), "MMM d, h:mm a")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${
                      tx.transaction_type === "load" ? "text-green-500" : "text-foreground"
                    }`}>
                      {tx.transaction_type === "load" ? "+" : "-"}${Math.abs(Number(tx.amount)).toFixed(2)}
                    </p>
                    {tx.description && (
                      <p className="text-xs text-muted-foreground">{tx.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No transactions yet. Add funds to get started!
            </p>
          )}
        </CardContent>
      </Card>

      <WalletLoadDialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen} />
    </div>
  );
};

export default CustomerWallet;
