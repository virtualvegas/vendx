import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

interface Task {
  id: string;
  task: string;
  status: "Pending" | "Completed";
  priority: "High" | "Medium" | "Low";
  machine?: string;
}

const DailyTasks = () => {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([
    { id: "1", task: "Refill machine #2847 - Downtown", status: "Pending", priority: "High", machine: "#2847" },
    { id: "2", task: "Routine maintenance - Machine #1234", status: "Pending", priority: "Medium", machine: "#1234" },
    { id: "3", task: "Update pricing on Machine #5678", status: "Completed", priority: "Low", machine: "#5678" },
    { id: "4", task: "Clean display screens - Location A", status: "Pending", priority: "Medium" },
    { id: "5", task: "Check temperature sensors - Fresh units", status: "Pending", priority: "High" },
    { id: "6", task: "Software update - Digital machines", status: "Pending", priority: "Medium" },
  ]);

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(task => 
      task.id === id 
        ? { ...task, status: task.status === "Completed" ? "Pending" : "Completed" }
        : task
    ));
    
    toast({
      title: "Task Updated",
      description: "Task status has been changed",
    });
  };

  const completedCount = tasks.filter(t => t.status === "Completed").length;
  const overdueCount = tasks.filter(t => t.status === "Pending" && t.priority === "High").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Daily Tasks</h2>
        <p className="text-muted-foreground">
          Manage daily operations and maintenance tasks
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Tasks Today</h3>
          <p className="text-3xl font-bold text-foreground">{tasks.length}</p>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Completed</h3>
          <p className="text-3xl font-bold text-primary">{completedCount}</p>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">High Priority</h3>
          <p className="text-3xl font-bold text-destructive">{overdueCount}</p>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Task List</h3>
        <div className="space-y-3">
          {tasks.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between border-b border-border pb-3"
            >
              <div className="flex items-center gap-3 flex-1">
                <Checkbox
                  checked={item.status === "Completed"}
                  onCheckedChange={() => toggleTask(item.id)}
                />
                <div className="flex-1">
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
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Scheduled for Tomorrow</h3>
          <div className="space-y-3">
            {[
              { task: "Quarterly inspection - VendX Max units", priority: "Medium" },
              { task: "Inventory audit - Warehouse A", priority: "High" },
              { task: "Network maintenance - All locations", priority: "Low" },
            ].map((future, idx) => (
              <div key={idx} className="text-sm">
                <p className="font-medium text-foreground">{future.task}</p>
                <span className={`text-xs ${
                  future.priority === "High" ? "text-destructive" : "text-muted-foreground"
                }`}>
                  {future.priority} priority
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Quick Stats</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Completion Rate Today</span>
              <span className="text-foreground font-medium">
                {Math.round((completedCount / tasks.length) * 100)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Average Task Duration</span>
              <span className="text-foreground font-medium">1.2 hours</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Tasks This Week</span>
              <span className="text-foreground font-medium">42</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default DailyTasks;
