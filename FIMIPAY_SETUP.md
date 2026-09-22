# 1Vela — Automatic Payment Push Setup

The automatic payment provider is server-side only. Users see **Malipo Automatic / Payment Push** and **LIPA NAMBA**; the provider name is not shown in the user dashboard or payment page.

## Vercel Environment Variables

Set these in Vercel Project Settings → Environment Variables. Keep the API secret server-side; never use a `VITE_` variable for it.

Required:

- `FIMIPAY_API_KEY` — your live API key
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_PUBLISHABLE_KEY` — Supabase publishable key
- `SUPABASE_SECRET_KEY` — Supabase service-role/secret key

`SUPABASE_SERVICE_ROLE_KEY` can be used instead of `SUPABASE_SECRET_KEY`.

Recommended / optional:

- `FIMIPAY_API_BASE_URL` — defaults to `https://fimipay.com/api/v1`
- `FIMIPAY_CREATE_PAYMENT_URL` — direct create-payment endpoint, if supplied by your merchant docs
- `FIMIPAY_ORDER_STATUS_URL` — direct order-status endpoint, if supplied by your merchant docs
- `FIMIPAY_CURRENCY` — defaults to `TZS`
- `FIMIPAY_CREATE_PAYMENT_PATH` — defaults to `/payment/create_order`
- `FIMIPAY_ORDER_STATUS_PATH` — defaults to `/payment/order_status`
- `FIMIPAY_CREATE_PAYMENT_EXTRA_JSON` — optional JSON for extra provider fields
- `FIMIPAY_WEBHOOK_SECRET` — optional webhook signing secret if enabled on your account
- `FIMIPAY_WEBHOOK_SIGNATURE_HEADER` — defaults to `x-fimipay-signature`

Do **not** use `VITE_FIMIPAY_API_KEY`.

After changing Vercel environment variables, redeploy.

## Payment flow

1. User registers and opens `/payment`.
2. **Malipo Automatic** creates an automatic mobile-money push request.
3. The request is stored in `payment_requests` with `provider = automatic`.
4. The browser polls the order status while the server also accepts the webhook.
5. When the provider confirms a successful payment, the server calls `activate_automatic_payment` and sets `profiles.activated = true` automatically.
6. User is redirected to the 1Vela dashboard without admin approval.
7. **LIPA NAMBA** remains unchanged: it creates a `manual` request and stays pending until an admin verifies and approves it.

## Vercel API endpoints

- `POST /api/fimipay` — create/status/manual payment actions
- `POST /api/fimipay/webhook` — provider callback
- `POST /api/fimipay/withdrawal` — admin-approved automatic payout

The provider secret never goes to the browser.
