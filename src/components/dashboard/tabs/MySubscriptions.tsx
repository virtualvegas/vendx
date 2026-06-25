import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Loader2, Pause, Play, X, RefreshCw, AlertTriangle, CheckCircle2, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type Sub = any;

const statusColor = (s: string) => {
  switch (s) {
    case "active": return "bg-green-500/15 text-green-500 border-green-500/30";
    case "paused": return "bg-yellow-500/15 text-yellow-500 border-yellow-500/30";
    case "past_due": return "bg-orange-500/15 text-orange-500 border-orange-500/30";
    case "cancelled": return "bg-muted text-muted-foreground border-border";
    case "pending": return "bg-blue-500/15 text-blue-500 border-blue-500/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

export default function MySubscriptions() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: subs, isLoading } = useQuery({
    queryKey: ["my-subscriptions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("store_subscriptions")
        .select("*, product:store_products(name, slug, images, subscription_interval, subscription_price, price)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Sub[];
    },
  });

  const act = useMutation({
    mutationFn: async ({ subscriptionId, action, reason }: { subscriptionId: string; action: string; reason?: string }) => {
      setBusyId(subscriptionId);
      const { data, error } = await supabase.functions.invoke("subscription-manage", {
        body: { subscriptionId, action, reason },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast({ title: data?.message || "Updated" });
      qc.invalidateQueries({ queryKey: ["my-subscriptions"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    onSettled: () => setBusyId(null),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!subs || subs.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <CreditCard className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>You don't have any active subscriptions yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">My Subscriptions</h2>
        <p className="text-sm text-muted-foreground">Manage, pause, or cancel your recurring plans.</p>
      </div>

      {subs.map((s: Sub) => {
        const product = s.product;
        const price = Number(product?.subscription_price || product?.price || 0);
        const interval = product?.subscription_interval || "month";
        const isActive = s.status === "active";
        const isPaused = s.status === "paused";
        const isCancelled = s.status === "cancelled";
        const isPastDue = s.status === "past_due";
        const busy = busyId === s.id;

        return (
          <Card key={s.id}>
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <div className="flex items-center gap-3">
                {product?.images?.[0] && (
                  <img src={product.images[0]} alt={product.name} className="w-12 h-12 rounded object-cover" />
                )}
                <div>
                  <CardTitle className="text-base">{product?.name || "Subscription"}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    ${price.toFixed(2)} / {interval} · via {s.provider === "paypal" ? "PayPal" : "Card"}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className={statusColor(s.status)}>{s.status}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {isPastDue && (
                <div className="flex items-start gap-2 p-3 rounded-md border border-orange-500/30 bg-orange-500/5 text-sm">
                  <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-orange-500">Payment failed</p>
                    <p className="text-muted-foreground text-xs">
                      {s.last_payment_failure_reason || "We couldn't charge your payment method."}
                      {s.next_retry_at && ` Next automatic retry: ${format(new Date(s.next_retry_at), "MMM d, yyyy")}.`}
                    </p>
                  </div>
                </div>
              )}

              {s.cancel_at_period_end && !isCancelled && (
                <div className="flex items-start gap-2 p-3 rounded-md border border-yellow-500/30 bg-yellow-500/5 text-sm">
                  <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                  <p className="text-muted-foreground">
                    Cancelling at end of period
                    {s.current_period_end ? ` (${format(new Date(s.current_period_end), "MMM d, yyyy")})` : ""}.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Started</p>
                  <p>{s.created_at ? format(new Date(s.created_at), "MMM d, yyyy") : "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Next billing</p>
                  <p>{s.current_period_end ? format(new Date(s.current_period_end), "MMM d, yyyy") : "—"}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {isPastDue && (
                  <Button size="sm" disabled={busy} onClick={() => act.mutate({ subscriptionId: s.id, action: "retry_payment" })}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Retry payment
                  </Button>
                )}
                {isActive && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => act.mutate({ subscriptionId: s.id, action: "pause" })}>
                    <Pause className="h-4 w-4" /> Pause
                  </Button>
                )}
                {isPaused && (
                  <Button size="sm" disabled={busy} onClick={() => act.mutate({ subscriptionId: s.id, action: "resume" })}>
                    <Play className="h-4 w-4" /> Resume
                  </Button>
                )}
                {!isCancelled && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive" disabled={busy}>
                        <X className="h-4 w-4" /> Cancel
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancel this subscription?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {s.provider === "stripe"
                            ? "Your subscription will stay active until the end of your current billing period."
                            : "Your PayPal subscription will be cancelled immediately and you won't be billed again."}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep subscription</AlertDialogCancel>
                        <AlertDialogAction onClick={() => act.mutate({ subscriptionId: s.id, action: "cancel" })}>
                          Confirm cancellation
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                {isCancelled && (
                  <Badge variant="outline" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Ended</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
