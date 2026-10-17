-- Digital prescriptions. Approved 2026-10-18.
--
-- A doctor treating the patient writes a prescription (medicines with dose, frequency,
-- duration and instructions; diagnosis; advice) from a report review, a consultation or
-- the patient's record. It keeps a snapshot of the doctor's name, specialty and
-- registration number and the patient's name, so the printed copy never changes later.
-- The patient and their current doctors can read it; only its doctor can cancel it.
-- Apply after 20261019130000_lab_pipeline.sql.

CREATE TABLE IF NOT EXISTS public.prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL REFERENCES public.profiles(id),
  report_id uuid REFERENCES public.reports(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  items jsonb NOT NULL CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) BETWEEN 1 AND 30),
  diagnosis text CHECK (char_length(diagnosis) <= 500),
  advice text CHECK (char_length(advice) <= 2000),
  doctor_name text NOT NULL,
  doctor_registration text,
  doctor_specialty text,
  patient_name text NOT NULL,
  patient_short_id text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS prescriptions_patient_id_idx ON public.prescriptions (patient_id, created_at DESC);

ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.prescriptions FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.prescriptions FROM authenticated;
GRANT SELECT ON public.prescriptions TO authenticated;

DROP POLICY IF EXISTS prescriptions_select ON public.prescriptions;
CREATE POLICY prescriptions_select ON public.prescriptions
FOR SELECT TO authenticated
USING (
  ((SELECT public.get_auth_role()) = 'patient' AND patient_id = (SELECT auth.uid()))
  OR (
    (SELECT public.is_verified_doctor())
    AND EXISTS (
      SELECT 1 FROM public.doctor_patient_assignments dpa
      WHERE dpa.doctor_id = (SELECT auth.uid()) AND dpa.patient_id = prescriptions.patient_id AND dpa.is_active IS TRUE
    )
  )
);

CREATE OR REPLACE FUNCTION public.create_prescription(
  p_patient_id uuid,
  p_items jsonb,
  p_diagnosis text,
  p_advice text,
  p_report_id uuid,
  p_appointment_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_doctor public.profiles%ROWTYPE;
  v_patient public.profiles%ROWTYPE;
  v_items jsonb;
  v_id uuid;
BEGIN
  SELECT * INTO v_doctor FROM public.profiles WHERE id = auth.uid() AND role = 'doctor' AND verified;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.doctor_patient_assignments
    WHERE doctor_id = auth.uid() AND patient_id = p_patient_id AND is_active IS TRUE
  ) THEN
    RAISE EXCEPTION 'Only a doctor treating this patient can prescribe' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_patient FROM public.profiles WHERE id = p_patient_id;

  IF p_report_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.reports WHERE id = p_report_id AND patient_id = p_patient_id) THEN
    RAISE EXCEPTION 'That report is not this patient''s' USING ERRCODE = '22023';
  END IF;
  IF p_appointment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.appointments WHERE id = p_appointment_id AND patient_id = p_patient_id AND doctor_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'That consultation is not with this patient' USING ERRCODE = '22023';
  END IF;

  -- Keep only known fields, trimmed and capped; every medicine needs a name.
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'Add at least one medicine' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'medicine', left(trim(i->>'medicine'), 120),
           'dose', nullif(left(trim(coalesce(i->>'dose', '')), 60), ''),
           'frequency', nullif(left(trim(coalesce(i->>'frequency', '')), 60), ''),
           'duration', nullif(left(trim(coalesce(i->>'duration', '')), 60), ''),
           'instructions', nullif(left(trim(coalesce(i->>'instructions', '')), 200), '')
         ) ORDER BY n), '[]'::jsonb)
  INTO v_items
  FROM jsonb_array_elements(p_items) WITH ORDINALITY AS e(i, n)
  WHERE jsonb_typeof(i) = 'object' AND nullif(trim(i->>'medicine'), '') IS NOT NULL;
  IF jsonb_array_length(v_items) = 0 OR jsonb_array_length(v_items) > 30 THEN
    RAISE EXCEPTION 'Add between 1 and 30 medicines' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.prescriptions (patient_id, doctor_id, report_id, appointment_id, items, diagnosis, advice,
    doctor_name, doctor_registration, doctor_specialty, patient_name, patient_short_id)
  VALUES (p_patient_id, auth.uid(), p_report_id, p_appointment_id, v_items,
    nullif(left(trim(p_diagnosis), 500), ''), nullif(left(trim(p_advice), 2000), ''),
    coalesce(v_doctor.name, 'Doctor'), v_doctor.license_number, v_doctor.specialty,
    coalesce(v_patient.name, 'Patient'), v_patient.short_id)
  RETURNING id INTO v_id;

  INSERT INTO public.notifications (user_id, title, message, notification_type, related_id, related_type, target_role, action_url)
  VALUES (p_patient_id, 'New prescription',
    coalesce(v_doctor.name, 'Your doctor') || ' wrote you a prescription.',
    'prescription_update', v_id, 'prescription', 'patient', '/prescriptions/' || v_id::text);

  RETURN v_id;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.create_prescription(uuid, jsonb, text, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_prescription(uuid, jsonb, text, text, uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_prescription(p_prescription_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  rx public.prescriptions%ROWTYPE;
BEGIN
  UPDATE public.prescriptions SET status = 'cancelled'
  WHERE id = p_prescription_id AND doctor_id = auth.uid() AND status = 'active'
  RETURNING * INTO rx;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prescription not found' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.notifications (user_id, title, message, notification_type, related_id, related_type, target_role, action_url)
  VALUES (rx.patient_id, 'Prescription cancelled',
    rx.doctor_name || ' cancelled a prescription. Don''t use it any more.',
    'prescription_update', rx.id, 'prescription', 'patient', '/prescriptions/' || rx.id::text);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.cancel_prescription(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_prescription(uuid) TO authenticated;
