import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Rocket, Code, Wrench, Users, TrendingUp, Heart } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

const benefits = [
  {
    icon: Rocket,
    title: "Mission Driven",
    description: "Work on technology that will serve humanity on Earth and Mars",
  },
  {
    icon: Code,
    title: "Cutting Edge Tech",
    description: "AI, robotics, IoT, and space technology at your fingertips",
  },
  {
    icon: Users,
    title: "Collaborative Culture",
    description: "Work with brilliant minds from around the world",
  },
  {
    icon: TrendingUp,
    title: "Growth & Learning",
    description: "Continuous education budget and career development",
  },
  {
    icon: Heart,
    title: "Health & Wellness",
    description: "Comprehensive benefits including health, dental, and mental wellness",
  },
  {
    icon: Wrench,
    title: "Innovation Time",
    description: "20% time for personal projects and innovation",
  },
];

const CareersPage = () => {
  const { data: jobs, isLoading } = useQuery({
    queryKey: ["active-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("status", "active")
        .order("posted_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="pt-32 pb-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-16 space-y-6">
            <h1 className="text-6xl lg:text-7xl font-bold">
              Join <span className="glow-blue">VendX</span>
            </h1>
            <p className="text-xl text-muted-foreground">
              Help us build the future of automated retail, from Earth to Mars
            </p>
          </div>

          <div className="max-w-6xl mx-auto mb-24">
            <h2 className="text-4xl font-bold mb-12 text-center">
              Why Work at <span className="glow-green">VendX</span>?
            </h2>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {benefits.map((benefit, idx) => (
                <div
                  key={idx}
                  className="bg-card/40 backdrop-blur-sm border border-border hover:border-primary/50 rounded-2xl p-8 transition-smooth hover:shadow-[0_0_30px_rgba(26,124,255,0.2)] hover:-translate-y-2"
                >
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 border border-primary/30 mb-4">
                    <benefit.icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{benefit.title}</h3>
                  <p className="text-muted-foreground text-sm">{benefit.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="max-w-5xl mx-auto">
            <h2 className="text-4xl font-bold mb-12 text-center">
              Open <span className="glow-blue">Positions</span>
            </h2>
            
            {isLoading ? (
              <p className="text-center text-muted-foreground">Loading positions...</p>
            ) : jobs && jobs.length > 0 ? (
              <div className="space-y-6">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    className="bg-card/50 backdrop-blur-sm border border-border hover:border-accent/50 rounded-2xl p-8 transition-smooth hover:shadow-[0_0_20px_rgba(57,255,136,0.2)] group"
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="space-y-2">
                        <h3 className="text-2xl font-bold group-hover:text-accent transition-smooth">
                          {job.title}
                        </h3>
                        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                            {job.department}
                          </span>
                          <span className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                            {job.location}
                          </span>
                          <span className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-foreground" />
                            {job.type}
                          </span>
                        </div>
                      </div>
                      
                      <Link to={`/careers/${job.id}`}>
                        <Button 
                          className="bg-accent hover:bg-accent/90 text-accent-foreground border border-accent shadow-[0_0_15px_rgba(57,255,136,0.3)] hover:shadow-[0_0_25px_rgba(57,255,136,0.5)] transition-smooth"
                        >
                          View & Apply
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground">No open positions at the moment. Check back soon!</p>
            )}

            <div className="mt-12 text-center bg-gradient-space border border-primary/30 rounded-2xl p-12">
              <h3 className="text-3xl font-bold mb-4">
                Don't See Your Role?
              </h3>
              <p className="text-muted-foreground mb-6">
                We're always looking for exceptional talent. Send us your resume and we'll keep you in mind for future opportunities.
              </p>
              <Button 
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground border-2 border-primary shadow-[0_0_20px_rgba(26,124,255,0.5)] hover:shadow-[0_0_30px_rgba(26,124,255,0.8)] transition-smooth"
              >
                Submit General Application
              </Button>
              <p className="text-sm text-muted-foreground mt-4">
                careers@vendx.space
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default CareersPage;
