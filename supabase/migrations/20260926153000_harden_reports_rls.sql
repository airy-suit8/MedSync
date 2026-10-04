-- Remove the permissive policies that bypassed the intended role checks.
DROP POLICY IF EXISTS "Lab can insert reports" ON public.reports;
DROP POLICY IF EXISTS "Lab can read own uploaded reports" ON public.reports;
DROP POLICY IF EXISTS "Patient can read own reports" ON public.reports;
DROP POLICY IF EXISTS allow_all_anon_reports ON public.reports;
DROP POLICY IF EXISTS allow_all_authenticated_reports ON public.reports;

-- The schema has no lab-to-patient assignment relation. A report is considered
-- for a patient currently being serviced when its doctor_id and patient_id
-- identify an active doctor-patient assignment.
CREATE OR REPLACE FUNCTION public.lab_can_upload_patient_report(
  p_patient_id uuid,
  p_doctor_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    JOIN public.doctor_patient_assignments AS dpa
      ON dpa.patient_id = p.id
    WHERE p.id = p_patient_id
      AND p.role = 'patient'
      AND dpa.doctor_id = p_doctor_id
      AND dpa.is_active = true
  );
$function$;

REVOKE ALL ON FUNCTION public.lab_can_upload_patient_report(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lab_can_upload_patient_report(uuid, uuid) TO authenticated;

CREATE POLICY reports_patient_select_own
ON public.reports FOR SELECT TO authenticated
USING (
  public.get_auth_role() = 'patient'
  AND patient_id = auth.uid()
);

CREATE POLICY reports_assigned_doctor_select
ON public.reports FOR SELECT TO authenticated
USING (
  public.get_auth_role() = 'doctor'
  AND EXISTS (
    SELECT 1
    FROM public.doctor_patient_assignments AS dpa
    WHERE dpa.doctor_id = auth.uid()
      AND dpa.patient_id = reports.patient_id
      AND dpa.is_active = true
  )
);

CREATE POLICY reports_lab_select_own_uploads
ON public.reports FOR SELECT TO authenticated
USING (
  public.get_auth_role() = 'lab'
  AND uploaded_by = auth.uid()
);

CREATE POLICY reports_lab_insert_serviced_patient
ON public.reports FOR INSERT TO authenticated
WITH CHECK (
  public.get_auth_role() = 'lab'
  AND uploaded_by = auth.uid()
  AND public.lab_can_upload_patient_report(patient_id, doctor_id)
);

-- No UPDATE or DELETE policy is created. Both operations are denied by RLS.
