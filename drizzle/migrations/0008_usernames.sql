-- 1Vela usernames: safe to run on an existing database.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text;

-- Backfill existing profiles from their auth email before enforcing uniqueness.
UPDATE public.profiles p
SET username = left(
  regexp_replace(lower(split_part(coalesce(u.email, ''), '@', 1)), '[^a-z0-9_]+', '_', 'g'),
  23
)
  || '_' || substr(replace(p.id::text, '-', ''), 1, 6)
FROM auth.users u
WHERE u.id = p.id
  AND (p.username IS NULL OR btrim(p.username) = '');

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username text;
BEGIN
  v_username := NULLIF(btrim(NEW.raw_user_meta_data ->> 'username'), '');

  INSERT INTO public.profiles (id, full_name, phone, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'phone', ''),
    v_username
  )
  ON CONFLICT (id) DO UPDATE SET
    username = COALESCE(public.profiles.username, EXCLUDED.username),
    full_name = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name),
    phone = COALESCE(NULLIF(public.profiles.phone, ''), EXCLUDED.phone);

  RETURN NEW;
END;
$$;
