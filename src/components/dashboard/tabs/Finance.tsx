import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

const Finance = () => {
  const { data: divisions, isLoading } = useQuery({
    queryKey: ["finance-divisions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("divisions")
        .select("*")
        .eq("status", "active");
      
      if (error) throw error;
      return data;
    },
  });

  const financialMetrics = {
    monthlyRevenue: 847000,
    operatingCosts: 324000,
    netProfit: 523000,
    profitMargin: 61.7,
  };

  const divisionRevenue: Record<string, number> = {
    "VendX Mini": 245000,
    "VendX Max": 312000,
    "VendX Fresh": 178000,
    "VendX Digital": 112000,
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Finance & Accounting</h2>
        <p className="text-muted-foreground">
          Track revenue, expenses, and financial performance
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Monthly Revenue</h3>
          <p className="text-3xl font-bold text-foreground">
            ${(financialMetrics.monthlyRevenue / 1000).toFixed(0)}K
          </p>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Operating Costs</h3>
          <p className="text-3xl font-bold text-foreground">
            ${(financialMetrics.operatingCosts / 1000).toFixed(0)}K
          </p>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Net Profit</h3>
          <p className="text-3xl font-bold text-primary">
            ${(financialMetrics.netProfit / 1000).toFixed(0)}K
          </p>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Profit Margin</h3>
          <p className="text-3xl font-bold text-foreground">{financialMetrics.profitMargin}%</p>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Revenue by Division</h3>
        <div className="space-y-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse flex items-center justify-between">
                <div className="h-4 bg-muted rounded w-1/3" />
                <div className="h-4 bg-muted rounded w-20" />
              </div>
            ))
          ) : (
            divisions?.slice(0, 4).map((division) => {
              const revenue = divisionRevenue[division.name] || Math.floor(Math.random() * 300000) + 100000;
              return (
                <div key={division.id} className="flex items-center justify-between">
                  <span className="text-foreground">{division.name}</span>
                  <span className="text-muted-foreground font-medium">
                    ${(revenue / 1000).toFixed(0)}K
                  </span>
                </div>
              );
            })
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Expense Breakdown</h3>
          <div className="space-y-3">
            {[
              { category: "Maintenance", amount: 124000, percentage: 38 },
              { category: "Logistics", amount: 98000, percentage: 30 },
              { category: "Staff", amount: 72000, percentage: 22 },
              { category: "Other", amount: 30000, percentage: 10 },
            ].map((expense) => (
              <div key={expense.category} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{expense.category}</span>
                  <span className="text-muted-foreground">
                    ${(expense.amount / 1000).toFixed(0)}K ({expense.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full"
                    style={{ width: `${expense.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Payment Methods</h3>
          <div className="space-y-3">
            {[
              { method: "Credit/Debit Cards", percentage: 62 },
              { method: "Mobile Payments", percentage: 28 },
              { method: "Cash", percentage: 8 },
              { method: "Other", percentage: 2 },
            ].map((payment) => (
              <div key={payment.method} className="flex items-center justify-between">
                <span className="text-foreground">{payment.method}</span>
                <span className="text-muted-foreground text-sm">{payment.percentage}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Finance;
