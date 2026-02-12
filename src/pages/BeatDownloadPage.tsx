import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import StarField from "@/components/StarField";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, CheckCircle, Music, AlertCircle, Loader2 } from "lucide-react";

const BeatDownloadPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "expired">("loading");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [beatTitle, setBeatTitle] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("No download token provided");
      return;
    }

    const verify = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("beat-download", {
          body: { token },
        });

        if (error) throw error;

        if (data?.download_url) {
          setDownloadUrl(data.download_url);
          setBeatTitle(data.title || "Beat");
          setStatus("ready");
        } else if (data?.expired) {
          setStatus("expired");
        } else {
          setStatus("error");
          setError(data?.error || "Invalid download link");
        }
      } catch (err: any) {
        setStatus("error");
        setError(err.message);
      }
    };

    verify();
  }, [token]);

  return (
    <div className="relative min-h-screen bg-background">
      <StarField />
      <Navigation />

      <div className="relative z-10 pt-32 pb-20">
        <div className="container mx-auto px-4 max-w-lg">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-8 text-center">
              {status === "loading" && (
                <>
                  <Loader2 className="w-16 h-16 text-primary mx-auto mb-4 animate-spin" />
                  <h2 className="text-2xl font-bold text-foreground mb-2">Verifying Download...</h2>
                  <p className="text-muted-foreground">Please wait while we verify your purchase.</p>
                </>
              )}

              {status === "ready" && downloadUrl && (
                <>
                  <CheckCircle className="w-16 h-16 text-accent mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-foreground mb-2">Download Ready!</h2>
                  <p className="text-muted-foreground mb-6">
                    Your beat <span className="text-foreground font-semibold">"{beatTitle}"</span> is ready for download.
                  </p>
                  <a href={downloadUrl} download>
                    <Button size="lg" className="gap-2 mb-4">
                      <Download className="w-5 h-5" /> Download Beat
                    </Button>
                  </a>
                  <p className="text-xs text-muted-foreground">Download link expires in 24 hours.</p>
                </>
              )}

              {status === "expired" && (
                <>
                  <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-foreground mb-2">Download Expired</h2>
                  <p className="text-muted-foreground mb-6">
                    This download link has expired. Please contact support for a new link.
                  </p>
                </>
              )}

              {status === "error" && (
                <>
                  <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-foreground mb-2">Download Error</h2>
                  <p className="text-muted-foreground mb-6">{error}</p>
                </>
              )}

              <Link to="/media/track-shop">
                <Button variant="outline" className="gap-2 mt-4">
                  <Music className="w-4 h-4" /> Back to Track Shop
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default BeatDownloadPage;
