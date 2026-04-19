import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { format } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from "recharts";

interface IncomeRow {
  id: string;
  amount: number;
  category: string;
  source: string;
  income_date: string;
  status: string;
}

interface ExpenseRow {
  id: string;
  amount: number;
  category: string;
  vendor: string | null;
  expense_date: string;
  status: string;
}

const COLORS = ["hsl(var(--primary))", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];

const Finance = () => {
  // Pull income data from finance_income (Finance Manager source of truth)
  const { data: income, isLoading: incomeLoading } = useQuery({
    queryKey: ["finance-overview-income"],
    queryFn: async () => {
      let all: IncomeRow[] = [];
      let from = 0;
      const batch = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("finance_income")
          .select("id, amount, category, source, income_date, status")
          .order("income_date", { ascending: false })
          .range(from, from + batch - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all = all.concat(data as IncomeRow[]);
        if (data.length < batch) break;
        from += batch;
      }
      return all;
    },
  });

  // Pull expense data from finance_expenses
  const { data: expenses, isLoading: expensesLoading } = useQuery({
    queryKey: ["finance-overview-expenses"],
    queryFn: async () => {
      let all: ExpenseRow[] = [];
      let from = 0;
      const batch = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("finance_expenses")
          .select("id, amount, category, vendor, expense_date, status")
          .order("expense_date", { ascending: false })
          .range(from, from + batch - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all = all.concat(data as ExpenseRow[]);
        if (data.length < batch) break;
        from += batch;
      }
      return all;
    },
  });

  // Pull accounts for total cash position
  const { data: accounts } = useQuery({
    queryKey: ["finance-overview-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_accounts")
        .select("id, name, current_balance, account_type, is_active")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const isLoading = incomeLoading || expensesLoading;

  // Top-level KPIs
  const kpis = useMemo(() => {
    const totalIncome = income?.reduce((sum, i) => sum + Number(i.amount), 0) || 0;
    const totalExpenses = expenses?.filter(e => e.status !== "cancelled")
      .reduce((sum, e) => sum + Number(e.amount), 0) || 0;
    const netProfit = totalIncome - totalExpenses;
    const profitMargin = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : "0.0";
    const cashOnHand = accounts?.reduce((sum, a) => sum + Number(a.current_balance), 0) || 0;
    return { totalIncome, totalExpenses, netProfit, profitMargin, cashOnHand };
  }, [income, expenses, accounts]);

  // Daily income vs expenses for the last 30 days
  const dailyData = useMemo(() => {
    const map = new Map<string, { day: string; income: number; expenses: number }>();
    const ensure = (d: string) => {
      if (!map.has(d)) map.set(d, { day: d, income: 0, expenses: 0 });
      return map.get(d)!;
    };
    income?.forEach(i => {
      ensure(i.income_date).income += Number(i.amount);
    });
    expenses?.filter(e => e.status !== "cancelled").forEach(e => {
      ensure(e.expense_date).expenses += Number(e.amount);
    });
    return Array.from(map.values())
      .sort((a, b) => a.day.localeCompare(b.day))
      .slice(-30)
      .map(d => {
        try {
          return { ...d, day: format(new Date(d.day + "T12:00:00"), "MM/dd") };
        } catch {
          return { ...d, day: d.day.substring(5) };
        }
      });
  }, [income, expenses]);

  // Income by category
  const incomeByCategory = useMemo(() => {
    const map = new Map<string, number>();
    income?.forEach(i => {
      const cat = i.category || "uncategorized";
      map.set(cat, (map.get(cat) || 0) + Number(i.amount));
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [income]);

  // Expenses by category
  const expensesByCategory = useMemo(() => {
    const map = new Map<string, number>();
    expenses?.filter(e => e.status !== "cancelled").forEach(e => {
      const cat = e.category || "uncategorized";
      map.set(cat, (map.get(cat) || 0) + Number(e.amount));
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [expenses]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading finance overview...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Finance Overview</h2>
        <p className="text-muted-foreground">
          Live snapshot of all income, expenses, and cash position. Manage details in{" "}
          <span className="text-primary font-medium">Finance Manager</span>.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Total Income
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-500">
              ${kpis.totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="w-4 h-4" /> Total Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-500">
              ${kpis.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Net Profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${kpis.netProfit >= 0 ? "text-primary" : "text-red-500"}`}>
              ${kpis.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Profit Margin</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{kpis.profitMargin}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="w-4 h-4" /> Cash on Hand
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-500">
              ${kpis.cashOnHand.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {accounts?.length || 0} active account{accounts?.length === 1 ? "" : "s"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income vs Expenses Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Income vs Expenses (Last 30 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {dailyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      formatter={(v: number) => `$${v.toLocaleString()}`}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="income" fill="#10b981" stroke="#10b981" fillOpacity={0.3} name="Income" />
                    <Area type="monotone" dataKey="expenses" fill="#ef4444" stroke="#ef4444" fillOpacity={0.3} name="Expenses" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">No data yet</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Financial Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Financial Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-green-500/10 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Total Income</p>
                  <p className="text-2xl font-bold text-green-500">
                    ${kpis.totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500/50" />
              </div>
              <div className="flex justify-between items-center p-4 bg-red-500/10 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Total Expenses</p>
                  <p className="text-2xl font-bold text-red-500">
                    ${kpis.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <TrendingDown className="h-8 w-8 text-red-500/50" />
              </div>
              <div className="flex justify-between items-center p-4 border-2 border-primary/30 rounded-lg bg-primary/5">
                <div>
                  <p className="text-sm text-muted-foreground">Net Profit</p>
                  <p className={`text-2xl font-bold ${kpis.netProfit >= 0 ? "text-primary" : "text-red-500"}`}>
                    ${kpis.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <Badge className="text-lg px-4 py-1">{kpis.profitMargin}%</Badge>
              </div>
              <div className="flex justify-between items-center p-4 bg-blue-500/10 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Cash on Hand</p>
                  <p className="text-2xl font-bold text-blue-500">
                    ${kpis.cashOnHand.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <Wallet className="h-8 w-8 text-blue-500/50" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Income by Category */}
        <Card>
          <CardHeader>
            <CardTitle>Income by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {incomeByCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={incomeByCategory}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {incomeByCategory.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">No income data</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Expenses by Category */}
        <Card>
          <CardHeader>
            <CardTitle>Expenses by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {expensesByCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={expensesByCategory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `$${v}`} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      formatter={(v: number) => `$${v.toLocaleString()}`}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                    />
                    <Bar dataKey="value" fill="#ef4444" radius={[4, 4, 0, 0]} name="Expenses" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">No expense data</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accounts breakdown */}
      {accounts && accounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Account Balances
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {accounts.map((acc) => (
                <div key={acc.id} className="p-4 border rounded-lg flex items-center justify-between">
                  <div>
                    <p className="font-medium">{acc.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{acc.account_type}</p>
                  </div>
                  <p className="text-lg font-bold text-blue-500">
                    ${Number(acc.current_balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Finance;
