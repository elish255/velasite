# 1Vela — FimiPay Automatic Push

The Vercel function is:

`api/fimipay.ts`

The browser calls:

`POST /api/fimipay`

The FimiPay secret stays server-side.

## Vercel Environment Variables

Required:

- `FIMIPAY_API_KEY` = your LIVE FimiPay secret key
- `FIMIPAY_AMOUNT` = `12000`
- `FIMIPAY_CURRENCY` = `TZS`
- `SUPABASE_URL` = your Supabase project URL
- `SUPABASE_PUBLISHABLE_KEY` = your Supabase publishable key
- `SUPABASE_SECRET_KEY` = your Supabase secret key

`SUPABASE_SERVICE_ROLE_KEY` can be used instead of `SUPABASE_SECRET_KEY`.

Optional:

- `FIMIPAY_CREATE_PAYMENT_URL`
- `FIMIPAY_ORDER_STATUS_URL`

Do NOT use `VITE_FIMIPAY_API_KEY`.

After changing Vercel Environment Variables, redeploy the project.

## 1Vela amount

The 1Vela activation payment is **TZS 12,000**. The TZS 16,000 amount is not used by this 1Vela project.

## Flow

1. Logged-in user opens `/payment`.
2. User enters mobile-money phone number.
3. `/api/fimipay` creates a FimiPay push order.
4. The request is stored in `payment_requests`.
5. The page polls FimiPay order status.
6. When FimiPay confirms payment, `provider_status` and `paid_at` are updated.
7. The account is NOT automatically activated; the existing 1Vela admin approval flow remains responsible for approving the activation payment.
