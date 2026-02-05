-- Drop old transaction policies
DROP POLICY IF EXISTS "Users can view own transactions" ON wallet_transactions;

-- Create policy that allows viewing transactions for own wallet AND child wallets
CREATE POLICY "Users can view own and child transactions"
ON wallet_transactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM wallets w
    WHERE w.id = wallet_transactions.wallet_id
    AND (
      w.user_id = auth.uid()
      OR w.parent_wallet_id IN (
        SELECT id FROM wallets WHERE user_id = auth.uid() AND wallet_type = 'standard'
      )
    )
  )
);

-- Allow inserting transactions for own wallets and child wallets
CREATE POLICY "Users can insert transactions for own wallets"
ON wallet_transactions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM wallets w
    WHERE w.id = wallet_transactions.wallet_id
    AND (
      w.user_id = auth.uid()
      OR w.parent_wallet_id IN (
        SELECT id FROM wallets WHERE user_id = auth.uid() AND wallet_type = 'standard'
      )
    )
  )
);