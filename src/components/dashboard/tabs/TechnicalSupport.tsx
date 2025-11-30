const TechnicalSupport = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Technical Support</h2>
        <p className="text-muted-foreground">
          Monitor machine health and manage support tickets
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Open Tickets</h3>
          <p className="text-3xl font-bold text-foreground">47</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Machines Offline</h3>
          <p className="text-3xl font-bold text-destructive">12</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Avg Response Time</h3>
          <p className="text-3xl font-bold text-foreground">2.4h</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Recent Support Tickets</h3>
        <div className="space-y-3">
          {[
            { id: "TKT-1245", issue: "Payment system error", priority: "High" },
            { id: "TKT-1244", issue: "Inventory sync issue", priority: "Medium" },
            { id: "TKT-1243", issue: "Screen malfunction", priority: "High" },
          ].map((ticket) => (
            <div key={ticket.id} className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <p className="font-medium text-foreground">{ticket.issue}</p>
                <p className="text-sm text-muted-foreground">{ticket.id}</p>
              </div>
              <span
                className={`text-sm px-3 py-1 rounded-full ${
                  ticket.priority === "High"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {ticket.priority}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TechnicalSupport;