import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Monitor } from "lucide-react";
import { useBusinessOwnerData } from "./useBusinessOwnerData";

const BusinessMachines = () => {
  const { machines, profitSplits, isLoading } = useBusinessOwnerData();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading machines...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">My Machines</h2>
        <p className="text-muted-foreground">View all machines at your locations</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            Machines at Your Locations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!machines || machines.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No machines at your locations</p>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Machine</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Your Split</TableHead>
                    <TableHead>Period Revenue</TableHead>
                    <TableHead>Your Share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {machines?.map((machine) => {
                    const split = profitSplits?.find(s => s.machine_id === machine.id);
                    const ownerPercentage = split?.business_owner_percentage || 30;
                    const revenue = Number(machine.current_period_revenue || 0);
                    const share = revenue * (ownerPercentage / 100);
                    
                    return (
                      <TableRow key={machine.id}>
                        <TableCell>
                          <p className="font-medium">{machine.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{machine.machine_code}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{machine.machine_type}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={machine.status === "active" ? "default" : machine.status === "offline" ? "destructive" : "secondary"}>
                            {machine.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{ownerPercentage}%</span>
                        </TableCell>
                        <TableCell>${revenue.toLocaleString()}</TableCell>
                        <TableCell className="font-bold text-green-500">${share.toLocaleString()}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BusinessMachines;
