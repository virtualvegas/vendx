-- Allow multiple wallets per user (parent + many children)

-- 1) Drop the old uniqueness constraint that prevents child wallets
ALTER TABLE public.wallets
  DROP CONSTRAINT IF EXISTS wallets_user_id_key;

-- 2) Enforce exactly one *parent* wallet per user (standard/guest, no parent_wallet_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'wallets_one_parent_per_user'
  ) THEN
    CREATE UNIQUE INDEX wallets_one_parent_per_user
      ON public.wallets (user_id)
      WHERE parent_wallet_id IS NULL
        AND wallet_type IN ('standard', 'guest');
  END IF;
END $$;

-- 3) Helpful index for child wallet lookups
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'wallets_parent_wallet_id_idx'
  ) THEN
    CREATE INDEX wallets_parent_wallet_id_idx
      ON public.wallets (parent_wallet_id);
  END IF;
END $$;