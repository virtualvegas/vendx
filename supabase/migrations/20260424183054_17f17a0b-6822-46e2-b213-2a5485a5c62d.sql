DROP FUNCTION IF EXISTS public.ingest_external_income(
  p_api_key text,
  p_external_reference text,
  p_entry_date date,
  p_source text,
  p_amount numeric,
  p_description text,
  p_tax_collected numeric,
  p_currency text,
  p_category text,
  p_subcategory text,
  p_payment_method text,
  p_customer_email text,
  p_customer_name text,
  p_raw_payload jsonb
);