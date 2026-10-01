-- ==============================================================================
-- 21_v2_auth_trigger.sql
-- Gives every new user a profile so they can log in straight away.
-- New users start as 'sales'. Make someone admin or consultant with:
--   update "sales-pipe".profiles set role = 'admin' where id = '<user id>';
-- Keep public sign-ups turned OFF in Supabase Authentication settings
-- (invite users only), otherwise anyone could create a sales account.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO "sales-pipe".profiles (id, full_name, role)
  VALUES (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
    'sales'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
