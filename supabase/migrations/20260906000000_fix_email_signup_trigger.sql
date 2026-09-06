-- Keep Supabase email signups from writing email addresses into users.phone.
-- The auth trigger creates the local profile before the API completes onboarding.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display_name TEXT;
BEGIN
  v_display_name := COALESCE(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'first_name',
    split_part(new.email, '@', 1),
    ''
  );

  INSERT INTO public.users (id, auth_user_id, phone, email, full_name, is_verified, created_at, updated_at)
  VALUES (
    new.id,
    new.id,
    new.phone,
    LOWER(new.email),
    v_display_name,
    TRUE,
    COALESCE(new.created_at, CURRENT_TIMESTAMP),
    CURRENT_TIMESTAMP
  )
  ON CONFLICT (id) DO UPDATE
    SET auth_user_id = EXCLUDED.auth_user_id,
        phone = COALESCE(public.users.phone, EXCLUDED.phone),
        email = COALESCE(public.users.email, EXCLUDED.email),
        full_name = CASE
          WHEN public.users.full_name IS NULL OR public.users.full_name = ''
          THEN EXCLUDED.full_name
          ELSE public.users.full_name
        END,
        updated_at = CURRENT_TIMESTAMP;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
