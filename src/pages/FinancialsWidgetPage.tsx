import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useSEO } from "@/hooks/useSEO";
import {
  DollarSign, TrendingUp, Clock, Monitor, Wifi, CreditCard,
  RefreshCw, LogIn, Share, PlusSquare, Smartphone, Wallet,
} from "lucide-react";

const money = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const ALLOWED_ROLES = [
  "super_admin",
  "global_operations_manager",
  "finance_accounting",
  "regional_manager",
];

const FinancialsWidgetPage = () => {
  useSEO({ title: "VendX Live Financials", description: "Live revenue, sales, and pending payments." });
  const [user, setUser] = useState<any>(undefined);
  const [allowed, setAllowed] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Only privileged staff may view financials
  useEffect(() => {
    if (user === undefined) return;
    if (!user) { setAllowed(false); return; }
    let active = true;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (!active) return;
        setAllowed((data || []).some((r: any) => ALLOWED_ROLES.includes(r.role)));
      });
    return () => { active = false; };
  }, [user]);

  // Use the dedicated financials manifest only for authorized staff,
  // so customers installing the site get the normal VendX app instead.
  useEffect(() => {
    if (!allowed) return;
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) return;
    const original = link.getAttribute("href");
    link.setAttribute("href", "/widget-manifest.webmanifest");
    return () => { if (original) link.setAttribute("href", original); };
  }, [allowed]);

  const { data, isLoading, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ["financials-widget"],
    enabled: !!user && allowed === true,
    refetchInterval: 30_000,
    queryFn: async () => {
      const now = new Date();
      const today = localDate(now);
      const weekStart = localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
      const monthStart = localDate(new Date(now.getFullYear(), now.getMonth(), 1));

      const [
        incomeToday, incomeWeek, incomeMonth, expensesMonth,
        posToday, pendingIncome, extInvoices, storeOrders, machines,
      ] = await Promise.all([
        supabase.from("finance_income" as any).select("amount").gte("income_date", today).neq("status", "cancelled"),
        supabase.from("finance_income" as any).select("amount").gte("income_date", weekStart).neq("status", "cancelled"),
        supabase.from("finance_income" as any).select("amount").gte("income_date", monthStart).neq("status", "cancelled"),
        supabase.from("finance_expenses" as any).select("amount").gte("expense_date", monthStart).neq("status", "cancelled"),
        supabase.from("vendx_pos_receipts").select("total_amount").gte("receipt_date", `${today}T00:00:00`),
        supabase.from("finance_income" as any).select("amount").eq("status", "pending"),
        supabase.from("vendx_external_service_invoices" as any).select("total, amount_paid").in("status", ["draft", "sent", "overdue", "partial"]),
        supabase.from("store_orders" as any).select("total").in("status", ["pending", "awaiting_payment", "payment_pending", "processing"]),
        supabase.from("vendx_machines").select("id, status"),
      ]);

      const sum = (rows: any[] | null, key = "amount") =>
        (rows || []).reduce((s, r) => s + Number(r[key] || 0), 0);

      const pending =
        sum(pendingIncome.data as any[]) +
        ((extInvoices.data as any[]) || []).reduce((s, r) => s + Math.max(0, Number(r.total || 0) - Number(r.amount_paid || 0)), 0) +
        sum(storeOrders.data as any[], "total");
      const pendingCount =
        (pendingIncome.data?.length || 0) + (extInvoices.data?.length || 0) + (storeOrders.data?.length || 0);

      const allMachines = machines.data || [];
      const online = allMachines.filter((m: any) => m.status === "active" || m.status === "online").length;

      const monthIncome = sum(incomeMonth.data as any[]);
      const monthExpenses = sum(expensesMonth.data as any[]);

      return {
        today: sum(incomeToday.data as any[]),
        week: sum(incomeWeek.data as any[]),
        month: monthIncome,
        expensesMonth: monthExpenses,
        netMonth: monthIncome - monthExpenses,
        posToday: sum(posToday.data as any[], "total_amount"),
        posCount: posToday.data?.length || 0,
        pending,
        pendingCount,
        machinesTotal: allMachines.length,
        machinesOnline: online,
      };
    },
  });

  if (user === undefined || (user && allowed === undefined)) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  if (user === null) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6 text-center">
        <img src="/icons/icon-192.png" alt="VendX" className="w-16 h-16 rounded-2xl" />
        <h1 className="text-xl font-bold">VendX Live Financials</h1>
        <p className="text-sm text-muted-foreground">Sign in to see your live numbers.</p>
        <Button onClick={() => { window.location.href = "/auth"; }}>
          <LogIn className="w-4 h-4 mr-2" /> Sign In
        </Button>
      </div>
    );
  }

  if (allowed === false) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6 text-center">
        <img src="/icons/icon-192.png" alt="VendX" className="w-16 h-16 rounded-2xl" />
        <h1 className="text-xl font-bold">Restricted</h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          This financials view is only available to VendX staff accounts.
        </p>
        <Button variant="outline" onClick={() => { window.location.href = "/"; }}>
          Go to VendX
        </Button>
      </div>
    );
  }



  const cards = [
    { label: "Today", value: money(data?.today ?? 0), icon: DollarSign, color: "text-primary", glow: "glow-blue" },
    { label: "Last 7 Days", value: money(data?.week ?? 0), icon: TrendingUp, color: "text-accent", glow: "glow-green" },
    { label: "This Month", value: money(data?.month ?? 0), icon: Wallet, color: "text-primary", glow: "glow-blue" },
    { label: "Net This Month", value: money(data?.netMonth ?? 0), icon: TrendingUp, color: (data?.netMonth ?? 0) >= 0 ? "text-green-400" : "text-red-400", glow: "" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <div className="max-w-md mx-auto p-4 space-y-4 pb-10">
        {/* Header */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <img src="/icons/icon-192.png" alt="VendX" className="w-9 h-9 rounded-xl" />
            <div>
              <h1 className="text-base font-bold leading-tight">Live Financials</h1>
              <p className="text-[10px] text-muted-foreground">
                Updated {new Date(dataUpdatedAt || Date.now()).toLocaleTimeString()} · auto-refresh 30s
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Today hero */}
        <div className="relative rounded-3xl border-2 border-primary/40 bg-card/60 backdrop-blur-sm p-6 text-center shadow-[0_0_50px_rgba(26,124,255,0.25)]">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Today's Revenue</p>
          <p className="text-5xl font-bold glow-blue mt-2">{isLoading ? "—" : money(data?.today ?? 0)}</p>
          <p className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1">
            <CreditCard className="w-3 h-3" /> POS today: {money(data?.posToday ?? 0)} · {data?.posCount ?? 0} sales
          </p>
        </div>

        {/* Revenue grid */}
        <div className="grid grid-cols-2 gap-3">
          {cards.map((c) => (
            <div key={c.label} className="rounded-2xl border border-border/60 bg-card/50 p-4">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <c.icon className={`w-3.5 h-3.5 ${c.color}`} />
                <span className="text-[10px] uppercase tracking-wide">{c.label}</span>
              </div>
              <p className={`text-xl font-bold mt-1.5 ${c.color} ${c.glow}`}>{isLoading ? "—" : c.value}</p>
            </div>
          ))}
        </div>

        {/* Pending money */}
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-amber-400">
              <Clock className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wide">Pending Money</span>
            </div>
            <span className="text-[10px] text-muted-foreground">{data?.pendingCount ?? 0} open</span>
          </div>
          <p className="text-3xl font-bold text-amber-400 mt-2">{isLoading ? "—" : money(data?.pending ?? 0)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Unpaid invoices, pending income & store orders</p>
        </div>

        {/* Machines */}
        <div className="rounded-2xl border border-border/60 bg-card/50 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Machines</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1 text-green-400"><Wifi className="w-3.5 h-3.5" />{data?.machinesOnline ?? 0} online</span>
            <span className="text-muted-foreground">{data?.machinesTotal ?? 0} total</span>
          </div>
        </div>

        {/* Add to home screen hint */}
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-2">
          <p className="text-xs font-semibold flex items-center gap-1.5"><Smartphone className="w-4 h-4 text-primary" /> Add this widget to your home screen</p>
          <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
            <Share className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            iPhone: tap Share in Safari, then "Add to Home Screen".
          </p>
          <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
            <PlusSquare className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Android: open the browser menu (⋮), then "Add to Home screen" or "Install app".
          </p>
        </div>
      </div>
    </div>
  );
};

export default FinancialsWidgetPage;
