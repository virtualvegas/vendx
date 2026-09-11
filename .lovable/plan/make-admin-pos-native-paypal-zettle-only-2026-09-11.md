# Make Admin POS Native PayPal Zettle Only

## Changes
- Remove every Loyverse API endpoint, secret fallback, webhook header, sync cursor, and runtime source filter from the active POS functions and admin panels.
- Use only native PayPal Zettle credentials and APIs for register discovery, receipt syncing, and webhook processing.
- Keep old database references readable only where necessary to prevent duplicate historical finance entries; they will never trigger Loyverse network calls.
- Make the admin register importer clearly report when native Zettle credentials are not configured instead of silently using another provider.
- Deploy the updated POS functions and verify the admin POS screen and financial posting behavior.

## Technical details
- Update `pos-registers-list`, `zettle-sync`, `zettle-webhook`, and `zettle-daily-finance-sync`.
- Update POS overview and finance queries to use `paypal_zettle` and `zettle_*` runtime records only.
- Native credentials remain securely stored outside the app code.
