-- 1Vela admin controls, notifications, balance ledger and account bans.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ban_reason text;

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT TO authenticated
USING (user_id = auth.uid() OR user_id IS NULL OR private.is_admin());

DROP POLICY IF EXISTS "Users can mark own notifications read" ON public.notifications;
CREATE POLICY "Users can mark own notifications read"
ON public.notifications FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

CREATE TABLE IF NOT EXISTS public.balance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  kind text NOT NULL CHECK (kind IN ('chat_reward','admin_credit','admin_debit','withdrawal','withdrawal_fee','deposit','refund')),
  description text NOT NULL DEFAULT '',
  reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS balance_transactions_user_created_idx
  ON public.balance_transactions (user_id, created_at DESC);

ALTER TABLE public.balance_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own balance transactions" ON public.balance_transactions;
CREATE POLICY "Users can view own balance transactions"
ON public.balance_transactions FOR SELECT TO authenticated
USING (user_id = auth.uid() OR private.is_admin());
GRANT SELECT ON public.balance_transactions TO authenticated;
GRANT ALL ON public.balance_transactions TO service_role;

CREATE OR REPLACE FUNCTION public.admin_adjust_balance(
  p_user_id uuid,
  p_amount numeric,
  p_reason text
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_balance numeric;
  v_kind text;
BEGIN
  IF NOT private.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_amount IS NULL OR p_amount = 0 THEN RAISE EXCEPTION 'Amount cannot be zero'; END IF;
  IF length(trim(COALESCE(p_reason, ''))) < 2 THEN RAISE EXCEPTION 'Reason is required'; END IF;

  SELECT balance INTO v_balance FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;
  IF v_balance + p_amount < 0 THEN RAISE EXCEPTION 'Balance cannot go below zero'; END IF;

  UPDATE public.profiles
  SET balance = balance + p_amount
  WHERE id = p_user_id
  RETURNING balance INTO v_balance;

  v_kind := CASE WHEN p_amount > 0 THEN 'admin_credit' ELSE 'admin_debit' END;
  INSERT INTO public.balance_transactions(user_id, amount, kind, description)
  VALUES (p_user_id, p_amount, v_kind, trim(p_reason));

  INSERT INTO public.notifications(user_id, title, message)
  VALUES (
    p_user_id,
    CASE WHEN p_amount > 0 THEN 'Balance imeongezwa' ELSE 'Balance imepunguzwa' END,
    trim(p_reason) || ' — TZS ' || to_char(abs(p_amount), 'FM999,999,999,990.00')
  );

  RETURN v_balance;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_adjust_balance(uuid, numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_user_ban(
  p_user_id uuid,
  p_banned boolean,
  p_reason text DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile public.profiles;
BEGIN
  IF NOT private.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.profiles
  SET banned = p_banned,
      ban_reason = CASE WHEN p_banned THEN NULLIF(trim(COALESCE(p_reason, '')), '') ELSE NULL END,
      activated = CASE WHEN p_banned THEN false ELSE activated END
  WHERE id = p_user_id
  RETURNING * INTO v_profile;
  IF v_profile.id IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;

  INSERT INTO public.notifications(user_id, title, message)
  VALUES (
    p_user_id,
    CASE WHEN p_banned THEN 'Account imezuiwa' ELSE 'Account imefunguliwa' END,
    CASE WHEN p_banned THEN COALESCE(NULLIF(trim(p_reason), ''), 'Akaunti yako imezuiwa na admin.') ELSE 'Akaunti yako imefunguliwa tena.' END
  );

  RETURN v_profile;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_user_ban(uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_user_activation(
  p_user_id uuid,
  p_activated boolean
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile public.profiles;
BEGIN
  IF NOT private.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.profiles
  SET activated = p_activated
  WHERE id = p_user_id
  RETURNING * INTO v_profile;
  IF v_profile.id IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;
  INSERT INTO public.notifications(user_id, title, message)
  VALUES (
    p_user_id,
    CASE WHEN p_activated THEN 'Account activated' ELSE 'Account deactivated' END,
    CASE WHEN p_activated THEN 'Account yako imewashwa na unaweza kutumia huduma za 1Vela.' ELSE 'Account yako imezimwa kwa muda.' END
  );
  RETURN v_profile;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_user_activation(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_send_notification(
  p_user_id uuid,
  p_title text,
  p_message text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT private.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF length(trim(COALESCE(p_title, ''))) < 1 OR length(trim(COALESCE(p_message, ''))) < 1 THEN
    RAISE EXCEPTION 'Title and message are required';
  END IF;
  INSERT INTO public.notifications(user_id, title, message)
  VALUES (p_user_id, trim(p_title), trim(p_message))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_send_notification(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.notifications
  SET read_at = now()
  WHERE id = p_notification_id AND user_id = (select auth.uid());
$$;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO authenticated;
-- FimiPay automatic/push payment metadata and payout metadata.

ALTER TABLE public.payment_requests
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS provider_reference text,
  ADD COLUMN IF NOT EXISTS provider_status text,
  ADD COLUMN IF NOT EXISTS provider_checkout_url text,
  ADD COLUMN IF NOT EXISTS provider_payload jsonb,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

ALTER TABLE public.payment_requests
  DROP CONSTRAINT IF EXISTS payment_requests_amount_check;
ALTER TABLE public.payment_requests
  ADD CONSTRAINT payment_requests_amount_check CHECK (amount = 12000);

CREATE INDEX IF NOT EXISTS payment_requests_provider_reference_idx
  ON public.payment_requests(provider_reference);

ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS fee numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payout_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS provider_reference text,
  ADD COLUMN IF NOT EXISTS provider_status text,
  ADD COLUMN IF NOT EXISTS provider_payload jsonb;

ALTER TABLE public.withdrawal_requests
  DROP CONSTRAINT IF EXISTS withdrawal_requests_status_check;
ALTER TABLE public.withdrawal_requests
  ADD CONSTRAINT withdrawal_requests_status_check CHECK (status IN ('pending','processing','paid','rejected'));

CREATE INDEX IF NOT EXISTS withdrawal_requests_provider_reference_idx
  ON public.withdrawal_requests(provider_reference);

CREATE OR REPLACE FUNCTION public.request_withdrawal(
  p_amount numeric,
  p_phone text
)
RETURNS public.withdrawal_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := (select auth.uid());
  v_balance numeric;
  v_count integer;
  v_min numeric;
  v_fee numeric;
  v_payout numeric;
  v_row public.withdrawal_requests;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'You must be logged in'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Enter a valid amount'; END IF;
  IF p_phone IS NULL OR length(trim(p_phone)) < 9 THEN RAISE EXCEPTION 'Enter a valid phone number'; END IF;

  SELECT balance INTO v_balance FROM public.profiles WHERE id = v_user FOR UPDATE;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;

  SELECT count(*)::integer INTO v_count FROM public.withdrawal_requests WHERE user_id = v_user;
  v_min := CASE WHEN v_count = 0 THEN 50000 ELSE 100000 END;
  IF v_balance < v_min THEN RAISE EXCEPTION 'Insufficient balance. Minimum available balance for this withdrawal is TZS %', v_min; END IF;
  IF p_amount <= v_min THEN RAISE EXCEPTION 'Withdrawal amount must be greater than TZS %', v_min; END IF;
  IF p_amount > v_balance THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  v_fee := round(p_amount * 0.05, 2);
  v_payout := p_amount - v_fee;

  UPDATE public.profiles SET balance = balance - p_amount WHERE id = v_user;

  INSERT INTO public.withdrawal_requests (user_id, amount, phone, fee, payout_amount, provider)
  VALUES (v_user, p_amount, trim(p_phone), v_fee, v_payout, 'fimipay')
  RETURNING * INTO v_row;

  INSERT INTO public.balance_transactions(user_id, amount, kind, description, reference_id)
  VALUES (v_user, -p_amount, 'withdrawal', 'Withdrawal request', v_row.id);
  INSERT INTO public.balance_transactions(user_id, amount, kind, description, reference_id)
  VALUES (v_user, -v_fee, 'withdrawal_fee', 'Withdrawal processing fee (included in requested amount)', v_row.id);

  INSERT INTO public.notifications(user_id, title, message)
  VALUES (v_user, 'Withdrawal imeanzishwa', 'Ombi lako la TZS ' || to_char(p_amount, 'FM999,999,999,990.00') || ' limepokelewa. Utapokea TZS ' || to_char(v_payout, 'FM999,999,999,990.00') || '.');

  RETURN v_row;
END;
$$;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_activation_payment(
  p_request_id uuid,
  p_status text
)
RETURNS public.payment_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result public.payment_requests;
BEGIN
  IF NOT private.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_status NOT IN ('approved', 'rejected') THEN RAISE EXCEPTION 'Invalid review status'; END IF;

  UPDATE public.payment_requests
  SET status = p_status,
      approved_at = CASE WHEN p_status = 'approved' THEN now() ELSE NULL END,
      approved_by = CASE WHEN p_status = 'approved' THEN (select auth.uid()) ELSE NULL END
  WHERE id = p_request_id AND status = 'pending'
  RETURNING * INTO result;
  IF result.id IS NULL THEN RAISE EXCEPTION 'Payment request not found or already reviewed'; END IF;

  IF p_status = 'approved' THEN
    UPDATE public.profiles SET activated = true WHERE id = result.user_id;
    INSERT INTO public.notifications(user_id, title, message)
    VALUES (result.user_id, 'Deposit approved', 'Malipo yako ya activation yamekubaliwa. Account yako imewashwa.');
  ELSE
    INSERT INTO public.notifications(user_id, title, message)
    VALUES (result.user_id, 'Deposit rejected', 'Malipo yako ya activation yamekataliwa. Tafadhali wasiliana na support.');
  END IF;
  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.review_activation_payment(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_withdrawal(
  p_request_id uuid,
  p_status text
)
RETURNS public.withdrawal_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.withdrawal_requests;
BEGIN
  IF NOT private.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_status NOT IN ('paid','rejected') THEN RAISE EXCEPTION 'Invalid review status'; END IF;

  UPDATE public.withdrawal_requests
  SET status = p_status,
      processed_at = now(),
      processed_by = (select auth.uid())
  WHERE id = p_request_id AND status IN ('pending','processing')
  RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Withdrawal request not found or already reviewed'; END IF;

  IF p_status = 'rejected' THEN
    UPDATE public.profiles SET balance = balance + v_row.amount WHERE id = v_row.user_id;
    INSERT INTO public.balance_transactions(user_id, amount, kind, description, reference_id)
    VALUES (v_row.user_id, v_row.amount, 'refund', 'Withdrawal rejected — balance returned', v_row.id);
    INSERT INTO public.notifications(user_id, title, message)
    VALUES (v_row.user_id, 'Withdrawal rejected', 'Withdrawal yako imekataliwa na TZS ' || to_char(v_row.amount, 'FM999,999,999,990.00') || ' imerudishwa kwenye balance.');
  ELSE
    INSERT INTO public.notifications(user_id, title, message)
    VALUES (v_row.user_id, 'Transfer Initiated', 'Payout ya TZS ' || to_char(COALESCE(v_row.payout_amount, v_row.amount), 'FM999,999,999,990.00') || ' imetumwa kwenye namba yako.');
  END IF;

  RETURN v_row;
END;
$$;
GRANT EXECUTE ON FUNCTION public.review_withdrawal(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.system_refund_withdrawal(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.withdrawal_requests;
BEGIN
  SELECT * INTO v_row FROM public.withdrawal_requests WHERE id = p_request_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;
  IF v_row.status <> 'rejected' THEN RETURN; END IF;

  IF EXISTS (
    SELECT 1 FROM public.balance_transactions
    WHERE reference_id = v_row.id AND kind = 'refund'
  ) THEN RETURN; END IF;

  UPDATE public.profiles SET balance = balance + v_row.amount WHERE id = v_row.user_id;
  INSERT INTO public.balance_transactions(user_id, amount, kind, description, reference_id)
  VALUES (v_row.user_id, v_row.amount, 'refund', 'FimiPay payout failed — balance returned', v_row.id);
  INSERT INTO public.notifications(user_id, title, message)
  VALUES (v_row.user_id, 'Withdrawal failed', 'FimiPay haikukamilisha payout. Balance yako imerudishwa.');
END;
$$;
REVOKE ALL ON FUNCTION public.system_refund_withdrawal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.system_refund_withdrawal(uuid) TO service_role;
ALTER TABLE public.payment_requests ALTER COLUMN amount SET DEFAULT 12000;
-- Keep chat rewards visible in the balance ledger and keep user-facing copy consistent.

CREATE OR REPLACE FUNCTION public.credit_chat_reward(
  p_session_id uuid,
  p_foreigner_id text,
  p_amount numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := (select auth.uid());
  v_expected numeric;
  v_existing numeric;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'You must be logged in'; END IF;
  IF p_session_id IS NULL THEN RAISE EXCEPTION 'Invalid chat session'; END IF;

  v_expected := CASE p_foreigner_id
    WHEN 'isabella' THEN 54000
    WHEN 'mateo' THEN 37000
    WHEN 'amelia' THEN 74000
    WHEN 'kenji' THEN 48000
    WHEN 'sophie' THEN 43000
    WHEN 'lucas' THEN 62000
    WHEN 'emma' THEN 31000
    WHEN 'daniel' THEN 56000
    ELSE NULL
  END;
  IF v_expected IS NULL OR p_amount <> v_expected THEN RAISE EXCEPTION 'Invalid chat reward'; END IF;

  INSERT INTO public.chat_reward_transactions (user_id, session_id, foreigner_id, amount)
  VALUES (v_user, p_session_id, p_foreigner_id, v_expected)
  ON CONFLICT (user_id, session_id) DO NOTHING;

  IF NOT FOUND THEN
    SELECT amount INTO v_existing FROM public.chat_reward_transactions WHERE user_id = v_user AND session_id = p_session_id;
    RETURN COALESCE(v_existing, 0);
  END IF;

  UPDATE public.profiles SET balance = balance + v_expected WHERE id = v_user;
  INSERT INTO public.balance_transactions(user_id, amount, kind, description, reference_id)
  VALUES (v_user, v_expected, 'chat_reward', 'Chat session reward', p_session_id);
  INSERT INTO public.notifications(user_id, title, message)
  VALUES (v_user, 'Chat reward imeongezwa', 'Umepewa TZS ' || to_char(v_expected, 'FM999,999,999,990.00') || ' kwa kukamilisha chat session.');
  RETURN v_expected;
END;
$$;
GRANT EXECUTE ON FUNCTION public.credit_chat_reward(uuid, text, numeric) TO authenticated;

-- Do not double-count the processing fee in the ledger: the requested amount is already the full balance debit.
DELETE FROM public.balance_transactions
WHERE kind = 'withdrawal_fee';
