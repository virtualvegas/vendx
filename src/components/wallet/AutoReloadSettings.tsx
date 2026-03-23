import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CreditCard, Loader2, Zap, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AutoReloadSettingsProps {
  walletId: string;
  currentBalance: number;
}

interface AutoReloadConfig {
  id?: string;
  is_enabled: boolean;
  reload_type: "threshold" | "scheduled";
  reload_amount: number;
  threshold_amount: number;
  schedule_interval: "daily" | "weekly" | "biweekly" | "monthly";
  preferred_payment_method: "stripe" | "paypal";
  last_reload_at: string | null;
  next_scheduled_reload: string | null;
}

const DEFAULT_CONFIG: AutoReloadConfig = {
  is_enabled: false,
  reload_type: "threshold",
  reload_amount: 25,
  threshold_amount: 5,
  schedule_interval: "weekly",
  preferred_payment_method: "stripe",
  last_reload_at: null,
  next_scheduled_reload: null,
};

const PRESET_RELOAD_AMOUNTS = [10, 25, 50, 100];

const AutoReloadSettings = ({ walletId, currentBalance }: AutoReloadSettingsProps) => {
  const [config, setConfig] = useState<AutoReloadConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchConfig();
  }, [walletId]);

  const fetchConfig = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("wallet_auto_reload")
        .select("*")
        .eq("wallet_id", walletId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig({
          id: data.id,
          is_enabled: data.is_enabled,
          reload_type: data.reload_type as "threshold" | "scheduled",
          reload_amount: Number(data.reload_amount),
          threshold_amount: Number(data.threshold_amount ?? 5),
          schedule_interval: (data.schedule_interval ?? "weekly") as AutoReloadConfig["schedule_interval"],
          preferred_payment_method: data.preferred_payment_method as "stripe" | "paypal",
          last_reload_at: data.last_reload_at,
          next_scheduled_reload: data.next_scheduled_reload,
        });
        setHasExisting(true);
      }
    } catch (err) {
      console.error("Error fetching auto-reload config:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const payload = {
        user_id: user.id,
        wallet_id: walletId,
        is_enabled: config.is_enabled,
        reload_type: config.reload_type,
        reload_amount: config.reload_amount,
        threshold_amount: config.reload_type === "threshold" ? config.threshold_amount : null,
        schedule_interval: config.reload_type === "scheduled" ? config.schedule_interval : null,
        preferred_payment_method: config.preferred_payment_method,
        updated_at: new Date().toISOString(),
      };

      if (hasExisting && config.id) {
        const { error } = await supabase
          .from("wallet_auto_reload")
          .update(payload)
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("wallet_auto_reload")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        setConfig(prev => ({ ...prev, id: data.id }));
        setHasExisting(true);
      }

      toast({
        title: config.is_enabled ? "Auto-Reload Enabled" : "Settings Saved",
        description: config.is_enabled
          ? `Your wallet will auto-reload $${config.reload_amount.toFixed(2)} ${
              config.reload_type === "threshold"
                ? `when balance drops below $${config.threshold_amount.toFixed(2)}`
                : config.schedule_interval
            }.`
          : "Auto-reload has been disabled.",
      });
    } catch (err: any) {
      console.error("Error saving auto-reload config:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to save settings.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/10">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center">
              <RefreshCw className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Auto-Reload</CardTitle>
              <p className="text-sm text-muted-foreground">
                Never run out of funds
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {config.is_enabled && (
              <Badge variant="outline" className="border-primary/30 text-primary">
                Active
              </Badge>
            )}
            <Switch
              checked={config.is_enabled}
              onCheckedChange={(checked) => setConfig(prev => ({ ...prev, is_enabled: checked }))}
            />
          </div>
        </div>
      </CardHeader>

      {config.is_enabled && (
        <CardContent className="space-y-6">
          {/* Reload Type */}
          <Tabs
            value={config.reload_type}
            onValueChange={(v) => setConfig(prev => ({ ...prev, reload_type: v as "threshold" | "scheduled" }))}
          >
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="threshold" className="gap-2">
                <Zap className="w-4 h-4" />
                Low Balance
              </TabsTrigger>
              <TabsTrigger value="scheduled" className="gap-2">
                <Calendar className="w-4 h-4" />
                Scheduled
              </TabsTrigger>
            </TabsList>

            <TabsContent value="threshold" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Reload when balance drops below</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={config.threshold_amount}
                    onChange={(e) => setConfig(prev => ({ ...prev, threshold_amount: parseFloat(e.target.value) || 0 }))}
                    className="pl-8"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Current balance: <span className="font-medium text-foreground">${currentBalance.toFixed(2)}</span>
                  {currentBalance <= config.threshold_amount && (
                    <span className="text-destructive ml-1">(below threshold!)</span>
                  )}
                </p>
              </div>
            </TabsContent>

            <TabsContent value="scheduled" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Reload frequency</Label>
                <Select
                  value={config.schedule_interval}
                  onValueChange={(v) => setConfig(prev => ({ ...prev, schedule_interval: v as AutoReloadConfig["schedule_interval"] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Every 2 Weeks</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {config.next_scheduled_reload && (
                <p className="text-xs text-muted-foreground">
                  Next reload: {new Date(config.next_scheduled_reload).toLocaleDateString()}
                </p>
              )}
            </TabsContent>
          </Tabs>

          {/* Reload Amount */}
          <div className="space-y-3">
            <Label>Amount to reload</Label>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_RELOAD_AMOUNTS.map((amt) => (
                <Button
                  key={amt}
                  type="button"
                  variant={config.reload_amount === amt ? "default" : "outline"}
                  size="sm"
                  onClick={() => setConfig(prev => ({ ...prev, reload_amount: amt }))}
                  className="font-semibold"
                >
                  ${amt}
                </Button>
              ))}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
              <Input
                type="number"
                min={5}
                max={500}
                placeholder="Custom amount"
                value={config.reload_amount}
                onChange={(e) => setConfig(prev => ({ ...prev, reload_amount: parseFloat(e.target.value) || 0 }))}
                className="pl-8"
              />
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label>Payment method</Label>
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant={config.preferred_payment_method === "stripe" ? "default" : "outline"}
                className="h-12 gap-2"
                onClick={() => setConfig(prev => ({ ...prev, preferred_payment_method: "stripe" }))}
              >
                <CreditCard className="w-4 h-4" />
                Debit/Credit
              </Button>
              <Button
                type="button"
                variant={config.preferred_payment_method === "paypal" ? "default" : "outline"}
                className="h-12 gap-2"
                onClick={() => setConfig(prev => ({ ...prev, preferred_payment_method: "paypal" }))}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                  <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 2.23c.065-.38.399-.648.784-.648h7.51c2.48 0 4.346.654 5.547 1.942 1.136 1.217 1.558 2.814 1.282 4.727-.016.113-.033.227-.052.34-.61 3.608-2.735 5.997-6.24 6.79-.506.114-1.032.17-1.575.17H9.96c-.382 0-.707.28-.765.655l-.638 4.08-.481 3.051z" />
                </svg>
                PayPal
              </Button>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-1">
            <p className="text-sm font-medium">Summary</p>
            <p className="text-sm text-muted-foreground">
              {config.reload_type === "threshold"
                ? `Auto-reload $${config.reload_amount.toFixed(2)} via ${config.preferred_payment_method === "stripe" ? "card" : "PayPal"} when balance drops below $${config.threshold_amount.toFixed(2)}.`
                : `Auto-reload $${config.reload_amount.toFixed(2)} via ${config.preferred_payment_method === "stripe" ? "card" : "PayPal"} ${config.schedule_interval}.`}
            </p>
            {config.last_reload_at && (
              <p className="text-xs text-muted-foreground">
                Last auto-reload: {new Date(config.last_reload_at).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Save Button */}
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Auto-Reload Settings"
            )}
          </Button>
        </CardContent>
      )}

      {/* Save when disabling */}
      {!config.is_enabled && hasExisting && (
        <CardContent className="pt-0">
          <Button onClick={handleSave} disabled={saving} variant="outline" className="w-full" size="sm">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save Changes
          </Button>
        </CardContent>
      )}
    </Card>
  );
};

export default AutoReloadSettings;
