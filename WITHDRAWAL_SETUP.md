# 1Vela Withdrawal Setup

Run `SUPABASE_WITHDRAWAL_SETUP.sql` once in Supabase SQL Editor.

## Rules
- First withdrawal: account balance must be at least TZS 50,000 and requested amount must be **greater than TZS 50,000**.
- Second and later withdrawals: account balance must be at least TZS 100,000 and requested amount must be **greater than TZS 100,000**.
- The database function checks the balance and creates the request atomically, then reserves/deducts the requested amount from the user's balance.
- If an admin rejects a pending withdrawal, the amount is returned to the user's balance.
- Admins can mark a request as Paid from `/admin`.
- Users can see all their requests in `/withdrawal`.

## Important
The withdrawal request is a tracking/processing system. It does not connect to a mobile-money provider or automatically send money. An admin must process the request through the configured payout process.
