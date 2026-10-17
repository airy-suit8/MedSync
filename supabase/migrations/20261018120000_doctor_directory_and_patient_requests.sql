-- Patients can find doctors and ask for a consultation; a patient can have several
-- doctors; either side can end the care relationship. Approved 2026-10-18.
--
--   doctor publishes what they treat and what to share   -> profiles.expertise, share_before
--   patient picks a doctor and sends a request           -> appointment 'requested'
--   doctor accepts                                       -> 'confirmed' + doctor_patient_assignments
--   doctor declines / patient withdraws                  -> 'cancelled'
--   patient or doctor ends care                          -> assignment is_active = false
--
-- The database already allowed several doctors per patient (assignments are unique per
-- doctor-patient pair). Every linked doctor keeps seeing all of the patient's reports.
-- Apply after 20261017120000_lab_verification_and_read_receipts.sql and before the
-- matching app deploy.

-- 1. Doctors' public profile: what they treat and what a patient should share first.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS expertise text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS share_before text;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_expertise_length;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_expertise_length CHECK (char_length(expertise) <= 600);
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_share_before_length;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_share_before_length CHECK (char_length(share_before) <= 400);

-- 2. Directory: same rows as 20261017120000 section 3, with the two profile columns added
--    at the end (a view can only gain columns at the end).
CREATE OR REPLACE VIEW public.profile_directory
WITH (security_barrier = true, security_invoker = false)
AS
SELECT p.id, p.name, p.role, p.short_id, p.specialty, p.lab_name, p.online, p.last_seen,
       p.expertise, p.share_before
FROM public.profiles p
WHERE p.id = auth.uid()
   OR (p.role IN ('doctor', 'lab') AND p.verified)
   OR (SELECT public.is_verified_lab())
   OR (SELECT public.is_verified_doctor());

REVOKE ALL ON public.profile_directory FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.profile_directory TO authenticated;

-- 3. A 'requested' appointment is the patient's consent: accepting it links the doctor.
--    So only the patient can create one (through request_consultation), nobody can turn
--    another appointment into one, and nobody can re-point an appointment at a different
--    patient or doctor. Server/dashboard calls have no auth.uid() and are allowed.
CREATE OR REPLACE FUNCTION public.guard_appointment_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF NEW.status = 'requested' AND auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM NEW.patient_id THEN
    RAISE EXCEPTION 'Only the patient can request a consultation' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.guard_appointment_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_appointment_insert ON public.appointments;
CREATE TRIGGER guard_appointment_insert
BEFORE INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.guard_appointment_insert();

-- Same rules as 20261004121000 section 9, plus: parties are fixed; the doctor answers a
-- patient's request; the patient can withdraw it.
CREATE OR REPLACE FUNCTION public.guard_appointment_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.patient_id IS DISTINCT FROM OLD.patient_id OR NEW.doctor_id IS DISTINCT FROM OLD.doctor_id THEN
    RAISE EXCEPTION 'An appointment''s patient and doctor cannot be changed' USING ERRCODE = '42501';
  END IF;
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status = 'requested' THEN
    RAISE EXCEPTION 'Only the patient can request a consultation' USING ERRCODE = '42501';
  END IF;
  IF OLD.status = 'requested' THEN
    IF caller = OLD.doctor_id AND NEW.status IN ('confirmed', 'cancelled') THEN
      RETURN NEW;
    END IF;
    IF caller = OLD.patient_id AND NEW.status = 'cancelled' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'The doctor answers a consultation request; the patient can only withdraw it' USING ERRCODE = '42501';
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
BEFORE UPDATE OF status, patient_id, doctor_id ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.guard_appointment_status();

-- 4. Patient asks a verified doctor for a consultation (one open request per doctor).
CREATE OR REPLACE FUNCTION public.request_consultation(p_doctor_id uuid, p_date date, p_time time, p_reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_patient public.profiles%ROWTYPE;
  v_doctor public.profiles%ROWTYPE;
  v_reason text := nullif(left(trim(p_reason), 1000), '');
  v_id uuid;
BEGIN
  SELECT * INTO v_patient FROM public.profiles WHERE id = auth.uid() AND role = 'patient';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only patients can request a consultation' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_doctor FROM public.profiles WHERE id = p_doctor_id AND role = 'doctor' AND verified;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This doctor is not taking requests' USING ERRCODE = '42501';
  END IF;
  IF p_date IS NULL OR p_time IS NULL OR p_date < current_date THEN
    RAISE EXCEPTION 'Choose a date from today onwards' USING ERRCODE = '22023';
  END IF;
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Tell the doctor what you need help with' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.appointments
             WHERE patient_id = v_patient.id AND doctor_id = v_doctor.id AND status = 'requested') THEN
    RAISE EXCEPTION 'You already have a request waiting with this doctor' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.appointments (doctor_id, patient_id, patient_name, doctor_name, appointment_date,
    start_time, end_time, duration_minutes, appointment_type, consultation_type, status, symptoms)
  VALUES (v_doctor.id, v_patient.id, v_patient.name, v_doctor.name, p_date,
    p_time, p_time + interval '30 minutes', 30, 'consultation', 'video', 'requested', v_reason)
  RETURNING id INTO v_id;

  INSERT INTO public.notifications (user_id, title, message, notification_type, related_id, related_type, target_role, action_url)
  VALUES (v_doctor.id, 'New consultation request',
    coalesce(v_patient.name, 'A patient') || ' asked for a consultation on ' || to_char(p_date, 'DD Mon YYYY') || '.',
    'consultation_request', v_id, 'appointment', 'doctor', '/doctor-dashboard');

  RETURN v_id;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.request_consultation(uuid, date, time, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_consultation(uuid, date, time, text) TO authenticated;

-- 5. The doctor accepts (links the patient, like respond_to_appointment) or declines.
CREATE OR REPLACE FUNCTION public.respond_to_consultation_request(p_appointment_id uuid, p_accept boolean)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  a public.appointments%ROWTYPE;
BEGIN
  SELECT * INTO a FROM public.appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND OR a.doctor_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Request not found' USING ERRCODE = 'P0002';
  END IF;
  IF a.status IS DISTINCT FROM 'requested' THEN
    RAISE EXCEPTION 'This request has already been answered' USING ERRCODE = '22023';
  END IF;

  IF NOT p_accept THEN
    UPDATE public.appointments SET status = 'cancelled', updated_at = now() WHERE id = a.id;
    INSERT INTO public.notifications (user_id, title, message, notification_type, related_id, related_type, target_role, action_url)
    VALUES (a.patient_id, 'Consultation request declined',
      coalesce(a.doctor_name, 'The doctor') || ' could not take your request. You can ask another doctor.',
      'general', a.id, 'appointment', 'patient', '/patient-dashboard/doctors');
    RETURN 'cancelled';
  END IF;

  IF NOT public.is_verified_doctor() THEN
    RAISE EXCEPTION 'Only verified doctors can accept patients' USING ERRCODE = '42501';
  END IF;

  UPDATE public.appointments SET status = 'confirmed', updated_at = now() WHERE id = a.id;
  INSERT INTO public.doctor_patient_assignments (doctor_id, patient_id, is_active)
  SELECT a.doctor_id, a.patient_id, true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.doctor_patient_assignments
    WHERE doctor_id = a.doctor_id AND patient_id = a.patient_id AND is_active
  )
  ON CONFLICT DO NOTHING;
  INSERT INTO public.notifications (user_id, title, message, notification_type, related_id, related_type, target_role, action_url)
  VALUES (a.patient_id, 'Consultation confirmed',
    coalesce(a.doctor_name, 'Your doctor') || ' accepted your request for ' || to_char(a.appointment_date, 'DD Mon YYYY') || '.',
    'general', a.id, 'appointment', 'patient', '/patient-dashboard/doctors');
  RETURN 'confirmed';
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.respond_to_consultation_request(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_consultation_request(uuid, boolean) TO authenticated;

-- 6. The patient withdraws a request the doctor hasn't answered yet.
CREATE OR REPLACE FUNCTION public.withdraw_consultation_request(p_appointment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  UPDATE public.appointments SET status = 'cancelled', updated_at = now()
  WHERE id = p_appointment_id AND patient_id = auth.uid() AND status = 'requested';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found' USING ERRCODE = 'P0002';
  END IF;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.withdraw_consultation_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.withdraw_consultation_request(uuid) TO authenticated;

-- 7. Either side ends care: the doctor loses access to the patient's reports and AI
--    results (every report policy checks for an active assignment). Messages and past
--    records stay. The (doctor, patient, is_active) unique key allows one inactive row
--    per pair, so the older one is replaced.
CREATE OR REPLACE FUNCTION public.end_care(p_other_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_role text := public.get_auth_role();
  v_doctor uuid;
  v_patient uuid;
  v_name text;
BEGIN
  IF v_role = 'patient' THEN
    v_doctor := p_other_id; v_patient := auth.uid();
  ELSIF v_role = 'doctor' THEN
    v_doctor := auth.uid(); v_patient := p_other_id;
  ELSE
    RAISE EXCEPTION 'Only patients and doctors can end care' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.doctor_patient_assignments
                 WHERE doctor_id = v_doctor AND patient_id = v_patient AND is_active IS TRUE) THEN
    RAISE EXCEPTION 'You are not linked to this person' USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.doctor_patient_assignments
  WHERE doctor_id = v_doctor AND patient_id = v_patient AND is_active IS FALSE;
  UPDATE public.doctor_patient_assignments SET is_active = false, updated_at = now()
  WHERE doctor_id = v_doctor AND patient_id = v_patient AND is_active IS TRUE;

  SELECT name INTO v_name FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.notifications (user_id, title, message, notification_type, target_role, action_url)
  VALUES (p_other_id, 'Care ended',
    CASE WHEN v_role = 'patient'
         THEN coalesce(v_name, 'A patient') || ' ended your access to their records.'
         ELSE coalesce(v_name, 'Your doctor') || ' ended your care. Your records stay in your account.' END,
    'general',
    CASE WHEN v_role = 'patient' THEN 'doctor' ELSE 'patient' END,
    CASE WHEN v_role = 'patient' THEN '/doctor-dashboard/patients' ELSE '/patient-dashboard/doctors' END);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.end_care(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.end_care(uuid) TO authenticated;
