import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, MapPin, Briefcase, Clock } from "lucide-react";

const JobDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showApplication, setShowApplication] = useState(false);
  const [formData, setFormData] = useState({
    applicant_name: "",
    email: "",
    phone: "",
    cover_letter: "",
  });

  const { data: job, isLoading } = useQuery({
    queryKey: ["job", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", id)
        .eq("status", "active")
        .single();
      if (error) throw error;
      return data;
    },
  });

  const applicationMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("job_applications").insert({
        ...data,
        job_id: id,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Application Submitted!",
        description: "We'll review your application and get back to you soon.",
      });
      setFormData({ applicant_name: "", email: "", phone: "", cover_letter: "" });
      setShowApplication(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applicationMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="pt-32 pb-24">
          <div className="container mx-auto px-4">
            <p className="text-center">Loading job details...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="pt-32 pb-24">
          <div className="container mx-auto px-4">
            <p className="text-center">Job not found or no longer available.</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="pt-32 pb-24">
        <div className="container mx-auto px-4">
          <Button
            variant="ghost"
            onClick={() => navigate("/careers")}
            className="mb-8"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Careers
          </Button>

          <div className="max-w-4xl mx-auto space-y-8">
            <div className="space-y-4">
              <h1 className="text-5xl lg:text-6xl font-bold">{job.title}</h1>
              
              <div className="flex flex-wrap gap-4 text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5" />
                  {job.department}
                </span>
                <span className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  {job.location}
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  {job.type}
                </span>
              </div>
            </div>

            <Card className="p-8 lg:p-12 space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-4">Job Description</h2>
                <p className="text-muted-foreground whitespace-pre-wrap">{job.description}</p>
              </div>

              {job.requirements && (
                <div>
                  <h2 className="text-2xl font-bold mb-4">Requirements</h2>
                  <p className="text-muted-foreground whitespace-pre-wrap">{job.requirements}</p>
                </div>
              )}

              {!showApplication ? (
                <Button
                  size="lg"
                  onClick={() => setShowApplication(true)}
                  className="w-full bg-accent hover:bg-accent/90 text-accent-foreground border border-accent shadow-[0_0_15px_rgba(57,255,136,0.3)] hover:shadow-[0_0_25px_rgba(57,255,136,0.5)] transition-smooth"
                >
                  Apply for this Position
                </Button>
              ) : (
                <div className="space-y-6 border-t pt-6">
                  <h2 className="text-2xl font-bold">Submit Your Application</h2>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                      required
                      placeholder="Full Name"
                      value={formData.applicant_name}
                      onChange={(e) =>
                        setFormData({ ...formData, applicant_name: e.target.value })
                      }
                    />
                    <Input
                      required
                      type="email"
                      placeholder="Email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                    <Input
                      placeholder="Phone (optional)"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                    <Textarea
                      required
                      placeholder="Cover Letter / Why you're interested in this role..."
                      rows={6}
                      value={formData.cover_letter}
                      onChange={(e) =>
                        setFormData({ ...formData, cover_letter: e.target.value })
                      }
                    />
                    <div className="flex gap-2">
                      <Button type="submit" disabled={applicationMutation.isPending}>
                        Submit Application
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowApplication(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </div>
              )}
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default JobDetailPage;
