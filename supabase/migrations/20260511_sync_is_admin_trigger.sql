-- Trigger: keeps is_admin always in sync with role.
-- If role = 'admin', is_admin is always true; otherwise false.
-- Prevents app code from accidentally resetting admin permissions.

CREATE OR REPLACE FUNCTION public.sync_is_admin_from_role()
RETURNS trigger AS $$
BEGIN
  NEW.is_admin := (NEW.role = 'admin');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS sync_is_admin ON public.profiles;
CREATE TRIGGER sync_is_admin
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_is_admin_from_role();
