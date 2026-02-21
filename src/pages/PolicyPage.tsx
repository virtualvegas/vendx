import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { ArrowLeft } from "lucide-react";

const PolicyPage = () => {
  const { slug } = useParams<{ slug: string }>();

  const { data: policy, isLoading } = useQuery({
    queryKey: ["policy", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_policies")
        .select("*")
        .eq("slug", slug)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  // Simple markdown-to-HTML (handles #, ##, ###, **, -, blank lines)
  const renderContent = (content: string) => {
    return content.split("\n").map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return <br key={i} />;
      if (trimmed.startsWith("### "))
        return <h3 key={i} className="text-lg font-semibold mt-6 mb-2 text-foreground">{trimmed.slice(4)}</h3>;
      if (trimmed.startsWith("## "))
        return <h2 key={i} className="text-xl font-bold mt-8 mb-3 text-foreground">{trimmed.slice(3)}</h2>;
      if (trimmed.startsWith("# "))
        return <h1 key={i} className="text-2xl font-bold mt-6 mb-4 text-foreground">{trimmed.slice(2)}</h1>;
      if (trimmed.startsWith("- ")) {
        const text = trimmed.slice(2).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
        return <li key={i} className="ml-6 text-muted-foreground list-disc" dangerouslySetInnerHTML={{ __html: text }} />;
      }
      const text = trimmed.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      return <p key={i} className="text-muted-foreground mb-2" dangerouslySetInnerHTML={{ __html: text }} />;
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-24 max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-2 text-primary hover:underline mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>

        {isLoading ? (
          <div className="text-muted-foreground">Loading...</div>
        ) : policy ? (
          <article>
            <h1 className="text-3xl font-bold text-foreground mb-2">{policy.title}</h1>
            <p className="text-sm text-muted-foreground mb-8">
              Last updated: {new Date(policy.updated_at).toLocaleDateString()}
            </p>
            <div className="prose prose-invert max-w-none">
              {renderContent(policy.content)}
            </div>
          </article>
        ) : (
          <p className="text-muted-foreground">Policy not found.</p>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default PolicyPage;
