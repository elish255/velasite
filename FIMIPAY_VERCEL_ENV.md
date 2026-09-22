# Vercel environment variables for Automatic Push

Set these on Vercel for Production (and Preview if you test Preview):

FIMIPAY_API_KEY=YOUR_LIVE_SECRET_KEY
FIMIPAY_AMOUNT=12000
FIMIPAY_CURRENCY=TZS

SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY=YOUR_SUPABASE_SECRET_KEY

Optional (only change if FimiPay gave you different endpoints):
FIMIPAY_CREATE_PAYMENT_URL=https://fimipay.com/api/v1/payment/create_order
FIMIPAY_ORDER_STATUS_URL=https://fimipay.com/api/v1/payment/order_status

Important:
- Do NOT put FIMIPAY_API_KEY in any VITE_ variable.
- SUPABASE_SECRET_KEY can be replaced by SUPABASE_SERVICE_ROLE_KEY if that is what your project uses.
- Redeploy after changing environment variables.
