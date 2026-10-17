-- Notifications inbox for doctors, patients and labs. Approved 2026-10-18.
--
-- The app has written notifications all along (uploads, AI readings, reviews,
-- prescriptions, consultation requests) but only doctors had a page for them, and nothing
-- linked to it. Every role now has a bell with an unread count and an inbox. The bell
-- updates live, so notifications join the realtime publication; RLS ("read own")
-- limits each user to their own rows.
-- Apply after 20261019150000_health_record.sql.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id, created_at DESC) WHERE is_read IS NOT TRUE;

-- Appointment events nobody was told about: a doctor scheduling a patient (the patient
-- only found out by visiting their dashboard), the patient confirming or declining, and
-- a consultation being completed (its notes and prescriptions are then on the patient's
-- consultations page). Browsers can't create notifications, so this runs in the database.
-- Patient requests are notified by request_consultation / respond_to_consultation_request.
CREATE OR REPLACE FUNCTION public.notify_appointment_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_when text := to_char(NEW.appointment_date, 'DD Mon YYYY') || coalesce(' at ' || to_char(NEW.start_time, 'HH24:MI'), '');
  -- appointments.doctor_name/patient_name are typed by a browser; use the profiles.
  v_doctor text := (SELECT name FROM public.profiles WHERE id = NEW.doctor_id);
  v_patient text := (SELECT name FROM public.profiles WHERE id = NEW.patient_id);
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'scheduled' THEN
    INSERT INTO public.notifications (user_id, title, message, notification_type, related_id, related_type, target_role, action_url)
    VALUES (NEW.patient_id, 'Appointment request',
      coalesce(v_doctor, 'A doctor') || ' asked to see you on ' || v_when || '. Confirm or decline it on your dashboard.',
      'appointment_reminder', NEW.id, 'appointment', 'patient', '/patient-dashboard');
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'scheduled' AND NEW.status IN ('confirmed', 'cancelled')
        AND auth.uid() = NEW.patient_id THEN
    INSERT INTO public.notifications (user_id, title, message, notification_type, related_id, related_type, target_role, action_url)
    VALUES (NEW.doctor_id,
      CASE NEW.status WHEN 'confirmed' THEN 'Appointment confirmed' ELSE 'Appointment declined' END,
      coalesce(v_patient, 'Your patient') || CASE NEW.status WHEN 'confirmed' THEN ' confirmed ' ELSE ' declined ' END
        || 'the appointment on ' || v_when || '.',
      'appointment_reminder', NEW.id, 'appointment', 'doctor', '/doctor-dashboard/schedule');
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    INSERT INTO public.notifications (user_id, title, message, notification_type, related_id, related_type, target_role, action_url)
    VALUES (NEW.patient_id, 'Consultation summary',
      'Your consultation with ' || coalesce(v_doctor, 'your doctor') || ' is complete. Notes and any prescription are on your consultations page.',
      'general', NEW.id, 'appointment', 'patient', '/patient-dashboard/video-consultations');
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.notify_appointment_events() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS notify_appointment_events ON public.appointments;
CREATE TRIGGER notify_appointment_events
AFTER INSERT OR UPDATE OF status ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.notify_appointment_events();
