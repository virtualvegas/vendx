# VendX SSO & Account Linking System

Build an OAuth 2.0–style Single Sign-On so external VendX services (and approved third-party apps) can let users sign in with their main VendX account, link the two identities, and sync shared data (profile, wallet balance, rewards points, tickets, roles).

## What gets built

### 1. SSO Apps registry (admin-managed)
A new admin tab **"SSO Applications"** under System Administration to register client apps.

Each SSO App has:
- `client_id` (public) and `client_secret` (hashed, shown once)
- Name, description, logo, homepage URL
- Allowed redirect URIs (array)
- Requested scopes (profile, email, wallet:read, rewards:read, tickets:read, roles:read, divisions:read)
- Active / revoked flag
- Owner (internal team or partner)

### 2. OAuth 2.0 Authorization Code flow
Three edge functions + one consent page:

```text
External app → /sso/authorize (consent page)
            ↓ user approves
            → redirect_uri?code=XXX
External app → POST sso-token (exchange code → access_token + refresh_token)
External app → GET  sso-userinfo (Bearer token → user data scoped by grants)
External app → POST sso-refresh (refresh_token → new access_token)
```

PKCE supported (S256) for public clients.

### 3. Account Linking
When a user signs in via SSO from another VendX service, a row is written to `vendx_sso_linked_accounts` mapping the external `client_id` + external user id ↔ main VendX `user_id`. The same VendX user can be linked to many services; re-auth refreshes the link.

A new customer tab **"Linked Accounts"** lets users see and revoke any service connected to their account.

### 4. Data sync
`sso-userinfo` returns a live snapshot of the consented data (no separate sync job needed — the source of truth is the main account). For wallet/rewards changes, services poll or use the existing webhook infrastructure. A lightweight `sso-event-webhook` is added so services subscribed to `wallet.updated`, `rewards.updated`, `roles.changed` receive push notifications signed with the client_secret (HMAC SHA-256, matching the existing merchant-webhook pattern).

### 5. Developer documentation
A new public page **`/developers/sso`** rendering a full integration guide:
- Overview & concepts
- Registering an app
- Authorization Code + PKCE flow with sequence diagram
- Endpoint reference (authorize, token, userinfo, refresh, revoke)
- Scopes table
- Webhook events + signature verification
- Sample code (curl, JS/TS, React hook)
- Error codes
- AI-builder quick-start block (copy-paste prompt template for other AI systems)

Plus a markdown copy at `docs/SSO_INTEGRATION.md` so the docs are versioned in the repo.

## Technical details

### Database (migration)
- `vendx_sso_apps` — registered client apps. `client_secret_hash`, `redirect_uris text[]`, `scopes text[]`, `is_active`, `created_by`.
- `vendx_sso_auth_codes` — short-lived (10 min) auth codes. `code_hash`, `client_id`, `user_id`, `redirect_uri`, `scopes`, `code_challenge`, `expires_at`, `used_at`.
- `vendx_sso_tokens` — access + refresh tokens. `access_token_hash`, `refresh_token_hash`, `client_id`, `user_id`, `scopes`, `expires_at`, `revoked_at`.
- `vendx_sso_linked_accounts` — `user_id`, `client_id`, `external_user_id`, `linked_at`, `last_used_at`, `scopes_granted`.
- `vendx_sso_webhook_subscriptions` — `client_id`, `event_type`, `endpoint_url`, `is_active`.

All tables: `vendx_` prefix ✅, full GRANTs, RLS (users see their own links/tokens; super_admin sees apps; service_role full).

### Edge functions (pinned `@supabase/supabase-js@2.45.0`)
- `sso-authorize` — validates client_id + redirect_uri, requires authenticated user, issues code.
- `sso-token` — exchanges code or refresh_token, verifies client_secret/PKCE, returns JWT-ish opaque tokens.
- `sso-userinfo` — Bearer-protected; returns `{ sub, email, name, avatar, divisions, wallet_balance?, rewards_points?, tickets?, roles? }` filtered by granted scopes.
- `sso-revoke` — revokes a token or link.
- `sso-event-dispatch` — internal helper fired by DB triggers on wallet/rewards changes; signs with HMAC and POSTs subscribers.

### Frontend
- `/sso/authorize` — consent page (logo, requested scopes list, Allow/Deny buttons).
- `src/components/dashboard/tabs/SsoAppsManager.tsx` — admin CRUD for apps.
- `src/components/dashboard/tabs/MyLinkedAccounts.tsx` — user-facing linked-services manager.
- `/developers/sso` — public docs page.
- Sidebar entry: **SSO Applications** under System Administration; **Linked Accounts** under customer "My Account".
- `tabAccess.ts` updated (sso-apps → super_admin only; linked-accounts → all authed).

### Security
- client_secret stored only as bcrypt-style hash.
- Auth codes single-use, 10-min TTL, bound to redirect_uri + PKCE challenge.
- Access tokens 1 hr; refresh tokens 30 days, rotated on use.
- All mutations written to `audit_logs`.
- Webhook signatures use HMAC SHA-256 with timestamp, matching `merchant-webhook.ts` conventions.

## Out of scope (this pass)
- SAML/OIDC discovery doc (`.well-known/openid-configuration`) — can add later if needed.
- Per-user OAuth back to external providers (Google/Apple) — already handled by existing auth.
- Granular per-field consent UI beyond scope checkboxes.

Approve and I'll ship it in this order: migration → edge functions → consent page → admin & user tabs → docs page.
