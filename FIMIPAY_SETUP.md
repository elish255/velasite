# 1Vela — Automatic Payment Setup

The payment provider is used only on the server. The customer-facing pages do not display the provider name.

## API routes used by the app

- `POST /api/fimipay/payment` — creates the activation payment request.
- `GET /api/fimipay/payment-status?requestId=...` — checks the order status.
- `POST /api/fimipay/webhook` — receives provider callbacks.
- `POST /api/fimipay/withdrawal` — admin-only payout request.

The browser never receives the provider API key.

## Vercel Environment Variables

Required:

- `FIMIPAY_API_KEY` — live provider secret key
- `FIMIPAY_API_BASE_URL` — provider API base URL
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_PUBLISHABLE_KEY` — Supabase publishable key
- `SUPABASE_SECRET_KEY` — Supabase server secret key

`SUPABASE_SERVICE_ROLE_KEY` can be used instead of `SUPABASE_SECRET_KEY` if that is what your Supabase setup provides.

Recommended:

- `FIMIPAY_CREATE_PAYMENT_PATH`
- `FIMIPAY_ORDER_STATUS_PATH`
- `FIMIPAY_CURRENCY=TZS`
- `ACTIVATION_FEE=12000`

Optional provider-specific settings are supported by `src/lib/fimipay.server.ts`.

Do **not** use `VITE_FIMIPAY_API_KEY`. Secrets must stay server-side.

After changing Vercel Environment Variables, redeploy the project.

## 1Vela amount

The 1Vela activation payment is **TZS 12,000**.

## Flow

1. Logged-in user opens `/payment`.
2. User enters a mobile-money phone number.
3. The server creates an automatic payment request.
4. The request is stored in `payment_requests`.
5. The page polls the order status while it is pending.
6. When payment is confirmed, the request is marked as paid/provider-confirmed.
7. The existing 1Vela admin approval flow remains responsible for activating the account.
