import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, Receipt, Store } from "lucide-react";
import POSOverviewPanel from "./admin/POSOverviewPanel";
import POSReceiptsPanel from "./admin/POSReceiptsPanel";
import POSStoresPanel from "./admin/POSStoresPanel";

const POSManager = () => {
  return (
    <div className="space-y-6 overflow-x-hidden">
      <div>
        <h1 className="text-3xl font-bold">Point of Sale</h1>
        <p className="text-muted-foreground">
          PayPal Zettle registers, receipts, store mapping, and finance posting.
        </p>
      </div>

      <Tabs defaultValue="overview">
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="overview"><CreditCard className="w-4 h-4 mr-1" />Overview</TabsTrigger>
            <TabsTrigger value="receipts"><Receipt className="w-4 h-4 mr-1" />Receipts</TabsTrigger>
            <TabsTrigger value="stores"><Store className="w-4 h-4 mr-1" />Stores & Finance</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-6 overflow-x-auto"><POSOverviewPanel /></TabsContent>
        <TabsContent value="receipts" className="mt-6 overflow-x-auto"><POSReceiptsPanel /></TabsContent>
        <TabsContent value="stores" className="mt-6 overflow-x-auto"><POSStoresPanel /></TabsContent>
      </Tabs>
    </div>
  );
};

export default POSManager;
