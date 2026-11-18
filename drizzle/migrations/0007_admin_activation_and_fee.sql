-- Repair admin activation and move activation fee to TZS 15,000.

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
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.profiles
  SET activated = p_activated,
      updated_at = now()
  WHERE id = p_user_id
  RETURNING * INTO v_profile;

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

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

ALTER TABLE public.payment_requests DROP CONSTRAINT IF EXISTS payment_requests_amount_check;
UPDATE public.payment_requests SET amount = 15000 WHERE amount = 12000;
ALTER TABLE public.payment_requests ALTER COLUMN amount SET DEFAULT 15000;
ALTER TABLE public.payment_requests ADD CONSTRAINT payment_requests_amount_check CHECK (amount = 15000);
