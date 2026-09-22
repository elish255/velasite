# 1Vela

1Vela is a TanStack Start + Supabase web app for chat rewards, activation payments, withdrawals and an admin dashboard.

## This update

- Server-side automatic/push activation payment integration with automatic account activation.
- Order-status polling and signed webhook endpoint.
- Admin deposit approval/rejection.
- Admin withdrawal approval/rejection with automatic payout.
- Admin activate/deactivate users.
- Admin ban/unban users.
- Admin add/reduce user balance with a ledger.
- Admin notification to one user or all users.
- User notification bell and system broadcast card.
- User dashboard redesigned around the supplied dashboard screenshots and branded as **1Vela**.
- Withdrawal confirmation popup with **Transfer Initiated**, phone, payout amount and reference ID.
- Banned accounts are blocked at login and protected pages.

## Supabase

Apply the migrations in `drizzle/migrations/` in order. The new functionality is in:

- `0005_admin_notifications.sql`
- `0006_fimipay.sql`
- `0007_ledger_and_safety.sql`

## Vercel / FimiPay

Copy `.env.example` into your deployment configuration. Never commit `.env` or secret FimiPay/Supabase service-role keys.

See `FIMIPAY_SETUP.md` for the exact environment-variable names and webhook URL.

The provider endpoint values are configurable through Vercel environment variables. Keep all provider secrets server-side.

## Development

```sh
npm install
npm run dev
```

Production build:

```sh
npm run build
```
