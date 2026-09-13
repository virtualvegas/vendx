REVOKE EXECUTE ON FUNCTION public.hash_api_key(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.generate_external_stream_api_key() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_external_stream_api_key(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_vendx_catalog_partner(text, text, text, text, text, numeric, text[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_vendx_catalog_partner_api_key(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_vendx_merchant(text, text, text[], text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_vendx_merchant_api_key(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_vendx_merchant_webhook_secret(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_vendx_sso_app(text, text, text, text, text[], text[], text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_vendx_sso_app_secret(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_machine_revenue_to_income(date, date, uuid) TO authenticated;