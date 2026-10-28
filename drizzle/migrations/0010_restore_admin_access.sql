-- Restore the admin panel contract for projects where profiles.balance was omitted.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS balance numeric NOT NULL DEFAULT 0;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can view all payment requests" ON public.payment_requests;
CREATE POLICY "Admins can view all payment requests" ON public.payment_requests
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can view all withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Admins can view all withdrawal requests" ON public.withdrawal_requests
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  );

GRANT SELECT ON public.profiles, public.payment_requests, public.withdrawal_requests TO authenticated;
