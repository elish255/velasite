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
