DROP POLICY IF EXISTS "Doctor can read assigned patient ml_suggestions"
  ON public.ml_suggestions;

CREATE POLICY "Doctor can read assigned patient ml_suggestions"
ON public.ml_suggestions
FOR SELECT TO authenticated
USING (
  public.get_auth_role() = 'doctor'
  AND EXISTS (
    SELECT 1
    FROM public.doctor_patient_assignments AS dpa
    WHERE dpa.doctor_id = auth.uid()
      AND dpa.is_active IS TRUE
      AND dpa.patient_id::text = ml_suggestions.patient_id::text
  )
);
