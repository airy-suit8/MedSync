-- No new appointments with a closed account (found in the 2026-10-18 audit). Closed
-- doctors are hidden from the directory, but a request or a booking could still name
-- one by id, and it would wait forever. Every appointment, a patient's request or a
-- doctor's booking, comes through this insert guard, so the check lives here. Runs as
-- definer so it can see both parties' profiles whoever is inserting. Otherwise
-- identical to 20261018120000.
CREATE OR REPLACE FUNCTION public.guard_appointment_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.status = 'requested' AND auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM NEW.patient_id THEN
    RAISE EXCEPTION 'Only the patient can request a consultation' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.doctor_id AND closed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'This doctor is not taking requests' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.patient_id AND closed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'This patient''s account is closed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.guard_appointment_insert() FROM PUBLIC, anon, authenticated;
