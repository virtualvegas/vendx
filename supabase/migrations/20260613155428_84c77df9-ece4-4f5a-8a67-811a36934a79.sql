
-- ============================================================
-- VendX SSO Apps
-- ============================================================
CREATE TABLE public.vendx_sso_apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL UNIQUE,
  client_secret_hash text NOT NULL,
  client_secret_prefix text NOT NULL,
  name text NOT NULL,
  description text,
  logo_url text,
  homepage_url text,
  redirect_uris text[] NOT NULL DEFAULT '{}',
  allowed_scopes text[] NOT NULL DEFAULT ARRAY['profile','email'],
  is_active boolean NOT NULL DEFAULT true,
  is_first_party boolean NOT NULL DEFAULT false,
  owner_email text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendx_sso_apps TO authenticated;
GRANT ALL ON public.vendx_sso_apps TO service_role;

ALTER TABLE public.vendx_sso_apps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage SSO apps"
  ON public.vendx_sso_apps FOR ALL
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER update_vendx_sso_apps_updated_at
  BEFORE UPDATE ON public.vendx_sso_apps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- VendX SSO Auth Codes (short-lived)
-- ============================================================
CREATE TABLE public.vendx_sso_auth_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL UNIQUE,
  app_id uuid NOT NULL REFERENCES public.vendx_sso_apps(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redirect_uri text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  code_challenge text,
  code_challenge_method text,
  state text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.vendx_sso_auth_codes TO authenticated;
GRANT ALL ON public.vendx_sso_auth_codes TO service_role;

ALTER TABLE public.vendx_sso_auth_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own SSO auth codes"
  ON public.vendx_sso_auth_codes FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================
-- VendX SSO Tokens
-- ============================================================
CREATE TABLE public.vendx_sso_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token_hash text NOT NULL UNIQUE,
  refresh_token_hash text UNIQUE,
  app_id uuid NOT NULL REFERENCES public.vendx_sso_apps(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scopes text[] NOT NULL DEFAULT '{}',
  expires_at timestamptz NOT NULL,
  refresh_expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, DELETE ON public.vendx_sso_tokens TO authenticated;
GRANT ALL ON public.vendx_sso_tokens TO service_role;

ALTER TABLE public.vendx_sso_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own SSO tokens"
  ON public.vendx_sso_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can revoke (delete) their own SSO tokens"
  ON public.vendx_sso_tokens FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_vendx_sso_tokens_user ON public.vendx_sso_tokens(user_id);
CREATE INDEX idx_vendx_sso_tokens_app ON public.vendx_sso_tokens(app_id);

-- ============================================================
-- VendX SSO Linked Accounts
-- ============================================================
CREATE TABLE public.vendx_sso_linked_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_id uuid NOT NULL REFERENCES public.vendx_sso_apps(id) ON DELETE CASCADE,
  external_user_id text,
  external_email text,
  scopes_granted text[] NOT NULL DEFAULT '{}',
  linked_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (user_id, app_id)
);

GRANT SELECT, UPDATE, DELETE ON public.vendx_sso_linked_accounts TO authenticated;
GRANT ALL ON public.vendx_sso_linked_accounts TO service_role;

ALTER TABLE public.vendx_sso_linked_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own linked accounts"
  ON public.vendx_sso_linked_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can revoke their own linked accounts"
  ON public.vendx_sso_linked_accounts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own linked accounts"
  ON public.vendx_sso_linked_accounts FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Super admins view all linked accounts"
  ON public.vendx_sso_linked_accounts FOR SELECT
  USING (public.has_role(auth.uid(),'super_admin'));

-- ============================================================
-- VendX SSO Webhook Subscriptions
-- ============================================================
CREATE TABLE public.vendx_sso_webhook_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id uuid NOT NULL REFERENCES public.vendx_sso_apps(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  endpoint_url text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, event_type, endpoint_url)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendx_sso_webhook_subscriptions TO authenticated;
GRANT ALL ON public.vendx_sso_webhook_subscriptions TO service_role;

ALTER TABLE public.vendx_sso_webhook_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage SSO webhooks"
  ON public.vendx_sso_webhook_subscriptions FOR ALL
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER update_vendx_sso_webhook_subscriptions_updated_at
  BEFORE UPDATE ON public.vendx_sso_webhook_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Functions
-- ============================================================

-- Create a new SSO app (admin only). Returns plaintext credentials ONCE.
CREATE OR REPLACE FUNCTION public.create_vendx_sso_app(
  p_name text,
  p_description text DEFAULT NULL,
  p_logo_url text DEFAULT NULL,
  p_homepage_url text DEFAULT NULL,
  p_redirect_uris text[] DEFAULT '{}',
  p_allowed_scopes text[] DEFAULT ARRAY['profile','email'],
  p_owner_email text DEFAULT NULL,
  p_is_first_party boolean DEFAULT false
)
RETURNS TABLE(app_id uuid, client_id text, client_secret text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','extensions'
AS $$
DECLARE
  v_client_id text;
  v_client_secret text;
  v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  v_client_id := 'vxs_' || encode(extensions.gen_random_bytes(12), 'hex');
  v_client_secret := 'vxss_' || encode(extensions.gen_random_bytes(32), 'hex');

  INSERT INTO public.vendx_sso_apps (
    client_id, client_secret_hash, client_secret_prefix,
    name, description, logo_url, homepage_url,
    redirect_uris, allowed_scopes, owner_email, is_first_party, created_by
  ) VALUES (
    v_client_id, public.hash_api_key(v_client_secret), substring(v_client_secret from 1 for 12),
    p_name, p_description, p_logo_url, p_homepage_url,
    COALESCE(p_redirect_uris,'{}'),
    COALESCE(p_allowed_scopes, ARRAY['profile','email']),
    p_owner_email, COALESCE(p_is_first_party,false),
    auth.uid()
  ) RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, v_client_id, v_client_secret;
END;
$$;

-- Rotate the client secret. Returns the new plaintext secret ONCE.
CREATE OR REPLACE FUNCTION public.rotate_vendx_sso_app_secret(p_app_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','extensions'
AS $$
DECLARE
  v_secret text;
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  v_secret := 'vxss_' || encode(extensions.gen_random_bytes(32), 'hex');

  UPDATE public.vendx_sso_apps
    SET client_secret_hash = public.hash_api_key(v_secret),
        client_secret_prefix = substring(v_secret from 1 for 12),
        updated_at = now()
    WHERE id = p_app_id;

  RETURN v_secret;
END;
$$;
