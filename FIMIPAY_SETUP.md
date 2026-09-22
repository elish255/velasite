# 1Vela — Automatic Mobile Payment Setup

The payment provider is used only on the server. Customers see **Malipo Automatic**, not the provider name.

## Vercel Environment Variables

Required:

- `FIMIPAY_API_KEY` = your live secret API key
- `SUPABASE_URL` = your Supabase project URL
- `SUPABASE_PUBLISHABLE_KEY` = your Supabase publishable key
- `SUPABASE_SECRET_KEY` = your Supabase service-role/secret key

`SUPABASE_SERVICE_ROLE_KEY` can be used instead of `SUPABASE_SECRET_KEY`.

Recommended:

- `FIMIPAY_API_BASE_URL` = `https://fimipay.com/api/v1`
- `FIMIPAY_CREATE_PAYMENT_PATH` = `/payment/create_order`
- `FIMIPAY_ORDER_STATUS_PATH` = `/payment/order_status`
- `FIMIPAY_CURRENCY` = `TZS`
- `ACTIVATION_FEE` = `12000`

Optional direct URLs:

- `FIMIPAY_CREATE_PAYMENT_URL`
- `FIMIPAY_ORDER_STATUS_URL`

Do **not** use `VITE_FIMIPAY_API_KEY` or expose the secret API key in frontend code.

## Phone number handling

The customer can enter a normal Tanzanian number such as `0712 345 678`, `+255712345678`, or `255712345678`.

The server normalizes it to the international `2557XXXXXXXX` format before sending the automatic payment request. This prevents a valid local number from being rejected by the payment API.

## Automatic flow

1. User registers.
2. If registration creates a session, the user is sent directly to `/payment`.
3. If email confirmation is enabled, the user logs in; an unactivated user is sent to `/payment` instead of the dashboard.
4. User selects **Malipo Automatic**, enters the mobile-money number and taps **Lipa Sasa**.
5. Server creates the payment order using the normalized Tanzanian number.
6. The page checks the order status every 5 seconds.
7. When a successful status is confirmed, the server calls `activate_automatic_payment`.
8. `profiles.activated` becomes `true`, the payment request becomes `approved`, and the user is redirected to the dashboard.

## Failed automatic payment

A failed/declined/expired request is marked rejected so the customer can press **Jaribu Tena** and create a fresh request. The customer is not told to wait for an unsuccessful request.

## LIPA NAMBA

The manual **LIPA NAMBA** flow remains separate. It does not call the automatic API. The customer pays using the existing number/instructions, enters the phone number used for payment, presses **NIMELIPIA**, and the request remains pending until an admin approves it.

## Database

Run:

`SUPABASE_PAYMENT_FLOW_FIX.sql`

This creates/updates the trusted automatic activation function used after successful payment confirmation.

After changing Vercel environment variables, redeploy the project.
