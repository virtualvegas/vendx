import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

const Marketing = () => {
  const { data: divisions } = useQuery({
    queryKey: ["marketing-divisions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("divisions")
        .select("*")
        .eq("status", "active");
      
      if (error) throw error;
      return data;
    },
  });

  const campaigns = [
    { name: "Mars Division Launch", impressions: 124000, conversions: 3200, status: "active" },
    { name: "VendX Max Promo", impressions: 98000, conversions: 2100, status: "active" },
    { name: "Digital Signage Campaign", impressions: 76000, conversions: 1500, status: "completed" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Marketing & Sales</h2>
        <p className="text-muted-foreground">
          Track campaigns, leads, and sales performance
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Active Campaigns</h3>
          <p className="text-3xl font-bold text-foreground">
            {campaigns.filter(c => c.status === "active").length}
          </p>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">New Leads</h3>
          <p className="text-3xl font-bold text-foreground">127</p>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Conversion Rate</h3>
          <p className="text-3xl font-bold text-foreground">24.3%</p>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Campaign Performance</h3>
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <div key={campaign.name} className="border-b border-border pb-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <p className="font-medium text-foreground">{campaign.name}</p>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    campaign.status === "active" 
                      ? "bg-primary/10 text-primary" 
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {campaign.status}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {((campaign.conversions / campaign.impressions) * 100).toFixed(1)}% CVR
                </span>
              </div>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>{(campaign.impressions / 1000).toFixed(0)}K impressions</span>
                <span>{campaign.conversions} conversions</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Lead Sources</h3>
          <div className="space-y-3">
            {[
              { source: "Website", leads: 54, percentage: 42 },
              { source: "Social Media", leads: 38, percentage: 30 },
              { source: "Referrals", leads: 23, percentage: 18 },
              { source: "Events", leads: 12, percentage: 10 },
            ].map((source) => (
              <div key={source.source} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{source.source}</span>
                  <span className="text-muted-foreground">
                    {source.leads} leads ({source.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full"
                    style={{ width: `${source.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Division Interest</h3>
          <div className="space-y-3">
            {divisions?.slice(0, 5).map((division, idx) => (
              <div key={division.id} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{division.name}</span>
                <span className="text-muted-foreground">
                  {Math.floor(Math.random() * 40) + 10}%
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Marketing;
