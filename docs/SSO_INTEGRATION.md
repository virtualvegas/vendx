# VendX SSO Integration Guide

OAuth 2.0 / OpenID-Connect-style Single Sign-On for the VendX ecosystem.
Live docs page: https://vendx.space/developers/sso

---

## Base URL

```
https://xbbnodpvfvxtbffziuvr.supabase.co/functions/v1
```

Consent UI: `https://vendx.space/sso/authorize`

---

## 1. Register your app

A VendX super-admin registers your service from **Dashboard → System Administration → SSO Applications**.
You receive ONCE:

- `client_id` — public, ship in frontend
- `client_secret` — private, server only (omit for PKCE-only public/mobile clients)

You also configure: allowed redirect URIs, allowed scopes, logo, homepage URL.

---

## 2. Authorization Code + PKCE flow

```
Your app → /sso/authorize → user approves → ?code=… → /sso-token → access+refresh tokens
                                                              → /sso-userinfo (Bearer) → user object
```

### Step 1 — Redirect

```
https://vendx.space/sso/authorize
  ?client_id=vxs_abc123
  &redirect_uri=https://yourapp.com/auth/callback
  &scope=profile email wallet:read
  &state=RANDOM_CSRF_TOKEN
  &code_challenge=BASE64URL_SHA256(verifier)
  &code_challenge_method=S256
```

### Step 2 — Exchange code

```bash
curl -X POST https://xbbnodpvfvxtbffziuvr.supabase.co/functions/v1/sso-token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type":    "authorization_code",
    "client_id":     "vxs_abc123",
    "client_secret": "vxss_…",
    "code":          "AUTH_CODE",
    "redirect_uri":  "https://yourapp.com/auth/callback",
    "code_verifier": "ORIGINAL_PKCE_VERIFIER"
  }'
```

Response:

```json
{
  "access_token":  "vxat_…",
  "refresh_token": "vxrt_…",
  "token_type":    "Bearer",
  "expires_in":    3600,
  "scope":         "profile email wallet:read"
}
```

### Step 3 — Fetch user

```bash
curl https://xbbnodpvfvxtbffziuvr.supabase.co/functions/v1/sso-userinfo \
  -H "Authorization: Bearer vxat_…"
```

Returns a JSON object filtered by granted scopes. `sub` is the stable user UUID.

---

## 3. Scopes

| Scope             | Grants                                          |
| ----------------- | ----------------------------------------------- |
| `profile`         | name, avatar, job title, department, phone, company |
| `email`           | email address                                   |
| `wallet:read`     | VendX Pay balance + tier                        |
| `rewards:read`    | reward points balance + tier                    |
| `tickets:read`    | arcade ticket balance                           |
| `roles:read`      | VendX roles                                     |
| `divisions:read`  | assigned VendX divisions                        |

---

## 4. Refresh & revoke

- Access tokens TTL: **1 hour**
- Refresh tokens TTL: **30 days**, **rotated on every use** — store the new one each time
- `POST /sso-token` with `grant_type=refresh_token`
- `POST /sso-revoke` with `{ "token": "<access_or_refresh>" }`

---

## 5. Error codes

`invalid_request`, `invalid_client`, `invalid_grant`, `access_denied`,
`invalid_token`, `unsupported_grant_type`.

---

## 6. Account linking

The first successful token exchange creates a row in `vendx_sso_linked_accounts`
mapping the VendX user to your app. The user can see and revoke any linked app
from **Dashboard → My Account → Linked Accounts**.

---

## 7. AI-builder quick start

Paste this block into another AI coding assistant to wire up "Sign in with VendX":

```
Integrate "Sign in with VendX" using OAuth 2.0 Authorization Code + PKCE.

Provider config:
- authorize_url:  https://vendx.space/sso/authorize
- token_url:      https://xbbnodpvfvxtbffziuvr.supabase.co/functions/v1/sso-token
- userinfo_url:   https://xbbnodpvfvxtbffziuvr.supabase.co/functions/v1/sso-userinfo
- revoke_url:     https://xbbnodpvfvxtbffziuvr.supabase.co/functions/v1/sso-revoke
- token_type:     Bearer (opaque, not JWT)
- access_token_ttl_seconds: 3600
- refresh_token_ttl_days:   30
- pkce_method:    S256
- scopes:         profile email wallet:read rewards:read tickets:read roles:read divisions:read
- unique user id: `sub` (UUID, stable)

Build the standard PKCE flow and use `sub` as the foreign key on the users table.
Store the rotated refresh_token after every refresh. Call revoke_url on logout.
```
