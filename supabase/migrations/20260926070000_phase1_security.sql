-- ========================================================
-- PHASE 1: SECURITY LOCKDOWN & AUTH TRIGGERS
-- ========================================================

-- 1. SECURE STORAGE
-- --------------------------------------------------------
UPDATE storage.buckets SET public = false WHERE id = 'reports';

-- Storage Policies
DROP POLICY IF EXISTS "auth_upload_reports" ON storage.objects;
DROP POLICY IF EXISTS "auth_read_reports" ON storage.objects;

CREATE POLICY "auth_upload_reports" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'reports');
CREATE POLICY "auth_read_reports" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'reports');


-- 2. AUTH TRIGGERS (ROLE ESCALATION FIX)
-- --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.gen_short_id(len int default 10)
RETURNS text
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  candidate text;
BEGIN
  LOOP
    candidate := substr(replace(gen_random_uuid()::text, '-', ''), 1, len);
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.user_short_ids WHERE short_id = candidate
    );
  END LOOP;
  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT;
  v_name TEXT;
  v_short_id TEXT;
  v_app_metadata JSONB;
BEGIN
  v_role := coalesce(NEW.raw_user_meta_data->>'role', 'patient');
  v_name := coalesce(NEW.raw_user_meta_data->>'name', 'Unknown User');
  
  IF v_role NOT IN ('patient', 'doctor', 'lab') THEN
    v_role := 'patient';
  END IF;
  
  -- Securely set the role in app_metadata
  v_app_metadata := coalesce(NEW.raw_app_meta_data, '{}'::jsonb);
  v_app_metadata := jsonb_set(v_app_metadata, '{role}', to_jsonb(v_role));
  
  UPDATE auth.users 
  SET raw_app_meta_data = v_app_metadata 
  WHERE id = NEW.id;

  v_short_id := public.gen_short_id(10);
  
  -- Ensure tables exist in case live schema is weird
  INSERT INTO public.users (auth_id, role, name, short_id, email)
  VALUES (NEW.id, v_role, v_name, v_short_id, NEW.email)
  ON CONFLICT (auth_id) DO NOTHING;
  
  INSERT INTO public.user_short_ids (user_id, short_id, role)
  VALUES (NEW.id, v_short_id, v_role)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 3. ENABLE RLS & REVOKE ANON
-- --------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE 'ALTER TABLE public.' || quote_ident(t) || ' ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'REVOKE ALL ON public.' || quote_ident(t) || ' FROM anon;';
  END LOOP;
END $$;
