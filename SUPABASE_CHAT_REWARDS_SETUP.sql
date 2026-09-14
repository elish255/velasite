-- Secure chat rewards: credits the user's real profile balance once per chat session.
CREATE TABLE IF NOT EXISTS public.chat_reward_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  foreigner_id text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, session_id)
);

CREATE INDEX IF NOT EXISTS chat_reward_transactions_user_created_idx
  ON public.chat_reward_transactions (user_id, created_at DESC);

ALTER TABLE public.chat_reward_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own chat rewards" ON public.chat_reward_transactions;
CREATE POLICY "Users can view own chat rewards"
ON public.chat_reward_transactions FOR SELECT TO authenticated
USING (user_id = auth.uid() OR private.is_admin());

GRANT SELECT ON public.chat_reward_transactions TO authenticated;
GRANT ALL ON public.chat_reward_transactions TO service_role;

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
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'You must be logged in';
  END IF;

  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'Invalid chat session';
  END IF;

  -- Server-side reward values must match the published foreigner cards.
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

  IF v_expected IS NULL OR p_amount <> v_expected THEN
    RAISE EXCEPTION 'Invalid chat reward';
  END IF;

  INSERT INTO public.chat_reward_transactions (user_id, session_id, foreigner_id, amount)
  VALUES (v_user, p_session_id, p_foreigner_id, v_expected)
  ON CONFLICT (user_id, session_id) DO NOTHING;

  IF NOT FOUND THEN
    SELECT amount INTO v_existing
    FROM public.chat_reward_transactions
    WHERE user_id = v_user AND session_id = p_session_id;
    RETURN COALESCE(v_existing, 0);
  END IF;

  UPDATE public.profiles
  SET balance = balance + v_expected
  WHERE id = v_user;

  RETURN v_expected;
END;
$$;

REVOKE ALL ON FUNCTION public.credit_chat_reward(uuid, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_chat_reward(uuid, text, numeric) TO authenticated;
