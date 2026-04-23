CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Streams (config) table
CREATE TABLE public.external_income_streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  source_url text,
  default_category text NOT NULL DEFAULT 'other',
  default_subcategory text,
  color text DEFAULT '#10b981',
  icon text DEFAULT 'globe',
  is_active boolean NOT NULL DEFAULT true,
  api_key_hash text NOT NULL,
  api_key_prefix text NOT NULL,
  default_account_id uuid REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  default_payment_method text DEFAULT 'external',
  is_taxable boolean NOT NULL DEFAULT true,
  total_entries integer NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  last_received_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_eis_slug ON public.external_income_streams(slug);
CREATE INDEX idx_eis_active ON public.external_income_streams(is_active);
CREATE INDEX idx_eis_api_key_hash ON public.external_income_streams(api_key_hash);

-- Entries (data) table
CREATE TABLE public.external_income_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.external_income_streams(id) ON DELETE CASCADE,
  external_reference text NOT NULL,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  source text NOT NULL,
  description text,
  amount numeric NOT NULL,
  tax_collected numeric DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  category text,
  subcategory text,
  payment_method text,
  customer_email text,
  customer_name text,
  is_taxable boolean,
  raw_payload jsonb,
  status text NOT NULL DEFAULT 'received',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_external_income_dedupe UNIQUE (stream_id, external_reference)
);
CREATE INDEX idx_eie_stream ON public.external_income_entries(stream_id);
CREATE INDEX idx_eie_date ON public.external_income_entries(entry_date DESC);
CREATE INDEX idx_eie_category ON public.external_income_entries(category);
CREATE INDEX idx_eie_status ON public.external_income_entries(status);

ALTER TABLE public.external_income_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_income_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance roles view streams" ON public.external_income_streams FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_accounting'));
CREATE POLICY "Super admin insert streams" ON public.external_income_streams FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admin update streams" ON public.external_income_streams FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admin delete streams" ON public.external_income_streams FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Finance roles view entries" ON public.external_income_entries FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_accounting'));
CREATE POLICY "Finance roles update entries" ON public.external_income_entries FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_accounting'));
CREATE POLICY "Finance roles delete entries" ON public.external_income_entries FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_accounting'));

CREATE TRIGGER trg_eis_updated BEFORE UPDATE ON public.external_income_streams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_eie_updated BEFORE UPDATE ON public.external_income_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== Helper functions =====

CREATE OR REPLACE FUNCTION public.hash_api_key(p_key text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public', 'extensions'
AS $$ SELECT encode(extensions.digest(p_key, 'sha256'), 'hex'); $$;

CREATE OR REPLACE FUNCTION public.generate_external_stream_api_key()
RETURNS TABLE(plain_key text, key_hash text, key_prefix text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
DECLARE v_key text;
BEGIN
  IF NOT has_role(auth.uid(), 'super_admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  v_key := 'vxk_' || encode(extensions.gen_random_bytes(20), 'hex');
  RETURN QUERY SELECT v_key, public.hash_api_key(v_key), substring(v_key from 1 for 12);
END; $$;

CREATE OR REPLACE FUNCTION public.rotate_external_stream_api_key(p_stream_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
DECLARE v_key text;
BEGIN
  IF NOT has_role(auth.uid(), 'super_admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  v_key := 'vxk_' || encode(extensions.gen_random_bytes(20), 'hex');
  UPDATE public.external_income_streams
  SET api_key_hash = public.hash_api_key(v_key),
      api_key_prefix = substring(v_key from 1 for 12),
      updated_at = now()
  WHERE id = p_stream_id;
  RETURN v_key;
END; $$;

CREATE OR REPLACE FUNCTION public.ingest_external_income(
  p_api_key text,
  p_external_reference text,
  p_entry_date date,
  p_source text,
  p_amount numeric,
  p_description text DEFAULT NULL,
  p_tax_collected numeric DEFAULT 0,
  p_currency text DEFAULT 'USD',
  p_category text DEFAULT NULL,
  p_subcategory text DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_customer_email text DEFAULT NULL,
  p_customer_name text DEFAULT NULL,
  p_raw_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(success boolean, entry_id uuid, message text, duplicate boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_stream public.external_income_streams%ROWTYPE;
  v_entry_id uuid;
  v_existing_id uuid;
BEGIN
  IF p_api_key IS NULL OR p_external_reference IS NULL OR p_amount IS NULL OR p_source IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Missing required fields'::text, false; RETURN;
  END IF;
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Amount must be positive'::text, false; RETURN;
  END IF;

  SELECT * INTO v_stream FROM public.external_income_streams
  WHERE api_key_hash = public.hash_api_key(p_api_key) AND is_active = true LIMIT 1;

  IF v_stream.id IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Invalid or inactive API key'::text, false; RETURN;
  END IF;

  SELECT id INTO v_existing_id FROM public.external_income_entries
  WHERE stream_id = v_stream.id AND external_reference = p_external_reference;
  IF v_existing_id IS NOT NULL THEN
    RETURN QUERY SELECT true, v_existing_id, 'Duplicate ignored'::text, true; RETURN;
  END IF;

  INSERT INTO public.external_income_entries (
    stream_id, external_reference, entry_date, source, description, amount, tax_collected,
    currency, category, subcategory, payment_method, customer_email, customer_name, is_taxable,
    raw_payload, status
  ) VALUES (
    v_stream.id, p_external_reference, COALESCE(p_entry_date, CURRENT_DATE), p_source, p_description,
    p_amount, COALESCE(p_tax_collected, 0), COALESCE(p_currency, 'USD'),
    COALESCE(p_category, v_stream.default_category), COALESCE(p_subcategory, v_stream.default_subcategory),
    COALESCE(p_payment_method, v_stream.default_payment_method),
    p_customer_email, p_customer_name, v_stream.is_taxable, p_raw_payload, 'received'
  ) RETURNING id INTO v_entry_id;

  UPDATE public.external_income_streams
  SET total_entries = total_entries + 1, total_amount = total_amount + p_amount,
      last_received_at = now(), updated_at = now()
  WHERE id = v_stream.id;

  RETURN QUERY SELECT true, v_entry_id, 'Income recorded'::text, false;
END; $$;

CREATE OR REPLACE FUNCTION public.get_unified_income(
  p_from_date date DEFAULT (CURRENT_DATE - INTERVAL '90 days')::date,
  p_to_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  id uuid, source_type text, stream_id uuid, stream_name text, stream_color text,
  income_date date, source text, description text, category text, subcategory text,
  amount numeric, tax_collected numeric, payment_method text, external_reference text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT fi.id, 'internal'::text, NULL::uuid, NULL::text, NULL::text,
    fi.income_date, fi.source, fi.description, fi.category, fi.subcategory,
    fi.amount, COALESCE(fi.tax_collected, 0), fi.payment_method, fi.external_reference
  FROM public.finance_income fi
  WHERE fi.income_date BETWEEN p_from_date AND p_to_date
    AND (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_accounting'))
  UNION ALL
  SELECT eie.id, 'external'::text, eis.id, eis.name, eis.color,
    eie.entry_date, eie.source, eie.description,
    COALESCE(eie.category, eis.default_category), eie.subcategory,
    eie.amount, COALESCE(eie.tax_collected, 0), eie.payment_method, eie.external_reference
  FROM public.external_income_entries eie
  JOIN public.external_income_streams eis ON eis.id = eie.stream_id
  WHERE eie.entry_date BETWEEN p_from_date AND p_to_date AND eie.status = 'received'
    AND (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_accounting'))
  ORDER BY income_date DESC;
$$;