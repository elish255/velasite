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
