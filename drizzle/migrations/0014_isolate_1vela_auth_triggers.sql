-- Keep the shared Auth user directory while preventing signup profile rows
-- from being fanned out across the separate applications in this Supabase project.
BEGIN;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.raw_user_meta_data ->> 'app_origin' = '1vela')
  EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS gochati_auth_user_created ON auth.users;
CREATE TRIGGER gochati_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.raw_user_meta_data ->> 'app_origin' IS DISTINCT FROM '1vela')
  EXECUTE FUNCTION public.gochati_create_user();

DROP TRIGGER IF EXISTS gochati_notify_new_user ON auth.users;
CREATE TRIGGER gochati_notify_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.raw_user_meta_data ->> 'app_origin' IS DISTINCT FROM '1vela')
  EXECUTE FUNCTION public.gochati_notify_new_user();

DROP TRIGGER IF EXISTS chatdunia_auth_user_created ON auth.users;
CREATE TRIGGER chatdunia_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.raw_user_meta_data ->> 'app_origin' IS DISTINCT FROM '1vela')
  EXECUTE FUNCTION public.chatdunia_create_user();

DROP TRIGGER IF EXISTS on_auth_user_created_smart_soko ON auth.users;
CREATE TRIGGER on_auth_user_created_smart_soko
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.raw_user_meta_data ->> 'app_origin' IS DISTINCT FROM '1vela')
  EXECUTE FUNCTION public.handle_new_smart_soko_user();

COMMIT;
