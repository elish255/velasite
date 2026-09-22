# 1Vela Automatic Push setup

The automatic payment implementation follows the working Push integration used in the supplied reference project:

- Create: `POST https://fimipay.com/api/v1/payment/create_order`
- Status: `POST https://fimipay.com/api/v1/payment/order_status`
- Authorization: `Bearer <FIMIPAY_API_KEY>`
- Phone is normalized to Tanzania international format (`2557...`) before sending.
- Only provider `SUCCESS` activates the user.
- Failed/cancelled requests become rejected and can be retried.

## Vercel Environment Variables

Required:

```text
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
FIMIPAY_API_KEY=...
```

Optional:

```text
FIMIPAY_AMOUNT=12000
FIMIPAY_CURRENCY=TZS
FIMIPAY_CREATE_PAYMENT_URL=https://fimipay.com/api/v1/payment/create_order
FIMIPAY_ORDER_STATUS_URL=https://fimipay.com/api/v1/payment/order_status
```

Do not use `VITE_FIMIPAY_API_KEY`. The API key must remain server-side.

## Supabase

Run `drizzle/migrations/0008_working_push_payment.sql` after the existing migrations.
