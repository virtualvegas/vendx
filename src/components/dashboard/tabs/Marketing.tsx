const Marketing = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Marketing & Sales</h2>
        <p className="text-muted-foreground">
          Track campaigns, leads, and sales performance
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Active Campaigns</h3>
          <p className="text-3xl font-bold text-foreground">8</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">New Leads</h3>
          <p className="text-3xl font-bold text-foreground">127</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Conversion Rate</h3>
          <p className="text-3xl font-bold text-foreground">24.3%</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Campaign Performance</h3>
        <div className="space-y-4">
          {[
            { name: "Mars Division Launch", impressions: 124000, conversions: 3200 },
            { name: "VendX Max Promo", impressions: 98000, conversions: 2100 },
            { name: "Digital Signage Campaign", impressions: 76000, conversions: 1500 },
          ].map((campaign) => (
            <div key={campaign.name} className="border-b border-border pb-3">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-foreground">{campaign.name}</p>
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
      </div>
    </div>
  );
};

export default Marketing;