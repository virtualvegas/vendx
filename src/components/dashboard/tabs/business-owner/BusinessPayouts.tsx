import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, Download, Wallet, Phone, Mail, FileText } from "lucide-react";
import { useBusinessOwnerData } from "./useBusinessOwnerData";

const VENDX_PHONE = "(781) 214-1806";
const VENDX_PHONE_TEL = "tel:+17812141806";
const VENDX_EMAIL = "partners@vendx.space";

const BusinessPayouts = () => {
  const { payouts, payoutSettings, isLoading } = useBusinessOwnerData();

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case "bank_transfer": return "Bank Transfer";
      case "stripe_connect": return "Stripe Connect";
      case "check": return "Check";
      default: return method;
    }
  };

  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case "weekly": return "Weekly";
      case "bi_weekly": return "Bi-Weekly";
      case "monthly": return "Monthly";
      default: return freq;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading payouts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Payouts & Settings</h2>
        <p className="text-muted-foreground">View payout history and manage settings</p>
      </div>

      {/* Payout Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Payout Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!payoutSettings ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No payout settings configured</p>
              <p className="text-sm text-muted-foreground mb-6">Contact VendX to set up your payout preferences</p>
              <div className="flex justify-center gap-3">
                <Button asChild>
                  <a href={VENDX_PHONE_TEL}>
                    <Phone className="w-4 h-4 mr-2" />
                    Call Us
                  </a>
                </Button>
                <Button variant="outline" asChild>
                  <a href={`mailto:${VENDX_EMAIL}`}>
                    <Mail className="w-4 h-4 mr-2" />
                    Email Us
                  </a>
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Payment Method</p>
                  <p className="font-medium text-lg">{getPaymentMethodLabel(payoutSettings.payment_method)}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Payout Frequency</p>
                  <p className="font-medium text-lg">{getFrequencyLabel(payoutSettings.payout_frequency)}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Minimum Payout Amount</p>
                  <p className="font-medium text-lg">${Number(payoutSettings.minimum_payout_amount).toLocaleString()}</p>
                </div>
              </div>
              <div className="space-y-4">
                {payoutSettings.payment_method === "bank_transfer" && payoutSettings.bank_name && (
                  <>
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Bank</p>
                      <p className="font-medium text-lg">{payoutSettings.bank_name}</p>
                    </div>
                    {payoutSettings.bank_account_last4 && (
                      <div className="p-4 border rounded-lg">
                        <p className="text-sm text-muted-foreground">Account</p>
                        <p className="font-medium text-lg">****{payoutSettings.bank_account_last4}</p>
                      </div>
                    )}
                  </>
                )}
                {payoutSettings.payment_method === "stripe_connect" && payoutSettings.stripe_account_id && (
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">Stripe Account</p>
                    <p className="font-medium text-lg">Connected ✓</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payout History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Payout History
          </CardTitle>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Gross Revenue</TableHead>
                  <TableHead>VendX Share</TableHead>
                  <TableHead>Your Payout</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Paid Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!payouts || payouts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No payouts yet
                    </TableCell>
                  </TableRow>
                ) : (
                  payouts.map((payout) => (
                    <TableRow key={payout.id}>
                      <TableCell>
                        <p className="font-medium">
                          {new Date(payout.period_start).toLocaleDateString()} - {new Date(payout.period_end).toLocaleDateString()}
                        </p>
                      </TableCell>
                      <TableCell>${Number(payout.gross_revenue).toLocaleString()}</TableCell>
                      <TableCell>${Number(payout.vendx_share).toLocaleString()}</TableCell>
                      <TableCell className="font-bold text-green-500">
                        ${Number(payout.amount).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          payout.status === "paid" ? "default" :
                          payout.status === "pending" ? "secondary" :
                          payout.status === "processing" ? "outline" : "destructive"
                        }>
                          {payout.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {payout.paid_at ? new Date(payout.paid_at).toLocaleDateString() : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Partner Resources */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Partner Resources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <Button variant="outline" className="h-auto p-4 justify-start" asChild>
              <a href="/business">
                <div className="text-left">
                  <p className="font-medium">Partner Agreement</p>
                  <p className="text-xs text-muted-foreground">View partnership terms</p>
                </div>
              </a>
            </Button>
            <Button variant="outline" className="h-auto p-4 justify-start" asChild>
              <a href="/contact">
                <div className="text-left">
                  <p className="font-medium">Contact Support</p>
                  <p className="text-xs text-muted-foreground">Get help from our team</p>
                </div>
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BusinessPayouts;
