const EventsRentals = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Events & Rentals</h2>
        <p className="text-muted-foreground">
          Manage event bookings and rental machine deployments
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Active Events</h3>
          <p className="text-3xl font-bold text-foreground">24</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Machines on Rent</h3>
          <p className="text-3xl font-bold text-foreground">156</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Upcoming Events</h3>
        <div className="space-y-4">
          {["Tech Conference 2025", "Music Festival", "Corporate Trade Show"].map((event, idx) => (
            <div key={event} className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <p className="font-medium text-foreground">{event}</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(Date.now() + idx * 86400000).toLocaleDateString()}
                </p>
              </div>
              <span className="text-sm bg-primary/10 text-primary px-3 py-1 rounded-full">
                {Math.floor(Math.random() * 20 + 5)} machines
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EventsRentals;