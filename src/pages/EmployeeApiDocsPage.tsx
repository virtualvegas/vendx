import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const base = "https://xbbnodpvfvxtbffziuvr.supabase.co/functions/v1/employee-api";

const endpoints: { m: string; p: string; s: string; d: string }[] = [
  { m: "GET", p: "/me", s: "any", d: "Signed-in employee, roles, manager flag and granted scopes." },
  { m: "GET", p: "/routes?status=&mine=true", s: "ops:routes", d: "Routes. Operators only get routes assigned to them." },
  { m: "GET", p: "/routes/:id", s: "ops:routes", d: "Route with all stops, locations and machines." },
  { m: "PATCH", p: "/routes/:id", s: "ops:routes", d: "Update route status (active, in_progress, completed, paused)." },
  { m: "GET", p: "/stops/:id", s: "ops:routes", d: "Single stop." },
  { m: "PATCH", p: "/stops/:id", s: "ops:routes", d: "Update status, tech_notes, notes, restocked_items." },
  { m: "POST", p: "/stops/:id/complete", s: "ops:routes", d: "Mark stop completed (optionally include notes / restocked_items)." },
  { m: "GET", p: "/collections?from=&to=&machine_id=&location_id=", s: "ops:collections", d: "Cash collections. Operators see their own." },
  { m: "POST", p: "/collections", s: "ops:collections", d: "Record collected money for a machine (pending verification)." },
  { m: "GET", p: "/collections/:id", s: "ops:collections", d: "Single collection." },
  { m: "PATCH", p: "/collections/:id", s: "ops:collections", d: "Edit amounts/notes (until verified)." },
  { m: "POST", p: "/collections/:id/verify", s: "ops:collections", d: "Managers: verify a collection." },
  { m: "GET", p: "/earnings?from=&to=&location_id=", s: "ops:collections", d: "Location earnings report from collections." },
  { m: "GET", p: "/service-requests?status=", s: "ops:tickets", d: "Location/machine service requests (assigned to you or unassigned)." },
  { m: "POST", p: "/service-requests", s: "ops:tickets", d: "Create a service request." },
  { m: "GET", p: "/service-requests/:id", s: "ops:tickets", d: "Request with responses." },
  { m: "PATCH", p: "/service-requests/:id", s: "ops:tickets", d: "Update status, priority, resolution, assignment." },
  { m: "POST", p: "/service-requests/:id/responses", s: "ops:tickets", d: "Add a note/response." },
  { m: "GET", p: "/service-tickets?status=&scheduled_date=", s: "ops:tickets", d: "External service tickets (client machines)." },
  { m: "POST", p: "/service-tickets", s: "ops:tickets", d: "Create an external service ticket." },
  { m: "GET", p: "/service-tickets/:id", s: "ops:tickets", d: "Ticket with machines and activity." },
  { m: "PATCH", p: "/service-tickets/:id", s: "ops:tickets", d: "Update status, schedule, notes, labor, parts, technician." },
  { m: "POST", p: "/service-tickets/:id/updates", s: "ops:tickets", d: "Add a ticket update." },
];

const Code = ({ children }: { children: string }) => (
  <pre className="bg-muted/50 border border-border rounded-md p-4 text-xs overflow-x-auto"><code>{children}</code></pre>
);

const EmployeeApiDocsPage = () => {
  useSEO({ title: "VendX Employee Operations API — Docs", description: "API for employee apps to manage routes, cash collections, location earnings, service requests and tickets." });
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <main className="max-w-5xl mx-auto px-4 py-16 space-y-10">
        <header>
          <p className="text-xs uppercase tracking-widest text-primary mb-2">Developer Documentation</p>
          <h1 className="text-4xl sm:text-5xl font-bold mb-3">Employee Operations API</h1>
          <p className="text-lg text-muted-foreground">Let employee apps (payroll, clock-in portals) work routes, record cash collections, report location earnings and manage service tickets — as the signed-in employee.</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">1. Sign in the employee</h2>
          <p className="text-muted-foreground">Register your portal in the admin dashboard under SSO Apps and allow the scopes <Badge variant="outline">ops:routes</Badge> <Badge variant="outline">ops:collections</Badge> <Badge variant="outline">ops:tickets</Badge>. Then use the standard <a className="text-primary underline" href="/developers/sso">VendX SSO flow</a> requesting those scopes. The <code>vxat_</code> access token you receive is used below.</p>
          <Code>{`https://vendxglobal.net/sso/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=...&scope=profile email ops:routes ops:collections ops:tickets&code_challenge=...&code_challenge_method=S256`}</Code>
          <p className="text-sm text-muted-foreground">Only employee accounts can use this API. Managers (super admin, operations, regional, tech lead) see everything; operators and technicians see their own routes, collections and tickets. Every change is recorded in the audit log under the employee.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">2. Call the API</h2>
          <Code>{`curl ${base}/routes \\
  -H "Authorization: Bearer vxat_..."

curl -X POST ${base}/collections \\
  -H "Authorization: Bearer vxat_..." -H "Content-Type: application/json" \\
  -d '{"machine_id":"<uuid>","route_stop_id":"<uuid>","cash_amount":120.50,"coins_amount":14.25,"notes":"Bill validator jammed"}'

curl -X POST ${base}/stops/<stop_id>/complete \\
  -H "Authorization: Bearer vxat_..." -H "Content-Type: application/json" \\
  -d '{"tech_notes":"Restocked A1-A6"}'`}</Code>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">Endpoints</h2>
          <p className="text-sm text-muted-foreground">Base URL: <code className="break-all">{base}</code>. List endpoints accept <code>limit</code> (max 500).</p>
          <div className="grid gap-2">
            {endpoints.map((e) => (
              <Card key={e.m + e.p} className="p-3 flex flex-wrap items-center gap-3">
                <Badge variant={e.m === "GET" ? "secondary" : "default"} className="w-16 justify-center">{e.m}</Badge>
                <code className="text-sm font-mono">{e.p}</code>
                <Badge variant="outline" className="text-xs">{e.s}</Badge>
                <span className="text-sm text-muted-foreground w-full sm:w-auto">{e.d}</span>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">Errors</h2>
          <Code>{`401 invalid_token        token missing, expired or revoked
403 forbidden            not an employee, or not your route/ticket
403 missing_scope:<s>    token lacks the scope
400 validation_error     body failed validation (details per field)
404 not_found            unknown record or endpoint
409 already_verified     collection already verified by a manager`}</Code>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default EmployeeApiDocsPage;
