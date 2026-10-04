-- Decision D1 from docs/AUDIT_FINDINGS.md (approved 2026-10-04): verification gate for
-- doctors + patients confirm appointments a doctor creates. Closes C2/C4: a stranger
-- signing up as "Doctor" could list every patient, assign them to themselves and read
-- their reports and AI findings.
--
-- New flow (status values already used by the app, so no new statuses):
--   verified doctor schedules -> appointment 'scheduled'
--   patient confirms          -> 'confirmed' and only then doctor_patient_assignments
--   patient declines          -> 'cancelled'
-- Apply after 20261004120000_security_fixes.sql and before the matching app deploy.

-- 1. Verification flag. The team marks doctors verified in the Supabase dashboard after
--    checking their medical council registration number (profiles.license_number).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;

-- Existing doctor accounts keep working (they predate verification). Review them in the
-- dashboard and set verified = false for any that aren't real doctors.
UPDATE public.profiles SET verified = true WHERE role = 'doctor' AND NOT verified;

CREATE OR REPLACE FUNCTION public.is_verified_doctor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT coalesce((SELECT verified FROM public.profiles WHERE id = auth.uid() AND role = 'doctor'), false);
$function$;
REVOKE EXECUTE ON FUNCTION public.is_verified_doctor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_verified_doctor() TO authenticated;

-- H2: doctors' "assigned patients" lists were always empty: this read the dropped
-- user_short_ids table and its EXCEPTION handler returned nothing. Same signature and
-- columns (still called by the doctor Reports and Medical Records pages), now reading
-- profiles, only for the calling doctor, and only while that doctor is verified.
CREATE OR REPLACE FUNCTION public.get_doctor_patients_bulletproof(doctor_uuid uuid)
RETURNS TABLE (
  patient_id uuid,
  patient_short_id text,
  patient_name text,
  patient_email text,
  assigned_at timestamp with time zone,
  total_reports bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT dpa.patient_id,
         p.short_id,
         coalesce(p.name, 'Unknown Patient'),
         p.email,
         dpa.assigned_at,
         (SELECT count(*) FROM public.reports r WHERE r.patient_id = dpa.patient_id)
  FROM public.doctor_patient_assignments dpa
  LEFT JOIN public.profiles p ON p.id = dpa.patient_id
  WHERE dpa.doctor_id = doctor_uuid
    AND doctor_uuid = auth.uid()
    AND public.is_verified_doctor()
    AND dpa.is_active = true
  ORDER BY dpa.assigned_at DESC;
$function$;

-- 2. Users may edit their own profile row, but not their role or verification. API
--    users run as anon/authenticated; the dashboard (postgres) and server (service_role)
--    can still change both.
CREATE OR REPLACE FUNCTION public.prevent_profile_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  IF current_user IN ('anon', 'authenticated') AND (
       OLD.role IS DISTINCT FROM NEW.role
       OR OLD.verified IS DISTINCT FROM NEW.verified
       -- Patients see a verified doctor's name when confirming a request, so the name and
       -- registration number the team checked stay fixed.
       OR (OLD.verified AND (OLD.name IS DISTINCT FROM NEW.name OR OLD.license_number IS DISTINCT FROM NEW.license_number))
     ) THEN
    RAISE EXCEPTION 'Profile roles and verification can only be changed by a trusted server'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

-- The original trigger fired only on UPDATE OF role, so a doctor could set verified = true.
DROP TRIGGER IF EXISTS prevent_profile_role_change ON public.profiles;
CREATE TRIGGER prevent_profile_role_change
BEFORE UPDATE OF role, verified, name, license_number ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_role_change();

-- 3. Signup stores the registration number doctors enter (signup form, role = doctor).
--    Otherwise identical to 20260926141000_fix_auth_profile_trigger.sql.
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
  v_license := CASE WHEN v_role = 'doctor'
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

-- 4. Only verified doctors can schedule.
DROP POLICY IF EXISTS "appointments_doctor_insert" ON public.appointments;
CREATE POLICY "appointments_doctor_insert"
ON public.appointments
FOR INSERT TO authenticated
WITH CHECK (doctor_id = auth.uid() AND public.get_auth_role() = 'doctor' AND public.is_verified_doctor());

-- 4b. Patients could insert appointments with any doctor and then confirm them, assigning
--     themselves to any doctor. No screen lets patients create appointments.
DROP POLICY IF EXISTS "appointments_patient_insert" ON public.appointments;

-- 5. Doctors can no longer create or re-point assignments themselves (an UPDATE could
--    move an existing assignment to any patient). Assignments come only from a
--    patient confirming an appointment, below. Matches rls_policies.test.sql.
DROP POLICY IF EXISTS "doctor_patient_assignments_doctor_insert" ON public.doctor_patient_assignments;
DROP POLICY IF EXISTS "doctor_patient_assignments_doctor_update" ON public.doctor_patient_assignments;

-- 6. Patient answers a doctor's appointment. Confirming assigns the patient to that
--    (verified) doctor, which is what lets labs upload and the doctor read reports.
CREATE OR REPLACE FUNCTION public.respond_to_appointment(p_appointment_id uuid, p_accept boolean)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  a public.appointments%ROWTYPE;
BEGIN
  SELECT * INTO a FROM public.appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND OR a.patient_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Appointment not found' USING ERRCODE = 'P0002';
  END IF;
  IF a.status IS DISTINCT FROM 'scheduled' THEN
    RAISE EXCEPTION 'This appointment has already been answered' USING ERRCODE = '22023';
  END IF;

  IF NOT p_accept THEN
    UPDATE public.appointments SET status = 'cancelled', updated_at = now() WHERE id = a.id;
    RETURN 'cancelled';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = a.doctor_id AND role = 'doctor' AND verified) THEN
    RAISE EXCEPTION 'This doctor is not verified yet' USING ERRCODE = '42501';
  END IF;

  UPDATE public.appointments SET status = 'confirmed', updated_at = now() WHERE id = a.id;
  INSERT INTO public.doctor_patient_assignments (doctor_id, patient_id, is_active)
  SELECT a.doctor_id, a.patient_id, true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.doctor_patient_assignments
    WHERE doctor_id = a.doctor_id AND patient_id = a.patient_id AND is_active
  )
  ON CONFLICT DO NOTHING;
  RETURN 'confirmed';
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.respond_to_appointment(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_appointment(uuid, boolean) TO authenticated;

-- 7. Directory: everyone sees themselves, labs and verified doctors. Only labs and
--    verified doctors see patients (labs pick patients when uploading; doctors look
--    patients up to schedule and chat), so patients and unverified signups can no
--    longer list every patient. Same columns as before.
CREATE OR REPLACE VIEW public.profile_directory
WITH (security_barrier = true, security_invoker = false)
AS
SELECT p.id, p.name, p.role, p.short_id, p.specialty, p.lab_name, p.online, p.last_seen
FROM public.profiles p
WHERE p.id = auth.uid()
   OR p.role = 'lab'
   OR (p.role = 'doctor' AND p.verified)
   OR (SELECT public.get_auth_role()) = 'lab'
   OR (SELECT public.is_verified_doctor());

REVOKE ALL ON public.profile_directory FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.profile_directory TO authenticated;

-- 8. Un-verifying a doctor must cut access at once, even through assignments they already
--    have (the existing policies only check assignments). Restrictive policies are AND-ed
--    with the permissive ones and only affect callers whose role is doctor.
DROP POLICY IF EXISTS "reports_require_verified_doctor" ON public.reports;
CREATE POLICY "reports_require_verified_doctor"
ON public.reports AS RESTRICTIVE
FOR ALL TO authenticated
USING ((SELECT public.get_auth_role()) IS DISTINCT FROM 'doctor' OR (SELECT public.is_verified_doctor()))
WITH CHECK ((SELECT public.get_auth_role()) IS DISTINCT FROM 'doctor' OR (SELECT public.is_verified_doctor()));

DROP POLICY IF EXISTS "ml_suggestions_require_verified_doctor" ON public.ml_suggestions;
CREATE POLICY "ml_suggestions_require_verified_doctor"
ON public.ml_suggestions AS RESTRICTIVE
FOR ALL TO authenticated
USING ((SELECT public.get_auth_role()) IS DISTINCT FROM 'doctor' OR (SELECT public.is_verified_doctor()))
WITH CHECK ((SELECT public.get_auth_role()) IS DISTINCT FROM 'doctor' OR (SELECT public.is_verified_doctor()));

-- 9. Only the patient answers a request (scheduled -> confirmed | cancelled). Doctors can't
--    mark it confirmed for them, put it back to scheduled, or revive one the patient
--    declined; they can still complete appointments. Runs on every path (direct updates
--    and safe_appointment_update), keyed on the caller; server/dashboard calls have no
--    auth.uid() and are allowed.
CREATE OR REPLACE FUNCTION public.guard_appointment_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;
  IF caller = OLD.patient_id AND OLD.status = 'scheduled' AND NEW.status IN ('confirmed', 'cancelled') THEN
    RETURN NEW;
  END IF;
  IF caller = OLD.doctor_id AND OLD.status IS DISTINCT FROM 'cancelled' AND NEW.status NOT IN ('scheduled', 'confirmed') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'This appointment status can only be changed by the patient' USING ERRCODE = '42501';
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.guard_appointment_status() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_appointment_status ON public.appointments;
CREATE TRIGGER guard_appointment_status
BEFORE UPDATE OF status ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.guard_appointment_status();
