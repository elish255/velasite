-- Restore the activation flag used by login, payments, chat access, and admin controls.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS activated boolean NOT NULL DEFAULT false;

UPDATE public.profiles
SET activated = COALESCE(activated, false)
WHERE activated IS NULL;
