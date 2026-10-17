-- Patient health record. Approved 2026-10-18.
--
-- The patient keeps a health profile (allergies, medicines, conditions, blood group...)
-- that their doctors read, and one timeline of everything in their care: reports and
-- reviews, prescriptions, consultations, and when care with each doctor started and
-- ended. Readable by the patient and by verified doctors currently treating them, the
-- same rule as reports. Replaces the doctor "Medical Records" page, which read a table
-- nothing ever wrote to.
-- Apply after 20261019140000_prescriptions.sql.

-- 1. Sensible limits on what patients type into their profile.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_health_text_length;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_health_text_length CHECK (
  coalesce(char_length(allergies), 0) <= 1000
  AND coalesce(char_length(current_medications), 0) <= 1000
  AND coalesce(char_length(chronic_conditions), 0) <= 1000
  AND coalesce(char_length(emergency_contact), 0) <= 200
) NOT VALID;

-- Who may see a patient's record: the patient, or a verified doctor treating them.
CREATE OR REPLACE FUNCTION public.can_see_patient_record(p_patient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT (auth.uid() = p_patient_id AND public.get_auth_role() = 'patient')
      OR (public.is_verified_doctor() AND EXISTS (
            SELECT 1 FROM public.doctor_patient_assignments
            WHERE doctor_id = auth.uid() AND patient_id = p_patient_id AND is_active IS TRUE));
$function$;
REVOKE EXECUTE ON FUNCTION public.can_see_patient_record(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_patient_record(uuid) TO authenticated;

-- 2. The health profile, for the patient's doctors (patients read their own row directly).
CREATE OR REPLACE FUNCTION public.get_patient_record(p_patient_id uuid)
RETURNS TABLE (
  id uuid, name text, short_id text, email text, phone text, address text,
  date_of_birth date, gender text, blood_type text, height_cm numeric, weight_kg numeric,
  allergies text, current_medications text, chronic_conditions text, emergency_contact text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT p.id, p.name, p.short_id, p.email, p.phone, p.address,
         p.date_of_birth, p.gender, p.blood_type, p.height_cm, p.weight_kg,
         p.allergies, p.current_medications, p.chronic_conditions, p.emergency_contact
  FROM public.profiles p
  WHERE p.id = p_patient_id AND p.role = 'patient' AND public.can_see_patient_record(p_patient_id);
$function$;
REVOKE EXECUTE ON FUNCTION public.get_patient_record(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_patient_record(uuid) TO authenticated;

-- 3. One timeline across the patient's care, newest first. ref_id points at the report
--    (for reports and reviews), the prescription, the appointment or the care link.
CREATE OR REPLACE FUNCTION public.get_patient_timeline(p_patient_id uuid)
RETURNS TABLE (kind text, ref_id uuid, happened_at timestamptz, title text, detail text, doctor_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT t.kind, t.ref_id, t.happened_at, t.title, t.detail, t.doctor_name
  FROM (
    SELECT 'report'::text, r.id, r.uploaded_at, initcap(replace(r.test_type, '_', ' ')) || ' report', NULL::text, d.name
    FROM public.reports r LEFT JOIN public.profiles d ON d.id = r.doctor_id
    WHERE r.patient_id = p_patient_id
    UNION ALL
    SELECT 'review', rr.report_id, rr.updated_at, initcap(replace(r.test_type, '_', ' ')) || ' report reviewed', rr.patient_note, d.name
    FROM public.report_reviews rr
    JOIN public.reports r ON r.id = rr.report_id
    LEFT JOIN public.profiles d ON d.id = rr.doctor_id
    WHERE r.patient_id = p_patient_id
    UNION ALL
    SELECT 'prescription', p.id, p.created_at,
           'Prescription: ' || (SELECT string_agg(i->>'medicine', ', ') FROM jsonb_array_elements(p.items) AS i),
           p.diagnosis, p.doctor_name
    FROM public.prescriptions p
    WHERE p.patient_id = p_patient_id AND p.status = 'active'
    UNION ALL
    SELECT 'consultation', a.id, (a.appointment_date + a.start_time)::timestamptz,
           CASE a.status WHEN 'completed' THEN 'Consultation' ELSE 'Upcoming consultation' END,
           a.diagnosis, a.doctor_name
    FROM public.appointments a
    WHERE a.patient_id = p_patient_id AND a.status IN ('completed', 'confirmed')
    UNION ALL
    SELECT 'care', dpa.id, dpa.assigned_at, 'Started seeing ' || coalesce(d.name, 'a doctor'), NULL, d.name
    FROM public.doctor_patient_assignments dpa LEFT JOIN public.profiles d ON d.id = dpa.doctor_id
    WHERE dpa.patient_id = p_patient_id
    UNION ALL
    SELECT 'care', dpa.id, dpa.updated_at, 'Care ended with ' || coalesce(d.name, 'a doctor'), NULL, d.name
    FROM public.doctor_patient_assignments dpa LEFT JOIN public.profiles d ON d.id = dpa.doctor_id
    WHERE dpa.patient_id = p_patient_id AND dpa.is_active IS FALSE
  ) AS t(kind, ref_id, happened_at, title, detail, doctor_name)
  WHERE public.can_see_patient_record(p_patient_id)
  ORDER BY t.happened_at DESC NULLS LAST
  LIMIT 200;
$function$;
REVOKE EXECUTE ON FUNCTION public.get_patient_timeline(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_patient_timeline(uuid) TO authenticated;
