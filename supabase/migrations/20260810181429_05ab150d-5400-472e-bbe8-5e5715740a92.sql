-- Helper: is the current request an end user (not service role / not staff)?
CREATE OR REPLACE FUNCTION public.is_privileged_actor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NULL
      OR public.has_role(auth.uid(), 'super_admin')
      OR public.has_role(auth.uid(), 'finance_accounting')
      OR public.has_role(auth.uid(), 'global_operations_manager');
$$;

REVOKE EXECUTE ON FUNCTION public.is_privileged_actor() FROM anon;

-- 1) store_subscriptions: protect billing state
CREATE OR REPLACE FUNCTION public.guard_store_subscription_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_privileged_actor() THEN
    RETURN NEW;
  END IF;
  NEW.status := OLD.status;
  NEW.cancel_at_period_end := OLD.cancel_at_period_end;
  NEW.comp_credits_remaining := OLD.comp_credits_remaining;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_store_subscription_update ON public.store_subscriptions;
CREATE TRIGGER trg_guard_store_subscription_update
BEFORE UPDATE ON public.store_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.guard_store_subscription_update();

-- 2) vendx_franchises: protect approval / fees / commission
CREATE OR REPLACE FUNCTION public.guard_franchise_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_privileged_actor() THEN
    RETURN NEW;
  END IF;
  NEW.status := OLD.status;
  NEW.setup_fee_paid := OLD.setup_fee_paid;
  NEW.commission_pct := OLD.commission_pct;
  NEW.user_id := OLD.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_franchise_update ON public.vendx_franchises;
CREATE TRIGGER trg_guard_franchise_update
BEFORE UPDATE ON public.vendx_franchises
FOR EACH ROW EXECUTE FUNCTION public.guard_franchise_update();

-- 3) wallets: protect balance and limits
CREATE OR REPLACE FUNCTION public.guard_wallet_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_privileged_actor() THEN
    RETURN NEW;
  END IF;
  NEW.balance := OLD.balance;
  NEW.daily_limit := OLD.daily_limit;
  NEW.spending_limit_per_transaction := OLD.spending_limit_per_transaction;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_wallet_update ON public.wallets;
CREATE TRIGGER trg_guard_wallet_update
BEFORE UPDATE ON public.wallets
FOR EACH ROW EXECUTE FUNCTION public.guard_wallet_update();