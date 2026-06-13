import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";
import { Card } from "@/components/ui/card";
import { ShieldCheck, KeyRound, RefreshCw, UserCheck, Webhook, Code } from "lucide-react";

const Section = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <section id={id} className="scroll-mt-24 space-y-3">{children}</section>
);

const SsoDocsPage = () => {
  useSEO({
    title: "VendX SSO API — Developer Docs",
    description: "OAuth 2.0 Single Sign-On for VendX services. Authorization Code + PKCE, refresh tokens, scoped userinfo, and webhook events.",
  });

  const base = "https://xbbnodpvfvxtbffziuvr.supabase.co/functions/v1";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <main className="max-w-5xl mx-auto px-4 py-16">
        <header className="mb-10">
          <p className="text-xs uppercase tracking-widest text-primary mb-2">Developer Documentation</p>
          <h1 className="text-4xl sm:text-5xl font-bold mb-3">VendX SSO API</h1>
          <p className="text-lg text-muted-foreground">
            Let users sign into your service with their VendX Global Corporation account. Standard OAuth 2.0
            Authorization Code flow with PKCE, scoped userinfo, refresh tokens, and webhook events.
          </p>
        </header>

        <div className="grid md:grid-cols-[200px_1fr] gap-8">
          {/* TOC */}
          <aside className="hidden md:block">
            <nav className="sticky top-24 space-y-1 text-sm">
              {[
                ["overview", "Overview"],
                ["register", "1. Register your app"],
                ["flow", "2. Authorization flow"],
                ["endpoints", "3. Endpoints"],
                ["scopes", "4. Scopes"],
                ["userinfo", "5. UserInfo response"],
                ["refresh", "6. Refreshing tokens"],
                ["webhooks", "7. Webhooks"],
                ["errors", "8. Error codes"],
                ["ai", "9. AI-builder quick start"],
              ].map(([id, label]) => (
                <a key={id} href={`#${id}`} className="block text-muted-foreground hover:text-primary py-1 px-2 rounded">
                  {label}
                </a>
              ))}
            </nav>
          </aside>

          {/* Body */}
          <article className="space-y-12 min-w-0">
            <Section id="overview">
              <h2 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck className="w-6 h-6 text-primary" /> Overview</h2>
              <p className="text-muted-foreground">
                VendX SSO is a standard OAuth 2.0 / OpenID-Connect-style identity provider. Any external service in the
                VendX ecosystem — kiosk apps, partner portals, third-party tools — can let users sign in with their
                main VendX account. Once linked, your service receives a stable user ID (<code>sub</code>) plus any
                profile, wallet, rewards, or role data the user consents to share.
              </p>
              <Card className="p-4 bg-primary/5 border-primary/30">
                <p className="text-sm"><strong>Base URL:</strong> <code>{base}</code></p>
                <p className="text-sm mt-1"><strong>Consent UI:</strong> <code>https://vendx.space/sso/authorize</code></p>
              </Card>
            </Section>

            <Section id="register">
              <h2 className="text-2xl font-bold flex items-center gap-2"><KeyRound className="w-6 h-6 text-primary" /> 1. Register your app</h2>
              <p>A VendX super-admin registers your service from <strong>Dashboard → System Administration → SSO Applications</strong>. You'll receive a one-time:</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
                <li><code>client_id</code> — public, safe to ship in frontend code.</li>
                <li><code>client_secret</code> — private, store on your server only.</li>
              </ul>
              <p className="text-sm">You also configure: allowed redirect URIs, allowed scopes, logo, homepage. Public/mobile apps that can't hold a secret should use the PKCE-only flow (see step 2).</p>
            </Section>

            <Section id="flow">
              <h2 className="text-2xl font-bold flex items-center gap-2"><UserCheck className="w-6 h-6 text-primary" /> 2. Authorization flow</h2>
              <pre className="bg-muted/50 border border-border rounded-lg p-4 overflow-x-auto text-xs leading-relaxed">{`Your app                        User browser                       VendX
   │                                  │                                │
   │ 1. redirect to /sso/authorize    │                                │
   │─────────────────────────────────▶│ 2. user signs in & approves    │
   │                                  │────────────────────────────────▶│
   │ 4. redirect ?code=...&state=...  │ 3. issues short-lived code     │
   │◀─────────────────────────────────│◀────────────────────────────────│
   │ 5. POST /sso-token (code → tokens)                                │
   │──────────────────────────────────────────────────────────────────▶│
   │ 6. access_token + refresh_token                                  │
   │◀──────────────────────────────────────────────────────────────────│
   │ 7. GET /sso-userinfo (Bearer token)                              │
   │──────────────────────────────────────────────────────────────────▶│
   │ 8. user object (scoped)                                          │
   │◀──────────────────────────────────────────────────────────────────│`}</pre>

              <h3 className="text-lg font-semibold mt-4">Step 1 — Redirect the user to consent</h3>
              <pre className="bg-muted/50 border border-border rounded-lg p-4 overflow-x-auto text-xs leading-relaxed">{`https://vendx.space/sso/authorize
  ?client_id=vxs_abc123
  &redirect_uri=https://yourapp.com/auth/callback
  &scope=profile email wallet:read
  &state=RANDOM_CSRF_TOKEN
  &code_challenge=BASE64URL_SHA256(verifier)   # PKCE, recommended
  &code_challenge_method=S256`}</pre>

              <h3 className="text-lg font-semibold mt-4">Step 5 — Exchange code for tokens</h3>
              <pre className="bg-muted/50 border border-border rounded-lg p-4 overflow-x-auto text-xs leading-relaxed">{`curl -X POST ${base}/sso-token \\
  -H "Content-Type: application/json" \\
  -d '{
    "grant_type": "authorization_code",
    "client_id": "vxs_abc123",
    "client_secret": "vxss_…",          // omit for PKCE-only public clients
    "code": "AUTH_CODE_FROM_REDIRECT",
    "redirect_uri": "https://yourapp.com/auth/callback",
    "code_verifier": "ORIGINAL_PKCE_VERIFIER"
  }'`}</pre>
              <p className="text-sm">Response:</p>
              <pre className="bg-muted/50 border border-border rounded-lg p-4 overflow-x-auto text-xs leading-relaxed">{`{
  "access_token":  "vxat_…",
  "refresh_token": "vxrt_…",
  "token_type":    "Bearer",
  "expires_in":    3600,
  "scope":         "profile email wallet:read"
}`}</pre>
            </Section>

            <Section id="endpoints">
              <h2 className="text-2xl font-bold">3. Endpoints</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-2">Method</th>
                      <th className="text-left p-2">Path</th>
                      <th className="text-left p-2">Purpose</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b border-border"><td className="p-2"><code>GET</code></td><td className="p-2"><code>/sso/authorize</code> (browser)</td><td className="p-2">Consent UI</td></tr>
                    <tr className="border-b border-border"><td className="p-2"><code>POST</code></td><td className="p-2"><code>/sso-token</code></td><td className="p-2">Exchange code / refresh token</td></tr>
                    <tr className="border-b border-border"><td className="p-2"><code>GET</code></td><td className="p-2"><code>/sso-userinfo</code></td><td className="p-2">Fetch user (Bearer)</td></tr>
                    <tr className="border-b border-border"><td className="p-2"><code>POST</code></td><td className="p-2"><code>/sso-revoke</code></td><td className="p-2">Revoke access/refresh token</td></tr>
                  </tbody>
                </table>
              </div>
            </Section>

            <Section id="scopes">
              <h2 className="text-2xl font-bold">4. Scopes</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead><tr className="border-b border-border"><th className="text-left p-2">Scope</th><th className="text-left p-2">Grants</th></tr></thead>
                  <tbody className="text-muted-foreground">
                    {[
                      ["profile", "Name, avatar, job title, department, phone, company"],
                      ["email", "Email address"],
                      ["wallet:read", "VendX Pay wallet balance & tier"],
                      ["rewards:read", "Reward points balance, lifetime, tier"],
                      ["tickets:read", "Arcade ticket balance"],
                      ["roles:read", "VendX roles assigned to the user"],
                      ["divisions:read", "Divisions the user is part of"],
                    ].map(([s, d]) => (
                      <tr key={s} className="border-b border-border"><td className="p-2 align-top"><code>{s}</code></td><td className="p-2">{d}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section id="userinfo">
              <h2 className="text-2xl font-bold">5. UserInfo response</h2>
              <pre className="bg-muted/50 border border-border rounded-lg p-4 overflow-x-auto text-xs leading-relaxed">{`curl ${base}/sso-userinfo \\
  -H "Authorization: Bearer vxat_…"

// → 200 OK
{
  "sub":     "user-uuid",
  "name":    "Jane Doe",
  "email":   "jane@example.com",
  "picture": "https://…",
  "job_title":  "Operator",
  "department": "Field Service",
  "company":    "VendX Global Corporation",
  "wallet":   { "balance": 42.50, "tier_level": "gold", "is_guest": false },
  "rewards":  { "balance": 1280, "lifetime_points": 9400, "tier": "silver" },
  "tickets":  { "balance": 350, "lifetime_earned": 2100, "lifetime_redeemed": 1750 },
  "roles":    ["customer", "employee_operator"],
  "divisions":[ { "id": "...", "name": "Interactive Gaming", "slug": "gaming" } ]
}`}</pre>
              <p className="text-sm text-muted-foreground">Fields appear only when their scope was granted. <code>sub</code> is the user's stable, unique VendX ID — use it as the foreign key on your side.</p>
            </Section>

            <Section id="refresh">
              <h2 className="text-2xl font-bold flex items-center gap-2"><RefreshCw className="w-6 h-6 text-primary" /> 6. Refreshing tokens</h2>
              <p className="text-sm">Access tokens last 1 hour. Refresh tokens last 30 days and are <strong>rotated on every use</strong> — store the new one each time.</p>
              <pre className="bg-muted/50 border border-border rounded-lg p-4 overflow-x-auto text-xs leading-relaxed">{`curl -X POST ${base}/sso-token \\
  -H "Content-Type: application/json" \\
  -d '{
    "grant_type":    "refresh_token",
    "client_id":     "vxs_abc123",
    "client_secret": "vxss_…",
    "refresh_token": "vxrt_…"
  }'`}</pre>
            </Section>

            <Section id="webhooks">
              <h2 className="text-2xl font-bold flex items-center gap-2"><Webhook className="w-6 h-6 text-primary" /> 7. Webhooks (optional)</h2>
              <p className="text-sm">Subscribe to per-user events so your service stays in sync without polling. Events are POSTed as JSON, signed with HMAC-SHA256 of the raw body using your <code>client_secret</code> in the header <code>X-VendX-Signature: sha256=&lt;hex&gt;</code> and a <code>X-VendX-Timestamp</code> header.</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
                <li><code>user.profile.updated</code></li>
                <li><code>user.wallet.updated</code></li>
                <li><code>user.rewards.updated</code></li>
                <li><code>user.roles.changed</code></li>
                <li><code>user.unlinked</code> — fired when a user revokes your app</li>
              </ul>
              <p className="text-sm">Verify the signature server-side; reject requests older than 5 minutes.</p>
            </Section>

            <Section id="errors">
              <h2 className="text-2xl font-bold">8. Error codes</h2>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li><code>invalid_request</code> — missing required parameters</li>
                <li><code>invalid_client</code> — bad client_id or client_secret</li>
                <li><code>invalid_grant</code> — code expired/used/mismatched, or refresh token invalid</li>
                <li><code>access_denied</code> — user clicked "Deny" on consent screen</li>
                <li><code>invalid_token</code> — access token expired or revoked</li>
                <li><code>unsupported_grant_type</code> — only <code>authorization_code</code> and <code>refresh_token</code> are supported</li>
              </ul>
            </Section>

            <Section id="ai">
              <h2 className="text-2xl font-bold flex items-center gap-2"><Code className="w-6 h-6 text-primary" /> 9. AI-builder quick start</h2>
              <p className="text-sm">Copy this block into another AI coding assistant (Lovable, Cursor, Claude, etc.) to integrate VendX SSO into a new app:</p>
              <pre className="bg-muted/50 border border-border rounded-lg p-4 overflow-x-auto text-xs leading-relaxed">{`Integrate "Sign in with VendX" using OAuth 2.0 Authorization Code + PKCE.

Provider config:
- authorize_url:  https://vendx.space/sso/authorize
- token_url:      ${base}/sso-token
- userinfo_url:   ${base}/sso-userinfo
- revoke_url:     ${base}/sso-revoke
- token_type:     Bearer (opaque tokens, not JWT)
- access_token_ttl_seconds: 3600
- refresh_token_ttl_days:   30
- pkce_method:    S256
- scopes:         profile email wallet:read rewards:read tickets:read roles:read divisions:read
- unique user id: \`sub\` (UUID, stable across sessions)

Steps:
1. Add a "Sign in with VendX" button.
2. Generate a PKCE verifier (43-128 random chars) and S256 challenge.
3. Redirect the user to authorize_url with: client_id, redirect_uri, scope, state, code_challenge, code_challenge_method=S256.
4. On callback, exchange ?code= for tokens via POST token_url with grant_type=authorization_code,
   sending client_id, client_secret (if confidential), code, redirect_uri, code_verifier.
5. Call userinfo_url with Authorization: Bearer <access_token> to get the user profile.
6. Use \`sub\` as the foreign key in your users table.
7. Refresh tokens before expiry; store the rotated refresh_token returned each time.
8. On logout, call revoke_url with { "token": "<token>" }.`}</pre>
            </Section>
          </article>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default SsoDocsPage;
