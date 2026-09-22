# 1Vela Dual Activation Payment

## User flow

1. Register -> `/payment`.
2. **Automatic Payment**: user enters mobile-money phone and taps **Lipa Sasa**. When the provider confirms success, the server marks the payment approved, activates `profiles.activated`, and the user is sent to `/account` without admin approval.
3. **LIPA NAMBA**: user pays **TZS 12,000** to **251161660**, enters the phone number used for payment, then taps **NIMELIPIA**. The request appears in Admin > Deposits / Activation Payments with provider `manual` and status `user_claimed`. Admin verifies the transaction and clicks **Approve & Activate**.

## Vercel environment variables

Keep secrets server-side. Do not use `VITE_` for secret keys. Configure the payment credentials already documented in `FIMIPAY_SETUP.md`.

## Important

The app now has `api/fimipay.ts` as a Vercel-compatible API entry point, and `src/server.ts` also handles `/api/fimipay` so the endpoint remains available in the TanStack Start server.
