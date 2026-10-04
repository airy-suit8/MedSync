-- Phase 5 test fix: the original auth trigger still wrote to the legacy
-- public.users and public.user_short_ids tables removed during Phase 3.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role text;
  v_name text;
  v_short_id text;
  v_app_metadata jsonb;
BEGIN
  v_role := coalesce(NEW.raw_user_meta_data->>'role', 'patient');
  IF v_role NOT IN ('patient', 'doctor', 'lab') THEN
    v_role := 'patient';
  END IF;
  v_name := coalesce(NEW.raw_user_meta_data->>'name', 'Unknown User');

  v_app_metadata := coalesce(NEW.raw_app_meta_data, '{}'::jsonb);
  v_app_metadata := jsonb_set(v_app_metadata, '{role}', to_jsonb(v_role));
  UPDATE auth.users SET raw_app_meta_data = v_app_metadata WHERE id = NEW.id;

  LOOP
    v_short_id := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE short_id = v_short_id);
  END LOOP;

  INSERT INTO public.profiles (id, email, name, role, short_id)
  VALUES (NEW.id, NEW.email, v_name, v_role, v_short_id)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
