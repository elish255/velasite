# 1Vela Activation Payment Setup

## 1. Supabase Database

The project now contains `drizzle/migrations/0001_activation_payments.sql`.
Run the complete SQL file once in **Supabase Dashboard → SQL Editor → New query → Run**.

It creates:

- `payment_requests` — stores the user's phone, amount, status and approval time.
- `admin_users` — controls who can access `/admin`.
- RLS policies so users can only submit/view their own payment requests while admins can view all requests.
- `review_activation_payment(...)` — securely approves/rejects a payment and activates the user's profile when approved.
- One pending payment request per user.

## 2. Create the first admin

First create/login to the admin account in Supabase Auth. Then run this SQL, replacing the email:

```sql
insert into public.admin_users (user_id)
select id
from auth.users
where email = 'YOUR_ADMIN_EMAIL@example.com'
on conflict (user_id) do nothing;
```

After that, log in with that account and open `/admin`.

## 3. Vercel environment variables

Set these in **Vercel → Project → Settings → Environment Variables**:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Do **not** put a Supabase service-role/secret key in any `VITE_*` variable or browser code.
This payment workflow does not need the service-role key.

## 4. User flow

1. User opens a foreigner's chat.
2. User sends a message.
3. If the account is not activated, the paywall asks the user to register/activate.
4. From **Akaunti yangu**, **Lipia Activation fee — 15,000 TZS** opens `/payment`.
5. User follows the USSD instructions using LIPA NAMBA `251161660` and amount `15,000 TZS`.
6. User enters the phone number used for the payment and presses **Nimelipia**.
7. The app saves the request as `pending` and shows **Waiting for your Payment Approval**.
8. Admin opens `/admin`, verifies the payment, then clicks **Approve & Activate**.
9. The database marks the payment approved and sets `profiles.activated = true`.
10. The user can then send messages in chat without the activation paywall.

## 5. Important

This implementation controls activation/access and records payment claims. It does **not** automatically verify mobile-money transactions against a telecom/payment API. Admin should verify the payment in the actual mobile-money account before approving.
