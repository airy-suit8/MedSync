-- ============================================================
-- Consultation Meetings RLS Alignment Fix
-- ============================================================
-- Ensures doctor/patient access checks map to auth.users IDs.
-- Run in Supabase SQL Editor.

BEGIN;

ALTER TABLE public.consultation_meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Doctors can create meetings for their appointments" ON public.consultation_meetings;
DROP POLICY IF EXISTS "Users can view meetings for their appointments" ON public.consultation_meetings;
DROP POLICY IF EXISTS "Hosts can update their meetings" ON public.consultation_meetings;
DROP POLICY IF EXISTS "Hosts can manage meetings for their appointments" ON public.consultation_meetings;
DROP POLICY IF EXISTS "Doctors can create meetings for own appointments" ON public.consultation_meetings;
DROP POLICY IF EXISTS "Participants can view own appointment meetings" ON public.consultation_meetings;

-- Doctors can create meetings when they own the related appointment.
-- Supports appointments.doctor_id storing either doctors.id or auth.users.id.
CREATE POLICY "Doctors can create meetings for own appointments"
ON public.consultation_meetings
FOR INSERT
TO authenticated
WITH CHECK (
  host_id = auth.uid()
  AND appointment_id IN (
    SELECT a.id
    FROM public.appointments a
    LEFT JOIN public.doctors d ON d.id::text = a.doctor_id::text
    WHERE a.id = consultation_meetings.appointment_id
      AND (
        a.doctor_id::text = auth.uid()::text
        OR d.user_id = auth.uid()
      )
  )
);

-- Doctors/patients can view meetings for their own appointments.
CREATE POLICY "Participants can view own appointment meetings"
ON public.consultation_meetings
FOR SELECT
TO authenticated
USING (
  host_id = auth.uid()
  OR appointment_id IN (
    SELECT a.id
    FROM public.appointments a
    LEFT JOIN public.doctors d ON d.id::text = a.doctor_id::text
    LEFT JOIN public.patients p ON p.id::text = a.patient_id::text
    WHERE a.id = consultation_meetings.appointment_id
      AND (
        a.doctor_id::text = auth.uid()::text
        OR d.user_id = auth.uid()
        OR a.patient_id::text = auth.uid()::text
        OR p.user_id = auth.uid()
      )
  )
);

-- Only host can update meeting lifecycle fields.
CREATE POLICY "Host can update own meetings"
ON public.consultation_meetings
FOR UPDATE
TO authenticated
USING (host_id = auth.uid())
WITH CHECK (host_id = auth.uid());

COMMIT;
