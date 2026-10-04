-- Security fixes from docs/AUDIT_FINDINGS.md (Checkpoint 1, 2026-10-04).
-- Approved scope: security fixes only; no tables, columns or functions are dropped.
-- Apply this before deploying the matching app and ML-service changes.

-- C1: every signed-in user could read every message. Permissive policies are OR-ed,
-- so "read all" overrode the sender/receiver policy. All chat queries already filter
-- to the user's own conversations, and realtime follows RLS.
DROP POLICY IF EXISTS "Users can read all messages" ON public.messages;

-- H1: any signed-in user could create notifications for any user. Notifications are
-- created by server routes with the service role (which bypasses RLS), so the browser
-- needs no INSERT policy at all. Matches supabase/tests/rls_policies.test.sql.
DROP POLICY IF EXISTS "Anyone can insert notifications" ON public.notifications;

-- H3: fix mutable search_path on every app function in public (advisor
-- function_search_path_mutable). Keeps today's name resolution; extension-owned
-- functions are skipped. Functions redefined below get search_path = '' instead.
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions, pg_temp', f.sig);
  END LOOP;
END
$$;

-- C3: anyone (even signed-out callers holding the public anon key) could rewrite any
-- appointment's diagnosis, prescription, notes and status. Only the appointment's
-- doctor may update it now. Called by lib/appointment-utils.ts (doctor consultations).
CREATE OR REPLACE FUNCTION public.safe_appointment_update(appointment_id text, update_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  appointment_record public.appointments%ROWTYPE;
BEGIN
  SELECT * INTO appointment_record FROM public.appointments WHERE id::text = appointment_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Appointment not found', 'is_demo', false,
      'error', 'Appointment with ID ' || appointment_id || ' not found');
  END IF;

  IF auth.uid() IS NULL OR appointment_record.doctor_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Only the appointment''s doctor can update it',
      'is_demo', false, 'error', 'forbidden');
  END IF;

  UPDATE public.appointments
  SET status = coalesce(update_data->>'status', status),
      notes = coalesce(update_data->>'notes', notes),
      diagnosis = coalesce(update_data->>'diagnosis', diagnosis),
      prescription = coalesce(update_data->>'prescription', prescription),
      updated_at = now()
  WHERE id = appointment_record.id;

  RETURN jsonb_build_object('success', true, 'message', 'Appointment updated successfully', 'is_demo', false);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', 'Failed to update appointment', 'is_demo', false,
    'error', SQLERRM);
END;
$function$;

-- H2: doctors' "assigned patients" lists were always empty: this read the dropped
-- user_short_ids table and its EXCEPTION handler returned nothing. Same signature and
-- columns as before (still called by the doctor Reports and Medical Records pages),
-- now reading profiles, and only for the calling doctor.
CREATE OR REPLACE FUNCTION public.get_doctor_patients_bulletproof(doctor_uuid uuid)
RETURNS TABLE (
  patient_id uuid,
  patient_short_id text,
  patient_name text,
  patient_email text,
  assigned_at timestamp with time zone,
  total_reports bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT dpa.patient_id,
         p.short_id,
         coalesce(p.name, 'Unknown Patient'),
         p.email,
         dpa.assigned_at,
         (SELECT count(*) FROM public.reports r WHERE r.patient_id = dpa.patient_id)
  FROM public.doctor_patient_assignments dpa
  LEFT JOIN public.profiles p ON p.id = dpa.patient_id
  WHERE dpa.doctor_id = doctor_uuid
    AND doctor_uuid = auth.uid()
    AND dpa.is_active = true
  ORDER BY dpa.assigned_at DESC;
$function$;

-- H3: SECURITY DEFINER functions were executable by anon. Functions are executable by
-- PUBLIC by default, so revoke from PUBLIC as well as anon.
REVOKE EXECUTE ON FUNCTION public.get_auth_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_auth_short_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.lab_can_upload_patient_report(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.safe_appointment_update(text, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_doctor_patients_bulletproof(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_auth_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_short_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.lab_can_upload_patient_report(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.safe_appointment_update(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_doctor_patients_bulletproof(uuid) TO authenticated;

-- Not called by the app (kept, per "don't drop", but nobody outside the server can run them).
REVOKE EXECUTE ON FUNCTION public.get_doctor_reports_with_ml(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_doctor_id(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_patient_id(text) FROM PUBLIC, anon, authenticated;
-- Trigger functions never need to be called directly.
REVOKE EXECUTE ON FUNCTION public.ensure_patient_row_from_users() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.minimal_handle_new_user() FROM PUBLIC, anon, authenticated;

-- H7: dashboard gating will use the server-controlled app_metadata role instead of the
-- client-writable user_metadata role. handle_new_user already sets it for new signups;
-- this backfills the 9 accounts created before that fix.
UPDATE auth.users u
SET raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', p.role)
FROM public.profiles p
WHERE p.id = u.id
  AND p.role IS NOT NULL
  AND (u.raw_app_meta_data->>'role') IS DISTINCT FROM p.role;

-- H4: normal ML results are now severity 'none' (were mislabelled 'mild').
ALTER TABLE public.ml_suggestions DROP CONSTRAINT IF EXISTS ml_suggestions_severity_check;
ALTER TABLE public.ml_suggestions ADD CONSTRAINT ml_suggestions_severity_check
  CHECK (severity = ANY (ARRAY['none', 'mild', 'moderate', 'severe', 'critical', 'unknown']));
