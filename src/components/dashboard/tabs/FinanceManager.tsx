import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, Receipt, Repeat, PiggyBank, Package, TrendingUp } from "lucide-react";
import { AccountsTab } from "./finance-manager/AccountsTab";
import { ExpensesTab } from "./finance-manager/ExpensesTab";
import { IncomeTab } from "./finance-manager/IncomeTab";
import { SubscriptionsTab } from "./finance-manager/SubscriptionsTab";
import { TaxVaultTab } from "./finance-manager/TaxVaultTab";
import { ReinvestmentsTab } from "./finance-manager/ReinvestmentsTab";

const FinanceManager = () => {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold">Finance Manager</h1>
        <p className="text-sm text-muted-foreground">Accounts, income, expenses, subscriptions, tax vault & inventory reinvestment.</p>
      </div>

      <Tabs defaultValue="accounts" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 h-auto">
          <TabsTrigger value="accounts" className="gap-1.5 text-xs md:text-sm"><Wallet className="h-4 w-4" />Accounts</TabsTrigger>
          <TabsTrigger value="income" className="gap-1.5 text-xs md:text-sm"><TrendingUp className="h-4 w-4" />Income</TabsTrigger>
          <TabsTrigger value="expenses" className="gap-1.5 text-xs md:text-sm"><Receipt className="h-4 w-4" />Expenses</TabsTrigger>
          <TabsTrigger value="subscriptions" className="gap-1.5 text-xs md:text-sm"><Repeat className="h-4 w-4" />Subs</TabsTrigger>
          <TabsTrigger value="tax" className="gap-1.5 text-xs md:text-sm"><PiggyBank className="h-4 w-4" />Tax</TabsTrigger>
          <TabsTrigger value="reinvest" className="gap-1.5 text-xs md:text-sm"><Package className="h-4 w-4" />Reinvest</TabsTrigger>
        </TabsList>
        <TabsContent value="accounts"><AccountsTab /></TabsContent>
        <TabsContent value="income"><IncomeTab /></TabsContent>
        <TabsContent value="expenses"><ExpensesTab /></TabsContent>
        <TabsContent value="subscriptions"><SubscriptionsTab /></TabsContent>
        <TabsContent value="tax"><TaxVaultTab /></TabsContent>
        <TabsContent value="reinvest"><ReinvestmentsTab /></TabsContent>
      </Tabs>
    </div>
  );
};

export default FinanceManager;
