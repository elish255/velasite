-- Run once in Supabase SQL Editor.
-- This creates the same automatic-payment storage used by the working Push reference,
-- while keeping the existing Lipa Namba/payment_requests flow untouched.

create table if not exists public.automatic_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_id text unique,
  amount numeric(12,2) not null default 12000,
  currency text not null default 'TZS',
  phone text not null,
  status text not null default 'pending' check (status in ('pending','processing','paid','failed','cancelled','expired')),
  checkout_url text,
  provider_status text,
  provider_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists automatic_payments_user_id_idx on public.automatic_payments(user_id);
create index if not exists automatic_payments_status_idx on public.automatic_payments(status);

alter table public.automatic_payments enable row level security;
drop policy if exists "auto_payments_select_own" on public.automatic_payments;
create policy "auto_payments_select_own"
on public.automatic_payments for select to authenticated
using (user_id = auth.uid());

grant select on public.automatic_payments to authenticated;
grant all on public.automatic_payments to service_role;

-- Keep the existing Lipa Namba table available even when its migration was not run.
create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  phone text not null,
  amount numeric(12,2) not null default 12000,
  status text not null default 'pending',
  provider text not null default 'manual',
  provider_reference text,
  provider_status text,
  provider_checkout_url text,
  provider_payload jsonb,
  paid_at timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  created_at timestamptz not null default now()
);

alter table public.payment_requests add column if not exists provider text not null default 'manual';
alter table public.payment_requests add column if not exists provider_reference text;
alter table public.payment_requests add column if not exists provider_status text;
alter table public.payment_requests add column if not exists provider_checkout_url text;
alter table public.payment_requests add column if not exists provider_payload jsonb;
alter table public.payment_requests add column if not exists paid_at timestamptz;
alter table public.payment_requests add column if not exists approved_at timestamptz;
alter table public.payment_requests add column if not exists approved_by uuid;

alter table public.payment_requests enable row level security;
drop policy if exists "Users can view own payment requests" on public.payment_requests;
create policy "Users can view own payment requests" on public.payment_requests for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own payment requests" on public.payment_requests;
create policy "Users can insert own payment requests" on public.payment_requests for insert to authenticated with check (auth.uid() = user_id);
grant select, insert on public.payment_requests to authenticated;
grant all on public.payment_requests to service_role;

-- Make sure the 1Vela activation flag is present. Do not alter the Lipa Namba approval logic.
alter table public.profiles add column if not exists activated boolean not null default false;
