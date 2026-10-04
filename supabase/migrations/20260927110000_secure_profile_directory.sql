DROP POLICY IF EXISTS "Anyone can read profiles" ON public.profiles;
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;

CREATE POLICY profiles_select_own
ON public.profiles
FOR SELECT TO authenticated
USING (id = auth.uid());

REVOKE SELECT ON public.profiles FROM PUBLIC, anon;
GRANT SELECT ON public.profiles TO authenticated;

CREATE OR REPLACE VIEW public.profile_directory
WITH (security_barrier = true, security_invoker = false)
AS
SELECT id, name, role, short_id, specialty, lab_name, online, last_seen
FROM public.profiles;

REVOKE ALL ON public.profile_directory FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.profile_directory TO authenticated;

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
  WHERE public.get_auth_role() = 'lab'
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

REVOKE ALL ON FUNCTION public.get_lab_upload_patient_profile(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_lab_upload_patient_profile(uuid, uuid)
  TO authenticated;