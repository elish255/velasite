-- 1Vela: Admin withdrawal approval without FimiPay.
-- Run this ONCE in Supabase SQL Editor.
-- Admin approval marks the withdrawal as paid and sends the exact user notification.

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
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_status NOT IN ('paid', 'rejected') THEN
    RAISE EXCEPTION 'Invalid review status';
  END IF;

  UPDATE public.withdrawal_requests
  SET status = p_status,
      processed_at = now(),
      processed_by = (select auth.uid())
  WHERE id = p_request_id
    AND status IN ('pending', 'processing')
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Withdrawal request not found or already reviewed';
  END IF;

  IF p_status = 'rejected' THEN
    UPDATE public.profiles
    SET balance = balance + v_row.amount
    WHERE id = v_row.user_id;

    INSERT INTO public.balance_transactions(
      user_id, amount, kind, description, reference_id
    )
    VALUES (
      v_row.user_id,
      v_row.amount,
      'refund',
      'Withdrawal rejected - balance returned',
      v_row.id
    );

    INSERT INTO public.notifications(user_id, title, message)
    VALUES (
      v_row.user_id,
      'Withdrawal rejected',
      'Withdrawal yako imekataliwa na TZS ' ||
      to_char(v_row.amount, 'FM999,999,999,990.00') ||
      ' imerudishwa kwenye balance.'
    );
  ELSE
    INSERT INTO public.notifications(user_id, title, message)
    VALUES (
      v_row.user_id,
      'Withdrawal Approved',
      'Your Withdrawal has been Approved'
    );
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_withdrawal(uuid, text) TO authenticated;
