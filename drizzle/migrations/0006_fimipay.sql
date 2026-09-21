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
