-- 1Vela payment flow hardening.
-- Automatic payments are confirmed server-side and then activate the account.
-- LIPA NAMBA remains manual/admin-approved.

ALTER TABLE public.payment_requests
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS provider_reference text,
  ADD COLUMN IF NOT EXISTS provider_status text,
  ADD COLUMN IF NOT EXISTS provider_checkout_url text,
  ADD COLUMN IF NOT EXISTS provider_payload jsonb,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE INDEX IF NOT EXISTS payment_requests_provider_reference_idx
  ON public.payment_requests(provider_reference);

CREATE INDEX IF NOT EXISTS payment_requests_provider_status_idx
  ON public.payment_requests(provider, provider_status, created_at DESC);

CREATE OR REPLACE FUNCTION public.activate_automatic_payment(p_request_id uuid)
RETURNS public.payment_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_payment public.payment_requests;
BEGIN
  SELECT * INTO v_payment
  FROM public.payment_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_payment.id IS NULL THEN
    RAISE EXCEPTION 'Payment request not found';
  END IF;

  IF v_payment.provider <> 'automatic' THEN
    RAISE EXCEPTION 'Only automatic payments can auto-activate';
  END IF;

  IF v_payment.status = 'approved' THEN
    RETURN v_payment;
  END IF;

  IF lower(coalesce(v_payment.provider_status, '')) NOT IN ('success','successful','paid','completed','complete','approved','successed') THEN
    RAISE EXCEPTION 'Automatic payment is not confirmed';
  END IF;

  UPDATE public.payment_requests
  SET status = 'approved',
      approved_at = coalesce(approved_at, now()),
      approved_by = NULL,
      paid_at = coalesce(paid_at, now())
  WHERE id = v_payment.id
  RETURNING * INTO v_payment;

  UPDATE public.profiles
  SET activated = true
  WHERE id = v_payment.user_id;

  INSERT INTO public.notifications(user_id, title, message)
  VALUES (
    v_payment.user_id,
    'Account activated',
    'Malipo yako yamepokelewa na account yako imewashwa moja kwa moja. Karibu 1Vela.'
  );

  RETURN v_payment;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_automatic_payment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_automatic_payment(uuid) TO service_role;
