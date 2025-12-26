import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, CheckCircle, Circle, Trash2, Edit, Calendar, 
  Clock, AlertTriangle, RefreshCw, Filter, Search,
  ChevronRight, Flag
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DailyTask {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  due_date: string;
  created_at: string;
  completed_at: string | null;
  assigned_to: string | null;
}

const DailyTasks = () => {
  const [showDialog, setShowDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<DailyTask | null>(null);
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTask, setSelectedTask] = useState<DailyTask | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium",
    due_date: new Date().toISOString().split("T")[0],
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tasks, isLoading, refetch } = useQuery({
    queryKey: ["daily-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_tasks")
        .select("*")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data as DailyTask[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from("daily_tasks").insert([{
        ...data,
        status: "pending",
        created_by: user.user?.id,
        assigned_to: user.user?.id,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
      toast({ title: "Task created" });
      setShowDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> & { status?: string } }) => {
      const updateData: any = { ...data };
      if (data.status === "completed") {
        updateData.completed_at = new Date().toISOString();
      } else if (data.status === "pending") {
        updateData.completed_at = null;
      }
      const { error } = await supabase.from("daily_tasks").update(updateData).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
      toast({ title: "Task updated" });
      setShowDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("daily_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
      toast({ title: "Task deleted" });
      setSelectedTask(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      priority: "medium",
      due_date: new Date().toISOString().split("T")[0],
    });
    setEditingTask(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTask) {
      updateMutation.mutate({ id: editingTask.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (task: DailyTask) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      due_date: task.due_date,
    });
    setShowDialog(true);
  };

  const toggleComplete = (task: DailyTask) => {
    const newStatus = task.status === "completed" ? "pending" : "completed";
    updateMutation.mutate({ id: task.id, data: { status: newStatus } });
  };

  // Filter and group tasks
  const filteredTasks = useMemo(() => {
    return (tasks || []).filter(task => {
      const matchesPriority = filterPriority === "all" || task.priority === filterPriority;
      const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.description?.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesPriority && matchesSearch;
    });
  }, [tasks, filterPriority, searchTerm]);

  const todayTasks = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return filteredTasks.filter(t => t.due_date === today && t.status === "pending");
  }, [filteredTasks]);

  const overdueTasks = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return filteredTasks.filter(t => t.due_date < today && t.status === "pending");
  }, [filteredTasks]);

  const upcomingTasks = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return filteredTasks.filter(t => t.due_date > today && t.status === "pending");
  }, [filteredTasks]);

  const completedTasks = useMemo(() => {
    return filteredTasks.filter(t => t.status === "completed");
  }, [filteredTasks]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "text-red-500 bg-red-500/10";
      case "medium": return "text-yellow-500 bg-yellow-500/10";
      default: return "text-muted-foreground bg-muted";
    }
  };

  const getPriorityIcon = (priority: string) => {
    return <Flag className={cn("w-3 h-3", priority === "high" ? "text-red-500" : priority === "medium" ? "text-yellow-500" : "text-muted-foreground")} />;
  };

  const TaskCard = ({ task, showDate = true }: { task: DailyTask; showDate?: boolean }) => (
    <div 
      className={cn(
        "flex items-start gap-3 p-4 rounded-lg border border-border bg-card transition-all active:scale-[0.98]",
        task.status === "completed" && "opacity-60"
      )}
    >
      <button
        onClick={() => toggleComplete(task)}
        className="mt-0.5 flex-shrink-0"
      >
        {task.status === "completed" ? (
          <CheckCircle className="w-6 h-6 text-green-500" />
        ) : (
          <Circle className="w-6 h-6 text-muted-foreground hover:text-primary transition-colors" />
        )}
      </button>
      <div className="flex-1 min-w-0" onClick={() => setSelectedTask(task)}>
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className={cn("font-medium", task.status === "completed" && "line-through text-muted-foreground")}>
            {task.title}
          </h3>
          <Badge variant="outline" className={cn("text-xs", getPriorityColor(task.priority))}>
            {getPriorityIcon(task.priority)}
            <span className="ml-1">{task.priority}</span>
          </Badge>
        </div>
        {task.description && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
        )}
        {showDate && (
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span>{new Date(task.due_date).toLocaleDateString()}</span>
          </div>
        )}
      </div>
      <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl lg:text-3xl font-bold text-foreground">Daily Tasks</h2>
            <p className="text-sm text-muted-foreground">Manage your daily operations</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button onClick={() => { resetForm(); setShowDialog(true); }} size="sm" className="lg:size-default">
              <Plus className="w-4 h-4 lg:mr-2" />
              <span className="hidden lg:inline">Add Task</span>
            </Button>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-[120px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Today</p>
                <p className="text-2xl font-bold">{todayTasks.length}</p>
              </div>
              <Calendar className="w-8 h-8 text-primary/20" />
            </div>
          </CardContent>
        </Card>
        <Card className={cn("bg-card", overdueTasks.length > 0 && "border-red-500/50")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Overdue</p>
                <p className={cn("text-2xl font-bold", overdueTasks.length > 0 && "text-red-500")}>{overdueTasks.length}</p>
              </div>
              <AlertTriangle className={cn("w-8 h-8", overdueTasks.length > 0 ? "text-red-500/50" : "text-muted/20")} />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Upcoming</p>
                <p className="text-2xl font-bold text-yellow-500">{upcomingTasks.length}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Done</p>
                <p className="text-2xl font-bold text-green-500">{completedTasks.length}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overdue Tasks */}
      {overdueTasks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-red-500 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Overdue ({overdueTasks.length})
          </h3>
          <div className="space-y-2">
            {overdueTasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </div>
      )}

      {/* Today's Tasks */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Today ({todayTasks.length})
        </h3>
        {todayTasks.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <CheckCircle className="w-12 h-12 mx-auto text-green-500/50 mb-2" />
              <p className="text-muted-foreground">No tasks for today!</p>
              <Button variant="link" onClick={() => { resetForm(); setShowDialog(true); }}>
                Add a task
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {todayTasks.map((task) => (
              <TaskCard key={task.id} task={task} showDate={false} />
            ))}
          </div>
        )}
      </div>

      {/* Upcoming Tasks */}
      {upcomingTasks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-yellow-500 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Upcoming ({upcomingTasks.length})
          </h3>
          <div className="space-y-2">
            {upcomingTasks.slice(0, 5).map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
            {upcomingTasks.length > 5 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                +{upcomingTasks.length - 5} more upcoming tasks
              </p>
            )}
          </div>
        </div>
      )}

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-green-500 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Completed ({completedTasks.length})
          </h3>
          <div className="space-y-2">
            {completedTasks.slice(0, 3).map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
            {completedTasks.length > 3 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                +{completedTasks.length - 3} more completed
              </p>
            )}
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTask ? "Edit Task" : "New Task"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="What needs to be done?"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Add details..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  required
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button type="submit">{editingTask ? "Update" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Task Details Dialog */}
      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          {selectedTask && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <DialogTitle className={cn(selectedTask.status === "completed" && "line-through text-muted-foreground")}>
                    {selectedTask.title}
                  </DialogTitle>
                  <Badge variant="outline" className={cn("text-xs", getPriorityColor(selectedTask.priority))}>
                    {selectedTask.priority}
                  </Badge>
                </div>
              </DialogHeader>
              <div className="space-y-4">
                {selectedTask.description && (
                  <p className="text-muted-foreground">{selectedTask.description}</p>
                )}
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>Due: {new Date(selectedTask.due_date).toLocaleDateString()}</span>
                  </div>
                  {selectedTask.completed_at && (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>Completed: {new Date(selectedTask.completed_at).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter className="flex-col gap-2 sm:flex-row">
                <Button variant="outline" className="w-full sm:w-auto" onClick={() => { setSelectedTask(null); handleEdit(selectedTask); }}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant={selectedTask.status === "completed" ? "secondary" : "default"}
                  className="w-full sm:w-auto"
                  onClick={() => { toggleComplete(selectedTask); setSelectedTask(null); }}
                >
                  {selectedTask.status === "completed" ? (
                    <>
                      <Circle className="w-4 h-4 mr-2" />
                      Mark Pending
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Complete
                    </>
                  )}
                </Button>
                <Button variant="destructive" className="w-full sm:w-auto" onClick={() => deleteMutation.mutate(selectedTask.id)}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DailyTasks;
