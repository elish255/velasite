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
