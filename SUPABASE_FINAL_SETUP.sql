-- 1Vela FINAL SUPABASE SETUP
-- Run this once in Supabase SQL Editor on a fresh project.
-- Then create your first user in Auth before running the admin INSERT at the bottom.

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT 'Tanzania',
  balance numeric NOT NULL DEFAULT 0,
  activated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'phone', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Activation payment workflow for 1Vela.

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone text NOT NULL,
  amount integer NOT NULL DEFAULT 12000 CHECK (amount = 12000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_requests_one_pending_per_user
  ON public.payment_requests (user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS payment_requests_status_created_at_idx
  ON public.payment_requests (status, created_at DESC);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = (select auth.uid())
  );
$$;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;
REVOKE ALL ON FUNCTION private.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated;

DROP POLICY IF EXISTS "Users can view their own admin membership" ON public.admin_users;
CREATE POLICY "Users can view their own admin membership"
ON public.admin_users FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view their own payment requests" ON public.payment_requests;
CREATE POLICY "Users can view their own payment requests"
ON public.payment_requests FOR SELECT TO authenticated
USING (user_id = auth.uid() OR private.is_admin());

DROP POLICY IF EXISTS "Users can submit their own payment requests" ON public.payment_requests;
CREATE POLICY "Users can submit their own payment requests"
ON public.payment_requests FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Admins can see all profiles and change activation status.
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING ((select auth.uid()) = id OR private.is_admin());

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (private.is_admin())
WITH CHECK (private.is_admin());

REVOKE INSERT, DELETE ON public.profiles FROM authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;

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
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid review status';
  END IF;

  UPDATE public.payment_requests
  SET
    status = p_status,
    approved_at = CASE WHEN p_status = 'approved' THEN now() ELSE NULL END,
    approved_by = CASE WHEN p_status = 'approved' THEN (select auth.uid()) ELSE NULL END
  WHERE id = p_request_id
    AND status = 'pending'
  RETURNING * INTO result;

  IF result.id IS NULL THEN
    RAISE EXCEPTION 'Payment request not found or already reviewed';
  END IF;

  IF p_status = 'approved' THEN
    UPDATE public.profiles
    SET activated = true
    WHERE id = result.user_id;
  END IF;

  RETURN result;
END;
$$;

GRANT SELECT, INSERT ON public.payment_requests TO authenticated;
GRANT SELECT ON public.admin_users TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_activation_payment(uuid, text) TO authenticated;
GRANT ALL ON public.payment_requests TO service_role;
GRANT ALL ON public.admin_users TO service_role;


-- Public, read-only activity feed for approved activation payments.
-- It exposes only first name, profile location, amount and approval time.
-- It does not expose phone numbers, emails, user IDs, or other account data.

CREATE OR REPLACE FUNCTION public.get_public_payment_activity()
RETURNS TABLE (
  first_name text,
  location text,
  amount integer,
  approved_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    split_part(trim(p.full_name), ' ', 1) AS first_name,
    COALESCE(NULLIF(trim(p.country), ''), 'Tanzania') AS location,
    pr.amount,
    pr.approved_at
  FROM public.payment_requests AS pr
  JOIN public.profiles AS p ON p.id = pr.user_id
  WHERE pr.status = 'approved'
    AND pr.approved_at IS NOT NULL
    AND trim(p.full_name) <> ''
  ORDER BY pr.approved_at DESC
  LIMIT 30;
$$;

REVOKE ALL ON FUNCTION public.get_public_payment_activity() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_payment_activity() TO anon, authenticated;


-- CREATE YOUR FIRST ADMIN
-- 1) Register/login this email on 1Vela first.
-- 2) Replace the email below with your exact admin email.
-- 3) Run this INSERT.
-- INSERT INTO public.admin_users (user_id)
-- SELECT id FROM auth.users
-- WHERE email = 'YOUR_ADMIN_EMAIL@example.com'
-- ON CONFLICT (user_id) DO NOTHING;


-- ===== Withdrawal system (0003) =====
-- Withdrawal requests with server-side balance/rule enforcement.
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  phone text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processed_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS withdrawal_requests_user_created_idx
  ON public.withdrawal_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS withdrawal_requests_status_created_idx
  ON public.withdrawal_requests (status, created_at DESC);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own withdrawals" ON public.withdrawal_requests;
CREATE POLICY "Users can view own withdrawals"
ON public.withdrawal_requests FOR SELECT TO authenticated
USING (user_id = auth.uid() OR private.is_admin());

DROP POLICY IF EXISTS "Admins can update withdrawals" ON public.withdrawal_requests;
CREATE POLICY "Admins can update withdrawals"
ON public.withdrawal_requests FOR UPDATE TO authenticated
USING (private.is_admin())
WITH CHECK (private.is_admin());

GRANT SELECT ON public.withdrawal_requests TO authenticated;
GRANT ALL ON public.withdrawal_requests TO service_role;

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
  v_row public.withdrawal_requests;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'You must be logged in';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Enter a valid amount';
  END IF;

  IF p_phone IS NULL OR length(trim(p_phone)) < 9 THEN
    RAISE EXCEPTION 'Enter a valid phone number';
  END IF;

  SELECT balance INTO v_balance
  FROM public.profiles
  WHERE id = v_user
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  SELECT count(*)::integer INTO v_count
  FROM public.withdrawal_requests
  WHERE user_id = v_user;

  v_min := CASE WHEN v_count = 0 THEN 50000 ELSE 100000 END;

  IF v_balance < v_min THEN
    RAISE EXCEPTION 'Insufficient balance. Minimum available balance for this withdrawal is TZS %', v_min;
  END IF;

  IF p_amount <= v_min THEN
    RAISE EXCEPTION 'Withdrawal amount must be greater than TZS %', v_min;
  END IF;

  IF p_amount > v_balance THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  UPDATE public.profiles
  SET balance = balance - p_amount
  WHERE id = v_user;

  INSERT INTO public.withdrawal_requests (user_id, amount, phone)
  VALUES (v_user, p_amount, trim(p_phone))
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_withdrawal(numeric, text) TO authenticated;

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

  IF p_status NOT IN ('paid','rejected') THEN
    RAISE EXCEPTION 'Invalid review status';
  END IF;

  UPDATE public.withdrawal_requests
  SET status = p_status,
      processed_at = now(),
      processed_by = (select auth.uid())
  WHERE id = p_request_id AND status = 'pending'
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Withdrawal request not found or already reviewed';
  END IF;

  IF p_status = 'rejected' THEN
    UPDATE public.profiles
    SET balance = balance + v_row.amount
    WHERE id = v_row.user_id;
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_withdrawal(uuid, text) TO authenticated;
