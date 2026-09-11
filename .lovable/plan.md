# Consolidate POS and remove duplicate sales

## What will change
- Add one **POS** entry in the admin sidebar, with inner views for Overview, Receipts, Stores, and Finance Setup.
- Move POS receipts and store mapping out of Rewards Manager; keep rewards focused on points and redemptions.
- Present the system as **PayPal Zettle POS**, while clearly noting Loyverse is only the connected operational feed.
- Add useful POS totals, payment-method breakdowns, store performance, date/search filters, and clearer sync status.
- Make financial reporting count each POS sale once. PayPal Zettle receipts will be the canonical POS sales source; generated Loyverse finance ledger summaries will not be added again in overview totals.
- Harden the two required access policies: users can only create their own locker purchase records, and prize stock is staff/location-restricted.

## Technical details
- Reuse `vendx_pos_receipts`, `vendx_pos_stores`, and existing sync functions; no parallel second provider import will be introduced.
- Add a consolidated `POSManager` screen and register it in dashboard navigation/access control.
- Update dashboard and finance aggregation rules using stable receipt/reference identifiers for deduplication.
- Apply database policy changes through a migration, then verify the admin screen, totals, and current security findings.
