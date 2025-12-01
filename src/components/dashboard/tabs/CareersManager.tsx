import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, Briefcase, Users, FileText, Trash2, Edit, Eye } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CareersManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isJobDialogOpen, setIsJobDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<any>(null);
  const [jobFormData, setJobFormData] = useState({
    title: "",
    department: "",
    location: "",
    type: "full-time",
    description: "",
    requirements: "",
    status: "active",
  });

  // Fetch jobs
  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .order("posted_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch applications
  const { data: applications, isLoading: applicationsLoading } = useQuery({
    queryKey: ["job_applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_applications")
        .select("*, jobs(title)")
        .order("applied_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Create/Update job mutation
  const jobMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingJob) {
        const { error } = await supabase
          .from("jobs")
          .update(data)
          .eq("id", editingJob.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("jobs").insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast({ title: editingJob ? "Job updated" : "Job created" });
      setIsJobDialogOpen(false);
      resetJobForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Delete job mutation
  const deleteJobMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("jobs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast({ title: "Job deleted" });
    },
  });

  // Update application mutation
  const updateApplicationMutation = useMutation({
    mutationFn: async ({ id, status, notes }: any) => {
      const { error } = await supabase
        .from("job_applications")
        .update({ status, notes })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job_applications"] });
      toast({ title: "Application updated" });
    },
  });

  const resetJobForm = () => {
    setJobFormData({
      title: "",
      department: "",
      location: "",
      type: "full-time",
      description: "",
      requirements: "",
      status: "active",
    });
    setEditingJob(null);
  };

  const handleEditJob = (job: any) => {
    setEditingJob(job);
    setJobFormData(job);
    setIsJobDialogOpen(true);
  };

  const handleJobSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    jobMutation.mutate(jobFormData);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Careers Manager</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <Briefcase className="w-10 h-10 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Active Jobs</p>
              <p className="text-3xl font-bold">
                {jobs?.filter((j) => j.status === "active").length || 0}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <Users className="w-10 h-10 text-accent" />
            <div>
              <p className="text-sm text-muted-foreground">Total Applications</p>
              <p className="text-3xl font-bold">{applications?.length || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <FileText className="w-10 h-10 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Pending Review</p>
              <p className="text-3xl font-bold">
                {applications?.filter((a) => a.status === "pending").length || 0}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="jobs" className="w-full">
        <TabsList>
          <TabsTrigger value="jobs">Job Listings</TabsTrigger>
          <TabsTrigger value="applications">Applications</TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={isJobDialogOpen} onOpenChange={setIsJobDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetJobForm}>
                  <Plus className="mr-2 h-4 w-4" /> Add Job
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingJob ? "Edit Job" : "Create New Job"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleJobSubmit} className="space-y-4">
                  <Input
                    required
                    placeholder="Job Title"
                    value={jobFormData.title}
                    onChange={(e) => setJobFormData({ ...jobFormData, title: e.target.value })}
                  />
                  <Input
                    required
                    placeholder="Department"
                    value={jobFormData.department}
                    onChange={(e) => setJobFormData({ ...jobFormData, department: e.target.value })}
                  />
                  <Input
                    required
                    placeholder="Location"
                    value={jobFormData.location}
                    onChange={(e) => setJobFormData({ ...jobFormData, location: e.target.value })}
                  />
                  <Select
                    value={jobFormData.type}
                    onValueChange={(value) => setJobFormData({ ...jobFormData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full-time">Full-time</SelectItem>
                      <SelectItem value="part-time">Part-time</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                    </SelectContent>
                  </Select>
                  <Textarea
                    required
                    placeholder="Job Description"
                    rows={5}
                    value={jobFormData.description}
                    onChange={(e) => setJobFormData({ ...jobFormData, description: e.target.value })}
                  />
                  <Textarea
                    placeholder="Requirements"
                    rows={3}
                    value={jobFormData.requirements || ""}
                    onChange={(e) => setJobFormData({ ...jobFormData, requirements: e.target.value })}
                  />
                  <Select
                    value={jobFormData.status}
                    onValueChange={(value) => setJobFormData({ ...jobFormData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={jobMutation.isPending}>
                      {editingJob ? "Update" : "Create"} Job
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setIsJobDialogOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-4">
            {jobsLoading ? (
              <p>Loading jobs...</p>
            ) : (
              jobs?.map((job) => (
                <Card key={job.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <h3 className="text-xl font-bold">{job.title}</h3>
                      <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                        <span>{job.department}</span>
                        <span>•</span>
                        <span>{job.location}</span>
                        <span>•</span>
                        <span>{job.type}</span>
                        <span>•</span>
                        <span className={job.status === "active" ? "text-accent" : "text-red-500"}>
                          {job.status}
                        </span>
                      </div>
                      <p className="text-sm line-clamp-2">{job.description}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEditJob(job)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (confirm("Delete this job?")) {
                            deleteJobMutation.mutate(job.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="applications" className="space-y-4">
          {applicationsLoading ? (
            <p>Loading applications...</p>
          ) : (
            applications?.map((app: any) => (
              <Card key={app.id} className="p-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-bold">{app.applicant_name}</h3>
                      <p className="text-sm text-muted-foreground">{app.email}</p>
                      <p className="text-sm text-muted-foreground">
                        Applied for: {app.jobs?.title}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        app.status === "pending"
                          ? "bg-yellow-500/20 text-yellow-500"
                          : app.status === "accepted"
                          ? "bg-green-500/20 text-green-500"
                          : "bg-red-500/20 text-red-500"
                      }`}
                    >
                      {app.status}
                    </span>
                  </div>
                  {app.cover_letter && (
                    <div>
                      <p className="text-sm font-semibold mb-1">Cover Letter:</p>
                      <p className="text-sm text-muted-foreground line-clamp-3">{app.cover_letter}</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Select
                      defaultValue={app.status}
                      onValueChange={(value) =>
                        updateApplicationMutation.mutate({ id: app.id, status: value, notes: app.notes })
                      }
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="reviewing">Reviewing</SelectItem>
                        <SelectItem value="interview">Interview</SelectItem>
                        <SelectItem value="accepted">Accepted</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CareersManager;
