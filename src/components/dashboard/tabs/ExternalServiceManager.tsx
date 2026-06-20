import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ExtClientsPanel from "./external-service/ExtClientsPanel";
import ExtLocationsPanel from "./external-service/ExtLocationsPanel";
import ExtMachinesPanel from "./external-service/ExtMachinesPanel";
import ExtTicketsPanel from "./external-service/ExtTicketsPanel";
import ExtInvoicesPanel from "./external-service/ExtInvoicesPanel";
import ExtPackagesPanel from "./external-service/ExtPackagesPanel";

const ExternalServiceManager = () => {
  const [tab, setTab] = useState("tickets");
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">External Service Management</h1>
        <p className="text-sm text-muted-foreground">
          Internal-only system for servicing client-owned machines. Tracks clients, locations,
          machines, service tickets, and invoiced labor/parts.
        </p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="tickets">Service Tickets</TabsTrigger>
            <TabsTrigger value="clients">Clients</TabsTrigger>
            <TabsTrigger value="locations">Client Sites</TabsTrigger>
            <TabsTrigger value="machines">Client Machines</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="packages">Packages & Pricing</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="tickets" className="mt-4"><ExtTicketsPanel /></TabsContent>
        <TabsContent value="clients" className="mt-4"><ExtClientsPanel /></TabsContent>
        <TabsContent value="locations" className="mt-4"><ExtLocationsPanel /></TabsContent>
        <TabsContent value="machines" className="mt-4"><ExtMachinesPanel /></TabsContent>
        <TabsContent value="invoices" className="mt-4"><ExtInvoicesPanel /></TabsContent>
        <TabsContent value="packages" className="mt-4"><ExtPackagesPanel /></TabsContent>
      </Tabs>
    </div>
  );
};

export default ExternalServiceManager;
