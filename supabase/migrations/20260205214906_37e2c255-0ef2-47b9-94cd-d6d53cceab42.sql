-- Drop the recursive wallet_transactions policies
DROP POLICY IF EXISTS "Users can view own and child transactions" ON wallet_transactions;
DROP POLICY IF EXISTS "Users can insert transactions for own wallets" ON wallet_transactions;

-- Create non-recursive policies
-- Since child wallets have the same user_id as parent, we can use a simple join

CREATE POLICY "Users can view own wallet transactions"
ON wallet_transactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM wallets w
    WHERE w.id = wallet_transactions.wallet_id
    AND w.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert own wallet transactions"
ON wallet_transactions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM wallets w
    WHERE w.id = wallet_transactions.wallet_id
    AND w.user_id = auth.uid()
  )
);