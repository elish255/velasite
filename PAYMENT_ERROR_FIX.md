# Payment 400/404 Fix

The previous build mixed two database schemas:

- the working automatic project uses `profiles.is_active`, `profiles.is_banned`, and `automatic_payments`;
- the 1Vela payment/admin UI uses `profiles.activated`, `profiles.banned`, and `payment_requests`.

This build contains `drizzle/migrations/0009_magic_schema_compatibility.sql` which makes both schemas coexist and synchronizes activation/ban fields.

Run that SQL once in Supabase SQL Editor before deploying this build.

Vercel variables required for the server-side automatic payment:

- `FIMIPAY_API_KEY`
- `FIMIPAY_AMOUNT` (optional; defaults to the app activation fee)
- `FIMIPAY_CURRENCY` (optional; defaults to TZS)
- `FIMIPAY_CREATE_PAYMENT_URL` (optional)
- `FIMIPAY_ORDER_STATUS_URL` (optional)
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`

Do not expose the payment API key in a `VITE_` variable.
