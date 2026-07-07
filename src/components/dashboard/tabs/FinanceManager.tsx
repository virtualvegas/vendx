import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, Receipt, Repeat, PiggyBank, Package, TrendingUp, Clock, BarChart3, Target, FileMinus, FilePlus, Landmark, Calendar, Scale, Globe } from "lucide-react";
import { RecurringBillsTab } from "./finance-manager/RecurringBillsTab";
import { TaxTab } from "./finance-manager/TaxTab";
import { CurrencyTab } from "./finance-manager/CurrencyTab";
import { AccountsTab } from "./finance-manager/AccountsTab";
import { ExpensesTab } from "./finance-manager/ExpensesTab";
import { IncomeTab } from "./finance-manager/IncomeTab";
import { SubscriptionsTab } from "./finance-manager/SubscriptionsTab";
import { TaxVaultTab } from "./finance-manager/TaxVaultTab";
import { ReinvestmentsTab } from "./finance-manager/ReinvestmentsTab";
import { PendingPaymentsTab } from "./finance-manager/PendingPaymentsTab";
import { ReportsTab } from "./finance-manager/ReportsTab";
import { BudgetsTab } from "./finance-manager/BudgetsTab";
import { ApBillsTab } from "./finance-manager/ApBillsTab";
import { ArInvoicesTab } from "./finance-manager/ArInvoicesTab";
import { BankReconTab } from "./finance-manager/BankReconTab";

const FinanceManager = () => {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold">Finance Manager</h1>
        <p className="text-sm text-muted-foreground">Full accounting: reports, budgets, AP/AR, bank reconciliation, and more.</p>
      </div>

      <Tabs defaultValue="reports" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto justify-start">
          <TabsTrigger value="reports" className="gap-1.5 text-xs md:text-sm"><BarChart3 className="h-4 w-4" />Reports</TabsTrigger>
          <TabsTrigger value="accounts" className="gap-1.5 text-xs md:text-sm"><Wallet className="h-4 w-4" />Accounts</TabsTrigger>
          <TabsTrigger value="income" className="gap-1.5 text-xs md:text-sm"><TrendingUp className="h-4 w-4" />Income</TabsTrigger>
          <TabsTrigger value="expenses" className="gap-1.5 text-xs md:text-sm"><Receipt className="h-4 w-4" />Expenses</TabsTrigger>
          <TabsTrigger value="budgets" className="gap-1.5 text-xs md:text-sm"><Target className="h-4 w-4" />Budgets</TabsTrigger>
          <TabsTrigger value="ap" className="gap-1.5 text-xs md:text-sm"><FileMinus className="h-4 w-4" />AP Bills</TabsTrigger>
          <TabsTrigger value="ar" className="gap-1.5 text-xs md:text-sm"><FilePlus className="h-4 w-4" />AR Invoices</TabsTrigger>
          <TabsTrigger value="bank" className="gap-1.5 text-xs md:text-sm"><Landmark className="h-4 w-4" />Bank Recon</TabsTrigger>
          <TabsTrigger value="recurring" className="gap-1.5 text-xs md:text-sm"><Calendar className="h-4 w-4" />Recurring</TabsTrigger>
          <TabsTrigger value="pending" className="gap-1.5 text-xs md:text-sm"><Clock className="h-4 w-4" />Pending</TabsTrigger>
          <TabsTrigger value="subscriptions" className="gap-1.5 text-xs md:text-sm"><Repeat className="h-4 w-4" />Subs</TabsTrigger>
          <TabsTrigger value="tax" className="gap-1.5 text-xs md:text-sm"><PiggyBank className="h-4 w-4" />Tax Vault</TabsTrigger>
          <TabsTrigger value="tax-advanced" className="gap-1.5 text-xs md:text-sm"><Scale className="h-4 w-4" />Tax Pro</TabsTrigger>
          <TabsTrigger value="currency" className="gap-1.5 text-xs md:text-sm"><Globe className="h-4 w-4" />Currency</TabsTrigger>
          <TabsTrigger value="reinvest" className="gap-1.5 text-xs md:text-sm"><Package className="h-4 w-4" />Reinvest</TabsTrigger>
        </TabsList>
        <TabsContent value="reports"><ReportsTab /></TabsContent>
        <TabsContent value="accounts"><AccountsTab /></TabsContent>
        <TabsContent value="income"><IncomeTab /></TabsContent>
        <TabsContent value="expenses"><ExpensesTab /></TabsContent>
        <TabsContent value="budgets"><BudgetsTab /></TabsContent>
        <TabsContent value="ap"><ApBillsTab /></TabsContent>
        <TabsContent value="ar"><ArInvoicesTab /></TabsContent>
        <TabsContent value="bank"><BankReconTab /></TabsContent>
        <TabsContent value="recurring"><RecurringBillsTab /></TabsContent>
        <TabsContent value="pending"><PendingPaymentsTab /></TabsContent>
        <TabsContent value="subscriptions"><SubscriptionsTab /></TabsContent>
        <TabsContent value="tax"><TaxVaultTab /></TabsContent>
        <TabsContent value="tax-advanced"><TaxTab /></TabsContent>
        <TabsContent value="currency"><CurrencyTab /></TabsContent>
        <TabsContent value="reinvest"><ReinvestmentsTab /></TabsContent>
      </Tabs>
    </div>
  );
};

export default FinanceManager;
