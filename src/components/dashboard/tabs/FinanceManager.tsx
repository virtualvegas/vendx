import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, Receipt, Repeat, PiggyBank, Package } from "lucide-react";
import { AccountsTab } from "./finance-manager/AccountsTab";
import { ExpensesTab } from "./finance-manager/ExpensesTab";
import { SubscriptionsTab } from "./finance-manager/SubscriptionsTab";
import { TaxVaultTab } from "./finance-manager/TaxVaultTab";
import { ReinvestmentsTab } from "./finance-manager/ReinvestmentsTab";

const FinanceManager = () => {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold">Finance Manager</h1>
        <p className="text-muted-foreground">Bank-grade financial control: accounts, expenses, subscriptions, tax vault, and inventory reinvestment.</p>
      </div>

      <Tabs defaultValue="accounts" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto">
          <TabsTrigger value="accounts" className="gap-2"><Wallet className="h-4 w-4" />Accounts</TabsTrigger>
          <TabsTrigger value="expenses" className="gap-2"><Receipt className="h-4 w-4" />Expenses</TabsTrigger>
          <TabsTrigger value="subscriptions" className="gap-2"><Repeat className="h-4 w-4" />Subscriptions</TabsTrigger>
          <TabsTrigger value="tax" className="gap-2"><PiggyBank className="h-4 w-4" />Tax Vault</TabsTrigger>
          <TabsTrigger value="reinvest" className="gap-2"><Package className="h-4 w-4" />Reinvestments</TabsTrigger>
        </TabsList>
        <TabsContent value="accounts"><AccountsTab /></TabsContent>
        <TabsContent value="expenses"><ExpensesTab /></TabsContent>
        <TabsContent value="subscriptions"><SubscriptionsTab /></TabsContent>
        <TabsContent value="tax"><TaxVaultTab /></TabsContent>
        <TabsContent value="reinvest"><ReinvestmentsTab /></TabsContent>
      </Tabs>
    </div>
  );
};

export default FinanceManager;
