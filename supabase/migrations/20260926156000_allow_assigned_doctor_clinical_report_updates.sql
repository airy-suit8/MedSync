-- Reports are uploaded artifacts. Assigned doctors may annotate the clinical
-- result, but cannot change upload identity, patient ownership, or file data.
REVOKE UPDATE ON public.reports FROM anon, authenticated;
GRANT UPDATE (notes, result) ON public.reports TO authenticated;

DROP POLICY IF EXISTS reports_assigned_doctor_update_clinical
  ON public.reports;

CREATE POLICY reports_assigned_doctor_update_clinical
ON public.reports
FOR UPDATE TO authenticated
USING (
  public.get_auth_role() = 'doctor'
  AND EXISTS (
    SELECT 1
    FROM public.doctor_patient_assignments AS dpa
    WHERE dpa.doctor_id = auth.uid()
      AND dpa.patient_id::text = reports.patient_id::text
      AND dpa.is_active IS TRUE
  )
)
WITH CHECK (
  public.get_auth_role() = 'doctor'
  AND EXISTS (
    SELECT 1
    FROM public.doctor_patient_assignments AS dpa
    WHERE dpa.doctor_id = auth.uid()
      AND dpa.patient_id::text = reports.patient_id::text
      AND dpa.is_active IS TRUE
  )
);
