
-- =========================================
-- 1. vendx_machines api_key column protection
-- =========================================
REVOKE SELECT (api_key) ON public.vendx_machines FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_machine_api_key(p_machine_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_key text;
BEGIN
  IF NOT (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'tech_support_lead')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT api_key INTO v_key FROM public.vendx_machines WHERE id = p_machine_id;
  RETURN v_key;
END;$$;
REVOKE EXECUTE ON FUNCTION public.get_machine_api_key(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_machine_api_key(uuid) TO authenticated;

-- =========================================
-- 2. Quest progress/completions/leaderboards - remove self UPDATE
-- =========================================
DROP POLICY IF EXISTS "Users can update own progress" ON public.quest_player_progress;
DROP POLICY IF EXISTS "Users can update own completions" ON public.quest_completions;
DROP POLICY IF EXISTS "Users can update own leaderboard entry" ON public.quest_leaderboards;
DROP POLICY IF EXISTS "Users can insert own leaderboard entry" ON public.quest_leaderboards;
REVOKE UPDATE, INSERT ON public.quest_player_progress FROM anon, authenticated;
REVOKE UPDATE ON public.quest_completions FROM anon, authenticated;
REVOKE UPDATE, INSERT ON public.quest_leaderboards FROM anon, authenticated;
GRANT SELECT ON public.quest_player_progress TO authenticated;
GRANT SELECT ON public.quest_completions TO authenticated;
GRANT SELECT ON public.quest_leaderboards TO anon, authenticated;

-- =========================================
-- 3. rewards_points - remove self UPDATE
-- =========================================
DROP POLICY IF EXISTS "Users can update own points" ON public.rewards_points;
REVOKE UPDATE ON public.rewards_points FROM anon, authenticated;

-- =========================================
-- 4. user_tickets / ticket_transactions - close wide-open policies
-- =========================================
DROP POLICY IF EXISTS "System can manage ticket balances" ON public.user_tickets;
DROP POLICY IF EXISTS "System can insert ticket transactions" ON public.ticket_transactions;
REVOKE INSERT, UPDATE, DELETE ON public.user_tickets FROM anon, authenticated;
REVOKE INSERT ON public.ticket_transactions FROM anon, authenticated;

-- =========================================
-- 5. route_stops - remove public insert
-- =========================================
DROP POLICY IF EXISTS "System can insert stops" ON public.route_stops;

-- =========================================
-- 6. machine_activity_log - restrict SELECT to staff
-- =========================================
DROP POLICY IF EXISTS "Authenticated users can view activity logs" ON public.machine_activity_log;
DROP POLICY IF EXISTS "Authenticated users can view machine activity" ON public.machine_activity_log;
CREATE POLICY "Staff can view machine activity" ON public.machine_activity_log
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'tech_support_lead')
    OR has_role(auth.uid(),'global_operations_manager') OR has_role(auth.uid(),'regional_manager')
    OR has_role(auth.uid(),'finance_accounting') OR has_role(auth.uid(),'employee_operator')
  );

-- =========================================
-- 7. event_machine_assignments / stand_machine_assignments - restrict SELECT
-- =========================================
DROP POLICY IF EXISTS "Authenticated users can view event machine assignments" ON public.event_machine_assignments;
CREATE POLICY "Staff can view event machine assignments" ON public.event_machine_assignments
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'event_manager')
    OR has_role(auth.uid(),'global_operations_manager') OR has_role(auth.uid(),'regional_manager')
    OR has_role(auth.uid(),'tech_support_lead') OR has_role(auth.uid(),'employee_operator')
  );

DROP POLICY IF EXISTS "Authenticated users can view stand machine assignments" ON public.stand_machine_assignments;
CREATE POLICY "Staff can view stand machine assignments" ON public.stand_machine_assignments
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'super_admin')
    OR has_role(auth.uid(),'global_operations_manager') OR has_role(auth.uid(),'regional_manager')
    OR has_role(auth.uid(),'tech_support_lead') OR has_role(auth.uid(),'employee_operator')
  );

-- =========================================
-- 8. prize_wins - remove public verified read
-- =========================================
DROP POLICY IF EXISTS "Anyone can view verified prize wins" ON public.prize_wins;

-- =========================================
-- 9. gift_cards - remove all-authenticated read
-- =========================================
DROP POLICY IF EXISTS "Users can read gift cards for redemption" ON public.gift_cards;

-- =========================================
-- 10. ecosnack_locker_purchases - close public read/update
-- =========================================
DROP POLICY IF EXISTS "Allow public lookup by machine_code and locker_code" ON public.ecosnack_locker_purchases;
DROP POLICY IF EXISTS "Allow update for service" ON public.ecosnack_locker_purchases;

-- machine_inventory - hide public ecosnack read (locker codes)
DROP POLICY IF EXISTS "Public can view ecosnack machine inventory" ON public.machine_inventory;

-- =========================================
-- 11. Storage: remove broad SELECT policies on public buckets (direct URLs still work via CDN)
-- =========================================
DROP POLICY IF EXISTS "Anyone can view artist audio" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view media covers" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view product images" ON storage.objects;
DROP POLICY IF EXISTS "Artist images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Beat previews are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Game images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Media shop images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public can view stand images" ON storage.objects;
DROP POLICY IF EXISTS "Business card photos are publicly readable" ON storage.objects;

-- =========================================
-- 12. Revoke EXECUTE on admin/trigger SECURITY DEFINER functions
-- =========================================
DO $$
DECLARE r record;
  admin_only text[] := ARRAY[
    'create_vendx_merchant','create_vendx_catalog_partner','create_vendx_sso_app',
    'rotate_vendx_merchant_api_key','rotate_vendx_merchant_webhook_secret',
    'rotate_vendx_catalog_partner_api_key','rotate_vendx_sso_app_secret',
    'rotate_external_stream_api_key','generate_external_stream_api_key',
    'merge_finance_income','merge_finance_expense','import_machine_revenue_to_income',
    'cleanup_external_income_expense','generate_totp_secret'
  ];
  -- Trigger functions - revoke from PUBLIC/anon/authenticated (they run in trigger ctx)
  trigger_fns text[] := ARRAY[
    'apply_finance_txn_to_account','assign_default_role','auto_route_ticket_to_office',
    'auto_schedule_stop_from_ticket','cascade_inventory_to_route_stops','cascade_machine_code_update',
    'generate_ar_invoice_number','generate_custom_arcade_request_number','generate_external_invoice_number',
    'generate_external_ticket_number','generate_franchise_order_number','generate_franchise_ticket_number',
    'generate_order_number','handle_new_user','handle_new_user_vendx_pay','init_quest_player_progress',
    'log_store_order_status_change','log_store_product_stock_change','post_ar_invoice_payment_to_income',
    'post_external_income_to_account','post_income_to_account','prevent_duplicate_manual_expense',
    'prevent_duplicate_manual_income','recalc_ar_invoice_totals','recalc_external_invoice_totals',
    'refresh_route_stop_inventory_priority','reverse_external_income_account_post',
    'set_external_invoice_item_line_total','sync_custom_arcade_income','sync_ext_service_invoice_to_income',
    'sync_external_income_expense','sync_news_article_status','tg_vendx_partner_subscriptions_touch',
    'touch_news_article_comments','update_ap_bill_on_payment','update_ar_invoice_on_payment',
    'update_revenue_collections_updated_at','update_updated_at_column'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef
      AND (p.proname = ANY(admin_only) OR p.proname = ANY(trigger_fns))
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;

  -- Revoke from anon on remaining SECURITY DEFINER functions except explicitly public ones
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef
      AND p.proname NOT IN (
        'get_business_card','list_business_cards','get_public_machine_info',
        'ingest_external_income','calculate_quest_level','hash_api_key',
        'merchant_pay_with_wallet','can_moderate_news','is_ext_service_staff','is_super_admin','has_role'
      )
  LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;
