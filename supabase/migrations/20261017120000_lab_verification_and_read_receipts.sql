-- Lab verification (docs/AUDIT_REPORT.md "Decisions still open", approved 2026-10-17) and
-- chat read receipts.
--
-- Anyone could sign up as "Lab Technician", list every patient, read patient details
-- through get_lab_upload_patient_profile and upload files and reports into a real
-- doctor's queue. Labs now get the same gate as doctors (20261004121000): the team sets
-- profiles.verified in the Supabase dashboard after checking the registration number the
-- lab entered at signup (profiles.license_number).
--
-- Apply after 20261004122000_reports_storage_access.sql and before the matching app
-- deploy (the upload routes refuse labs that aren't verified).

-- 1. Existing lab accounts keep working (they predate verification). Review them in the
--    dashboard and set verified = false for any that aren't real labs.
UPDATE public.profiles SET verified = true WHERE role = 'lab' AND NOT verified;

CREATE OR REPLACE FUNCTION public.is_verified_lab()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT coalesce((SELECT verified FROM public.profiles WHERE id = auth.uid() AND role = 'lab'), false);
$function$;
REVOKE EXECUTE ON FUNCTION public.is_verified_lab() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_verified_lab() TO authenticated;

-- 2. Signup stores the registration number labs enter too. Otherwise identical to
--    20261004121000 section 3.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_role text;
  v_name text;
  v_short_id text;
  v_license text;
  v_app_metadata jsonb;
BEGIN
  v_role := coalesce(NEW.raw_user_meta_data->>'role', 'patient');
  IF v_role NOT IN ('patient', 'doctor', 'lab') THEN
    v_role := 'patient';
  END IF;
  v_name := coalesce(NEW.raw_user_meta_data->>'name', 'Unknown User');
  v_license := CASE WHEN v_role IN ('doctor', 'lab')
                    THEN nullif(left(trim(NEW.raw_user_meta_data->>'license_number'), 64), '') END;

  v_app_metadata := coalesce(NEW.raw_app_meta_data, '{}'::jsonb);
  v_app_metadata := jsonb_set(v_app_metadata, '{role}', to_jsonb(v_role));
  UPDATE auth.users SET raw_app_meta_data = v_app_metadata WHERE id = NEW.id;

  LOOP
    v_short_id := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE short_id = v_short_id);
  END LOOP;

  INSERT INTO public.profiles (id, email, name, role, short_id, license_number)
  VALUES (NEW.id, NEW.email, v_name, v_role, v_short_id, v_license)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- 3. Directory: unverified labs are no longer listed to others, and only verified labs
--    see patients. Otherwise identical to 20261004121000 section 7.
CREATE OR REPLACE VIEW public.profile_directory
WITH (security_barrier = true, security_invoker = false)
AS
SELECT p.id, p.name, p.role, p.short_id, p.specialty, p.lab_name, p.online, p.last_seen
FROM public.profiles p
WHERE p.id = auth.uid()
   OR (p.role IN ('doctor', 'lab') AND p.verified)
   OR (SELECT public.is_verified_lab())
   OR (SELECT public.is_verified_doctor());

REVOKE ALL ON public.profile_directory FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.profile_directory TO authenticated;

-- 4. Patient details for an upload: verified labs only. This is SECURITY DEFINER, so the
--    policies below don't reach it. Otherwise identical to
--    20260927110000_secure_profile_directory.sql.
CREATE OR REPLACE FUNCTION public.get_lab_upload_patient_profile(
  p_patient_id uuid,
  p_doctor_id uuid
)
RETURNS TABLE (
  id uuid,
  name text,
  date_of_birth date,
  gender text,
  phone text,
  address text,
  chronic_conditions text,
  current_medications text,
  allergies text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT p.id, p.name, p.date_of_birth, p.gender, p.phone, p.address,
         p.chronic_conditions, p.current_medications, p.allergies
  FROM public.profiles AS p
  WHERE public.is_verified_lab()
    AND p.id = p_patient_id
    AND p.role = 'patient'
    AND EXISTS (
      SELECT 1
      FROM public.doctor_patient_assignments AS dpa
      WHERE dpa.patient_id = p.id
        AND dpa.doctor_id = p_doctor_id
        AND dpa.is_active IS TRUE
    );
$function$;

-- 5. Unverified (or un-verified) labs lose access to reports, lab workflows and files,
--    like doctors in 20261004121000 section 8. Restrictive policies are AND-ed with the
--    permissive ones and only affect callers whose role is lab. storage.objects covers
--    both the reports and imaging buckets.
DROP POLICY IF EXISTS "reports_require_verified_lab" ON public.reports;
CREATE POLICY "reports_require_verified_lab"
ON public.reports AS RESTRICTIVE
FOR ALL TO authenticated
USING ((SELECT public.get_auth_role()) IS DISTINCT FROM 'lab' OR (SELECT public.is_verified_lab()))
WITH CHECK ((SELECT public.get_auth_role()) IS DISTINCT FROM 'lab' OR (SELECT public.is_verified_lab()));

DROP POLICY IF EXISTS "lab_samples_require_verified_lab" ON public.lab_samples;
CREATE POLICY "lab_samples_require_verified_lab"
ON public.lab_samples AS RESTRICTIVE
FOR ALL TO authenticated
USING ((SELECT public.get_auth_role()) IS DISTINCT FROM 'lab' OR (SELECT public.is_verified_lab()))
WITH CHECK ((SELECT public.get_auth_role()) IS DISTINCT FROM 'lab' OR (SELECT public.is_verified_lab()));

DROP POLICY IF EXISTS "imaging_studies_require_verified_lab" ON public.imaging_studies;
CREATE POLICY "imaging_studies_require_verified_lab"
ON public.imaging_studies AS RESTRICTIVE
FOR ALL TO authenticated
USING ((SELECT public.get_auth_role()) IS DISTINCT FROM 'lab' OR (SELECT public.is_verified_lab()))
WITH CHECK ((SELECT public.get_auth_role()) IS DISTINCT FROM 'lab' OR (SELECT public.is_verified_lab()));

DROP POLICY IF EXISTS "objects_require_verified_lab" ON storage.objects;
CREATE POLICY "objects_require_verified_lab"
ON storage.objects AS RESTRICTIVE
FOR ALL TO authenticated
USING ((SELECT public.get_auth_role()) IS DISTINCT FROM 'lab' OR (SELECT public.is_verified_lab()))
WITH CHECK ((SELECT public.get_auth_role()) IS DISTINCT FROM 'lab' OR (SELECT public.is_verified_lab()));

-- 6. Read receipts. The messages UPDATE policy is sender-only, so a receiver's "mark as
--    read" silently changed nothing. A receiver-wide UPDATE policy would also let them
--    edit the text, so this sets only is_read, only on messages sent to the caller.
CREATE OR REPLACE FUNCTION public.mark_messages_read(p_sender_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $function$
  UPDATE public.messages
  SET is_read = true
  WHERE receiver_id = auth.uid()
    AND sender_id = p_sender_id
    AND is_read IS NOT TRUE;
$function$;
REVOKE EXECUTE ON FUNCTION public.mark_messages_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_messages_read(uuid) TO authenticated;
