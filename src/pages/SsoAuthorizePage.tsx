import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, ExternalLink, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSEO } from "@/hooks/useSEO";

const SCOPE_LABELS: Record<string, string> = {
  profile: "Your name, avatar, job title, department",
  email: "Your email address",
  "wallet:read": "Your VendX Pay wallet balance",
  "rewards:read": "Your reward points and tier",
  "tickets:read": "Your arcade ticket balance",
  "roles:read": "Your VendX roles",
  "divisions:read": "Your assigned divisions",
};

interface AppInfo {
  client_id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  homepage_url: string | null;
  allowed_scopes: string[];
  redirect_uris: string[];
  is_active: boolean;
  is_first_party: boolean;
}

const SsoAuthorizePage = () => {
  useSEO({ title: "Authorize App — VendX SSO", description: "Securely sign in to a VendX-connected service." });
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [app, setApp] = useState<AppInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clientId = params.get("client_id") ?? "";
  const redirectUri = params.get("redirect_uri") ?? "";
  const state = params.get("state") ?? "";
  const scopeParam = params.get("scope") ?? "profile email";
  const requestedScopes = scopeParam.split(/\s+/).filter(Boolean);
  const codeChallenge = params.get("code_challenge") ?? "";
  const codeChallengeMethod = params.get("code_challenge_method") ?? (codeChallenge ? "S256" : "");

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const next = encodeURIComponent(`/sso/authorize?${params.toString()}`);
        navigate(`/auth?redirect=${next}`);
        return;
      }
      if (!clientId || !redirectUri) {
        setError("Missing required parameters: client_id and redirect_uri.");
        setLoading(false);
        return;
      }
      const { data, error: e } = await supabase
        .from("vendx_sso_apps")
        .select("client_id, name, description, logo_url, homepage_url, allowed_scopes, redirect_uris, is_active, is_first_party")
        .eq("client_id", clientId)
        .maybeSingle();
      if (e || !data) {
        setError("Unknown application.");
      } else if (!data.is_active) {
        setError("This application has been disabled.");
      } else {
        const norm = (u: string) => u.trim().replace(/\/+$/, "");
        const allowed = (data.redirect_uris as string[]).map(norm);
        if (!allowed.includes(norm(redirectUri))) {
          setError(`This redirect URI is not whitelisted for this application.\n\nYou sent: ${redirectUri}\n\nAllowed: ${data.redirect_uris.join(", ")}`);
        } else {
          setApp(data as AppInfo);
        }
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, redirectUri]);

  const grantedScopes = app
    ? requestedScopes.filter((s) => app.allowed_scopes.includes(s))
    : [];

  const finish = (url: string) => {
    window.location.href = url;
  };

  const handleAllow = async () => {
    if (!app) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("sso-authorize", {
        body: {
          client_id: clientId,
          redirect_uri: redirectUri,
          scopes: grantedScopes,
          state,
          code_challenge: codeChallenge || undefined,
          code_challenge_method: codeChallengeMethod || undefined,
        },
      });
      if (error || !data?.code) throw new Error(error?.message || "Failed to issue code");
      const u = new URL(redirectUri);
      u.searchParams.set("code", data.code);
      if (state) u.searchParams.set("state", state);
      finish(u.toString());
    } catch (e: any) {
      toast({ title: "Authorization failed", description: e.message, variant: "destructive" });
      setSubmitting(false);
    }
  };

  const handleDeny = () => {
    try {
      const u = new URL(redirectUri);
      u.searchParams.set("error", "access_denied");
      if (state) u.searchParams.set("state", state);
      finish(u.toString());
    } catch {
      navigate("/dashboard");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Cannot continue</CardTitle>
            <CardDescription className="whitespace-pre-line text-left">{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate("/dashboard")}>Back to dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full border-primary/30">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 overflow-hidden">
            {app.logo_url ? (
              <img src={app.logo_url} alt={app.name} className="w-full h-full object-cover" />
            ) : (
              <ShieldCheck className="w-8 h-8 text-primary" />
            )}
          </div>
          <CardTitle className="text-2xl">
            Sign in to <span className="text-primary">{app.name}</span>
          </CardTitle>
          <CardDescription>
            with your VendX Global Corporation account
            {app.homepage_url && (
              <a href={app.homepage_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 ml-2 text-primary hover:underline">
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {app.description && (
            <p className="text-sm text-muted-foreground text-center">{app.description}</p>
          )}
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              {app.name} will be able to access:
            </p>
            <ul className="space-y-2">
              {grantedScopes.map((s) => (
                <li key={s} className="flex items-start gap-2 text-sm">
                  <ShieldCheck className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>{SCOPE_LABELS[s] ?? s}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={handleDeny} disabled={submitting} className="flex-1">
              Deny
            </Button>
            <Button onClick={handleAllow} disabled={submitting} className="flex-1">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Allow"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            You can revoke access anytime from <span className="text-primary">Dashboard → Linked Accounts</span>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SsoAuthorizePage;
