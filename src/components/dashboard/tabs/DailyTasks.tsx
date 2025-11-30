const DailyTasks = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Daily Tasks</h2>
        <p className="text-muted-foreground">
          Manage daily operations and maintenance tasks
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Tasks Today</h3>
          <p className="text-3xl font-bold text-foreground">24</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Completed</h3>
          <p className="text-3xl font-bold text-primary">18</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Overdue</h3>
          <p className="text-3xl font-bold text-destructive">2</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Task List</h3>
        <div className="space-y-3">
          {[
            { task: "Refill machine #2847 - Downtown", status: "Pending", priority: "High" },
            { task: "Routine maintenance - Machine #1234", status: "Pending", priority: "Medium" },
            { task: "Update pricing on Machine #5678", status: "Completed", priority: "Low" },
            { task: "Clean display screens - Location A", status: "Pending", priority: "Medium" },
          ].map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between border-b border-border pb-3"
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={item.status === "Completed"}
                  className="w-4 h-4"
                  readOnly
                />
                <div>
                  <p className={`font-medium ${item.status === "Completed" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {item.task}
                  </p>
                  <p className="text-sm text-muted-foreground">{item.status}</p>
                </div>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  item.priority === "High"
                    ? "bg-destructive/10 text-destructive"
                    : item.priority === "Medium"
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {item.priority}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DailyTasks;