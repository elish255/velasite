-- Compatibility layer for databases created from the working automatic-payment project.
-- Keeps the existing 1Vela application schema working while also supporting
-- the working project's is_active / is_banned profile fields.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS activated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS banned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ban_reason text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;

-- Bring the two schema variants into sync before creating the triggers.
UPDATE public.profiles
SET activated = COALESCE(is_active, activated),
    is_active = COALESCE(activated, is_active),
    banned = COALESCE(is_banned, banned),
    is_banned = COALESCE(banned, is_banned);

CREATE OR REPLACE FUNCTION public.sync_profile_activation_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.activated IS DISTINCT FROM OLD.activated THEN
    NEW.is_active := NEW.activated;
  ELSIF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    NEW.activated := NEW.is_active;
  END IF;

  IF NEW.banned IS DISTINCT FROM OLD.banned THEN
    NEW.is_banned := NEW.banned;
  ELSIF NEW.is_banned IS DISTINCT FROM OLD.is_banned THEN
    NEW.banned := NEW.is_banned;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_activation_columns ON public.profiles;
CREATE TRIGGER sync_profile_activation_columns
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_activation_columns();

-- The manual/Lipa Namba flow used by 1Vela expects this table.
CREATE TABLE IF NOT EXISTS public.payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 16000,
  status text NOT NULL DEFAULT 'pending',
  provider text NOT NULL DEFAULT 'manual',
  provider_reference text,
  provider_status text,
  provider_checkout_url text,
  provider_payload jsonb,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_requests
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS provider_reference text,
  ADD COLUMN IF NOT EXISTS provider_status text,
  ADD COLUMN IF NOT EXISTS provider_checkout_url text,
  ADD COLUMN IF NOT EXISTS provider_payload jsonb,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE INDEX IF NOT EXISTS payment_requests_user_id_idx
  ON public.payment_requests(user_id);
CREATE INDEX IF NOT EXISTS payment_requests_provider_reference_idx
  ON public.payment_requests(provider_reference);
CREATE INDEX IF NOT EXISTS payment_requests_user_provider_created_idx
  ON public.payment_requests(user_id, provider, created_at DESC);

ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own payment requests" ON public.payment_requests;
CREATE POLICY "Users can view their own payment requests"
ON public.payment_requests FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can submit their own payment requests" ON public.payment_requests;
CREATE POLICY "Users can submit their own payment requests"
ON public.payment_requests FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT ON public.payment_requests TO authenticated;
GRANT ALL ON public.payment_requests TO service_role;

-- Ensure automatic payment tracking also exists when only the working project
-- migrations were applied.
CREATE TABLE IF NOT EXISTS public.automatic_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id text UNIQUE,
  amount numeric(12,2) NOT NULL DEFAULT 16000,
  currency text NOT NULL DEFAULT 'TZS',
  phone text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  checkout_url text,
  provider_status text,
  provider_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automatic_payments_user_id_idx
  ON public.automatic_payments(user_id);
CREATE INDEX IF NOT EXISTS automatic_payments_status_idx
  ON public.automatic_payments(status);

ALTER TABLE public.automatic_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auto_payments_select_own_or_admin" ON public.automatic_payments;
CREATE POLICY "auto_payments_select_own_or_admin"
ON public.automatic_payments FOR SELECT TO authenticated
USING (user_id = auth.uid() OR EXISTS (
  SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()
));

GRANT SELECT, INSERT, UPDATE ON public.automatic_payments TO authenticated;
GRANT ALL ON public.automatic_payments TO service_role;

-- Keep both profile activation fields correct when the server activates an account.
CREATE OR REPLACE FUNCTION public.activate_user_from_auto_payment(
  target_user_id uuid,
  auto_payment_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_rows integer := 0;
BEGIN
  UPDATE public.automatic_payments
  SET status = 'paid', updated_at = now()
  WHERE id = auto_payment_id
    AND user_id = target_user_id
    AND status IN ('pending','processing');

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.profiles
  SET activated = true,
      is_active = true
  WHERE id = target_user_id
    AND COALESCE(banned, false) = false
    AND COALESCE(is_banned, false) = false;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_user_from_auto_payment(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_user_from_auto_payment(uuid, uuid) TO service_role;
