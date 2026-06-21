import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, ArrowRight, Wrench, Gamepad2, ShoppingBag, FileText, Music, Megaphone, Banknote, Package, CreditCard } from "lucide-react";

interface Props {
  /** Optional click handler — e.g. switch to the Finance > Pending tab. */
  onViewAll?: () => void;
  /** Tighter padding for embedding inside overview pages. */
  compact?: boolean;
}

type PendingItem = {
  id: string;
  kind: string;
  label: string;
  party: string;
  amount: number;
  icon: any;
  color: string;
};

export const PendingTransactionsSummary = ({ onViewAll, compact }: Props) => {
  const { data, isLoading } = useQuery({
    queryKey: ["pending-transactions-summary"],
    queryFn: async () => {
      const [extInv, custom, storeO, incomePending, beats, ads, payouts, eco, branded, merchant] = await Promise.all([
        supabase.from("vendx_external_service_invoices" as any)
          .select("id, invoice_number, total, amount_paid, status, client:vendx_external_clients(company_name)")
          .in("status", ["draft", "sent", "overdue", "partial"]),
        supabase.from("vendx_custom_arcade_requests" as any)
          .select("id, request_number, full_name, quoted_price, status, payment_status")
          .gt("quoted_price", 0).neq("payment_status", "paid").in("status", ["quoted", "accepted"]),
        supabase.from("store_orders" as any)
          .select("id, order_number, customer_name, customer_email, total, status")
          .in("status", ["pending", "awaiting_payment", "payment_pending", "processing"]),
        supabase.from("finance_income" as any)
          .select("id, source, description, amount, status").eq("status", "pending"),
        supabase.from("beat_purchases" as any)
          .select("id, amount, buyer_email, payment_status").in("payment_status", ["pending", "processing"]),
        supabase.from("ad_bookings" as any)
          .select("id, total_amount, advertiser_name, status").in("status", ["pending", "pending_payment", "awaiting_payment"]),
        supabase.from("payouts" as any)
          .select("id, amount, owner_name, status").in("status", ["pending", "scheduled", "processing"]),
        supabase.from("ecosnack_locker_purchases" as any)
          .select("id, amount, customer_email, payment_status").in("payment_status", ["pending", "processing"]),
        supabase.from("branded_game_requests" as any)
          .select("id, company_name, quoted_price, status")
          .gt("quoted_price", 0).in("status", ["pending", "quoted", "approved", "in_production"]),
        supabase.from("vendx_merchant_payment_sessions" as any)
          .select("id, amount, customer_email, status").in("status", ["pending", "awaiting_payment", "processing"]),
      ]);

      const items: PendingItem[] = [];
      let total = 0;
      const sources: Record<string, { count: number; amount: number; label: string; icon: any; color: string }> = {};
      const bump = (k: string, label: string, icon: any, color: string, amt: number) => {
        if (!sources[k]) sources[k] = { count: 0, amount: 0, label, icon, color };
        sources[k].count += 1;
        sources[k].amount += amt;
        total += amt;
      };

      (extInv.data as any[] || []).forEach(r => {
        const amt = Math.max(0, Number(r.total || 0) - Number(r.amount_paid || 0));
        bump("ext_invoice", "External invoices", Wrench, "text-blue-400", amt);
        items.push({ id: r.id, kind: "ext_invoice", label: r.invoice_number, party: r.client?.company_name || "—", amount: amt, icon: Wrench, color: "text-blue-400" });
      });
      (custom.data as any[] || []).forEach(r => {
        const amt = Number(r.quoted_price || 0);
        bump("custom_arcade", "Custom arcade builds", Gamepad2, "text-purple-400", amt);
        items.push({ id: r.id, kind: "custom_arcade", label: r.request_number, party: r.full_name, amount: amt, icon: Gamepad2, color: "text-purple-400" });
      });
      (storeO.data as any[] || []).forEach(r => {
        const amt = Number(r.total || 0);
        bump("store_order", "Store orders", ShoppingBag, "text-amber-400", amt);
        items.push({ id: r.id, kind: "store_order", label: r.order_number || r.id.slice(0, 8), party: r.customer_name || r.customer_email || "—", amount: amt, icon: ShoppingBag, color: "text-amber-400" });
      });
      (incomePending.data as any[] || []).forEach(r => {
        const amt = Number(r.amount || 0);
        bump("income_pending", "Pending income", FileText, "text-emerald-400", amt);
        items.push({ id: r.id, kind: "income_pending", label: r.source || "Income", party: r.description || "—", amount: amt, icon: FileText, color: "text-emerald-400" });
      });
      (beats.data as any[] || []).forEach(r => {
        const amt = Number(r.amount || 0);
        bump("beat", "Beat purchases", Music, "text-pink-400", amt);
        items.push({ id: r.id, kind: "beat", label: "Beat", party: r.buyer_email || "—", amount: amt, icon: Music, color: "text-pink-400" });
      });
      (ads.data as any[] || []).forEach(r => {
        const amt = Number(r.total_amount || 0);
        bump("ad", "Ad bookings", Megaphone, "text-orange-400", amt);
        items.push({ id: r.id, kind: "ad", label: "Ad booking", party: r.advertiser_name || "—", amount: amt, icon: Megaphone, color: "text-orange-400" });
      });
      (payouts.data as any[] || []).forEach(r => {
        const amt = Number(r.amount || 0);
        bump("payout", "Payouts owed", Banknote, "text-red-400", amt);
        items.push({ id: r.id, kind: "payout", label: "Payout", party: r.owner_name || "—", amount: amt, icon: Banknote, color: "text-red-400" });
      });
      (eco.data as any[] || []).forEach(r => {
        const amt = Number(r.amount || 0);
        bump("eco", "EcoSnack lockers", Package, "text-teal-400", amt);
        items.push({ id: r.id, kind: "eco", label: "EcoSnack", party: r.customer_email || "—", amount: amt, icon: Package, color: "text-teal-400" });
      });
      (branded.data as any[] || []).forEach(r => {
        const amt = Number(r.quoted_price || 0);
        bump("branded", "Branded games", Gamepad2, "text-indigo-400", amt);
        items.push({ id: r.id, kind: "branded", label: "Branded game", party: r.company_name || "—", amount: amt, icon: Gamepad2, color: "text-indigo-400" });
      });
      (merchant.data as any[] || []).forEach(r => {
        const amt = Number(r.amount || 0);
        bump("merchant", "Merchant sessions", CreditCard, "text-cyan-400", amt);
        items.push({ id: r.id, kind: "merchant", label: "Merchant", party: r.customer_email || "—", amount: amt, icon: CreditCard, color: "text-cyan-400" });
      });

      items.sort((a, b) => b.amount - a.amount);
      const totalCount = items.length;
      return { items: items.slice(0, 6), totalCount, total, sources: Object.values(sources).sort((a, b) => b.amount - a.amount) };
    },
    refetchInterval: 60_000,
  });

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader className={compact ? "pb-2" : "pb-3"}>
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" /> Pending Transactions
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isLoading ? "Loading..." : `${data?.totalCount ?? 0} open · awaiting payment / processing`}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-amber-400">
              ${(data?.total ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            {onViewAll && (
              <Button variant="ghost" size="sm" onClick={onViewAll} className="h-7 px-2 gap-1 text-xs">
                View all <ArrowRight className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {(data?.sources?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {data!.sources.map((s, i) => {
              const Icon = s.icon;
              return (
                <Badge key={i} variant="outline" className="gap-1 font-normal">
                  <Icon className={`w-3 h-3 ${s.color}`} /> {s.label}
                  <span className="text-muted-foreground">· {s.count} · ${s.amount.toFixed(0)}</span>
                </Badge>
              );
            })}
          </div>
        )}
        {(data?.items?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-3">No pending transactions — you're all caught up.</p>
        ) : (
          <div className="space-y-1">
            {data!.items.map((it) => {
              const Icon = it.icon;
              return (
                <div key={`${it.kind}-${it.id}`} className="flex items-center justify-between gap-2 text-sm py-1.5 border-b border-border/30 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${it.color}`} />
                    <span className="font-mono text-xs text-muted-foreground shrink-0">{it.label}</span>
                    <span className="truncate text-foreground/80">{it.party}</span>
                  </div>
                  <span className="font-semibold shrink-0">${it.amount.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PendingTransactionsSummary;
