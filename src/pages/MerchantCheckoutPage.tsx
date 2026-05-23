import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Wallet, ShieldCheck, AlertCircle, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { toast } from "sonner";

type Session = {
  session_token: string;
  amount: number;
  currency: string;
  order_reference: string | null;
  description: string | null;
  customer_email: string | null;
  status: "pending" | "paid" | "cancelled" | "expired" | "failed";
  expires_at: string;
  return_url: string;
  cancel_url: string | null;
  merchant: { name: string; slug: string; logo_url: string | null } | null;
};

const MerchantCheckoutPage = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<any>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useSEO({
    title: session?.merchant?.name
      ? `Pay ${session.merchant.name} — VendX Wallet`
      : "Pay with VendX Wallet",
    description: "Secure payment using your VendX Wallet balance.",
  });

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("merchant-get-session", {
          body: { token },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setSession(data as Session);
      } catch (e: any) {
        setError(e.message || "Failed to load payment session");
      }

      const { data: u } = await supabase.auth.getUser();
      setUser(u.user);
      if (u.user) {
        const { data: w } = await supabase
          .from("wallets").select("balance").eq("user_id", u.user.id).maybeSingle();
        if (w) setWalletBalance(Number(w.balance));
      }
      setLoading(false);
    })();
  }, [token]);

  const handleSignIn = () => {
    navigate(`/auth?redirect=${encodeURIComponent(`/pay/checkout/${token}`)}`);
  };

  const handlePay = async () => {
    if (!session || !user) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("merchant-pay-session", {
        body: { token },
      });
      if (error) throw error;
      if (!data?.success) {
        toast.error(data?.error || "Payment failed");
        if (typeof data?.new_balance === "number") setWalletBalance(data.new_balance);
        setProcessing(false);
        return;
      }
      toast.success("Payment successful");
      window.location.href = data.redirect_url;
    } catch (e: any) {
      toast.error(e.message || "Payment failed");
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!session) return;
    setProcessing(true);
    try {
      const { data } = await supabase.functions.invoke("merchant-cancel-session", {
        body: { token },
      });
      if (data?.redirect_url) {
        const url = new URL(data.redirect_url);
        url.searchParams.set("vendx_session", token!);
        url.searchParams.set("status", "cancelled");
        window.location.href = url.toString();
      } else {
        navigate("/");
      }
    } catch {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Payment session unavailable</h2>
            <p className="text-muted-foreground">{error || "Session not found"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const StatusIcon = {
    pending: Clock, paid: CheckCircle2, cancelled: XCircle, expired: XCircle, failed: XCircle,
  }[session.status];

  if (session.status !== "pending") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <StatusIcon className={`h-12 w-12 mx-auto mb-4 ${session.status === "paid" ? "text-primary" : "text-muted-foreground"}`} />
            <h2 className="text-xl font-bold mb-2 capitalize">Payment {session.status}</h2>
            <p className="text-muted-foreground mb-6">
              {session.status === "paid"
                ? "This payment was already completed."
                : `This session is ${session.status} and can no longer be used.`}
            </p>
            <Button onClick={() => (window.location.href = session.return_url)}>
              Return to merchant
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const insufficient = user && walletBalance < session.amount;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-primary/20">
        <CardHeader className="text-center border-b border-border">
          {session.merchant?.logo_url && (
            <img
              src={session.merchant.logo_url}
              alt={session.merchant.name}
              className="h-12 mx-auto mb-3 object-contain"
            />
          )}
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Pay with VendX Wallet</p>
          <CardTitle className="text-2xl mt-1">
            {session.merchant?.name || "Merchant"}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">Amount due</p>
            <p className="text-4xl font-bold text-primary">
              ${session.amount.toFixed(2)} <span className="text-base font-normal text-muted-foreground">{session.currency}</span>
            </p>
          </div>

          {session.order_reference && (
            <div className="flex justify-between text-sm border-t border-border pt-3">
              <span className="text-muted-foreground">Order</span>
              <span className="font-medium">{session.order_reference}</span>
            </div>
          )}
          {session.description && (
            <div className="text-sm border-t border-border pt-3">
              <p className="text-muted-foreground mb-1">Description</p>
              <p>{session.description}</p>
            </div>
          )}

          {!user ? (
            <div className="space-y-3 pt-4 border-t border-border">
              <p className="text-sm text-center text-muted-foreground">
                Sign in to your VendX account to continue
              </p>
              <Button className="w-full h-12" onClick={handleSignIn}>
                Sign in to VendX
              </Button>
              <Button variant="ghost" className="w-full" onClick={handleCancel} disabled={processing}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="space-y-3 pt-4 border-t border-border">
              <div className="flex items-center justify-between bg-muted/30 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  <span className="text-sm">Wallet balance</span>
                </div>
                <span className={`font-bold ${insufficient ? "text-destructive" : ""}`}>
                  ${walletBalance.toFixed(2)}
                </span>
              </div>

              {insufficient && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm">
                  <p className="text-destructive font-medium mb-1">Insufficient balance</p>
                  <p className="text-muted-foreground text-xs mb-2">
                    Add ${(session.amount - walletBalance).toFixed(2)} or more to continue.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate("/dashboard/my-wallet")}
                  >
                    Add funds
                  </Button>
                </div>
              )}

              <Button
                className="w-full h-12"
                disabled={processing || insufficient}
                onClick={handlePay}
              >
                {processing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>Confirm Payment — ${session.amount.toFixed(2)}</>
                )}
              </Button>
              <Button variant="ghost" className="w-full" onClick={handleCancel} disabled={processing}>
                Cancel and return to merchant
              </Button>
            </div>
          )}

          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
            <ShieldCheck className="h-3 w-3" />
            <span>Secured by VendX Pay</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MerchantCheckoutPage;
