-- Closing an account, and how long medical records are kept. Decided 2026-10-18.
--
-- Anyone can close their account (Account, in their dashboard). It takes effect at once:
-- they can't sign in, they leave the doctor and lab directories, their contact details
-- are deleted, care links end and upcoming appointments are cancelled, with the other
-- side told.
--
-- A patient's medical records stay for 3 years after their last report, consultation or
-- prescription; then an admin deletes the account and its files for good
-- (admin_purge_patient, run from the admin dashboard through /api/admin/purge). Basis:
-- the Indian Medical Council (Professional Conduct, Etiquette and Ethics) Regulations,
-- 2002, reg. 1.3.1 (records kept for 3 years), which the Telemedicine Practice Guidelines
-- 2020 apply to teleconsultations; the DPDP Act 2023, s. 8(7), lets a data fiduciary keep
-- data that a law requires it to keep. A patient with no medical records can be deleted
-- straight away.
--
-- Doctor and lab accounts are closed, never deleted: their reviews and prescriptions are
-- part of their patients' records and keep the name and registration number.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS closed_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS delete_after timestamptz;   -- patients only

-- Only the functions below change these. (Replaces the version in 20261020120000.)
CREATE OR REPLACE FUNCTION public.prevent_profile_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  IF current_user IN ('anon', 'authenticated') AND (
       OLD.role IS DISTINCT FROM NEW.role
       OR OLD.verified IS DISTINCT FROM NEW.verified
       OR OLD.verification_note IS DISTINCT FROM NEW.verification_note
       OR OLD.verification_reviewed_at IS DISTINCT FROM NEW.verification_reviewed_at
       OR OLD.closed_at IS DISTINCT FROM NEW.closed_at
       OR OLD.delete_after IS DISTINCT FROM NEW.delete_after
       OR (OLD.verified AND (OLD.name IS DISTINCT FROM NEW.name
                             OR OLD.license_number IS DISTINCT FROM NEW.license_number
                             OR OLD.medical_council IS DISTINCT FROM NEW.medical_council
                             OR OLD.qualification IS DISTINCT FROM NEW.qualification))
     ) THEN
    RAISE EXCEPTION 'Profile roles and verification can only be changed by a trusted server'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS prevent_profile_role_change ON public.profiles;
CREATE TRIGGER prevent_profile_role_change
BEFORE UPDATE OF role, verified, name, license_number, medical_council, qualification,
                 verification_note, verification_reviewed_at, closed_at, delete_after ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_role_change();

-- A closed doctor or lab account loses its access even if an old sign-in lingers.
CREATE OR REPLACE FUNCTION public.is_verified_doctor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT coalesce((SELECT verified AND closed_at IS NULL FROM public.profiles WHERE id = auth.uid() AND role = 'doctor'), false);
$function$;

CREATE OR REPLACE FUNCTION public.is_verified_lab()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT coalesce((SELECT verified AND closed_at IS NULL FROM public.profiles WHERE id = auth.uid() AND role = 'lab'), false);
$function$;

-- Closing an account cancels its upcoming appointments, whatever their status. Only
-- close_my_account sets medsync.closing_account (a transaction setting clients can't
-- set). Otherwise identical to 20261018120000.
CREATE OR REPLACE FUNCTION public.guard_appointment_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL OR current_setting('medsync.closing_account', true) = 'on' THEN
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

-- Close the caller's own account. Returns when a patient's records will be deleted
-- (null for doctors and labs).
CREATE OR REPLACE FUNCTION public.close_my_account()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_me public.profiles;
  v_last timestamptz;
  v_delete_after timestamptz;
  v_name text;
BEGIN
  SELECT * INTO v_me FROM public.profiles WHERE id = auth.uid();
  IF v_me.id IS NULL THEN
    RAISE EXCEPTION 'No account to close' USING ERRCODE = '42501';
  END IF;
  IF v_me.role = 'admin' THEN
    RAISE EXCEPTION 'Admin accounts are changed from the SQL editor' USING ERRCODE = '22023';
  END IF;
  IF v_me.closed_at IS NOT NULL THEN
    RETURN v_me.delete_after;
  END IF;
  v_name := coalesce(v_me.name, 'Someone');

  IF v_me.role = 'patient' THEN
    SELECT max(t) INTO v_last FROM (
      SELECT max(r.uploaded_at) AS t FROM public.reports r WHERE r.patient_id = v_me.id
      UNION ALL
      SELECT max((a.appointment_date + a.start_time)::timestamptz) FROM public.appointments a
      WHERE a.patient_id = v_me.id AND a.status = 'completed'
      UNION ALL
      SELECT max(p.created_at) FROM public.prescriptions p WHERE p.patient_id = v_me.id
    ) s;
    v_delete_after := greatest(coalesce(v_last + interval '3 years', now()), now());
  END IF;

  -- Tell the people on the other side, then end care and cancel what's coming up.
  IF v_me.role = 'patient' THEN
    INSERT INTO public.notifications (user_id, title, message, notification_type, target_role, action_url)
    SELECT DISTINCT d.doctor_id, 'A patient closed their account',
           v_name || ' closed their MedSync account. You no longer have access to their records, and any upcoming appointments with them are cancelled.',
           'system_notification', 'doctor', '/doctor-dashboard/patients'
    FROM (
      SELECT doctor_id FROM public.doctor_patient_assignments WHERE patient_id = v_me.id AND is_active
      UNION
      SELECT doctor_id FROM public.appointments
      WHERE patient_id = v_me.id AND status IN ('requested', 'scheduled', 'confirmed') AND appointment_date >= current_date
    ) d;
  ELSIF v_me.role = 'doctor' THEN
    INSERT INTO public.notifications (user_id, title, message, notification_type, target_role, action_url)
    SELECT DISTINCT p.patient_id, 'Your doctor left MedSync',
           v_name || ' closed their MedSync account. Any upcoming appointments with them are cancelled. Your records stay with you; you can choose another doctor.',
           'system_notification', 'patient', '/patient-dashboard/doctors'
    FROM (
      SELECT patient_id FROM public.doctor_patient_assignments WHERE doctor_id = v_me.id AND is_active
      UNION
      SELECT patient_id FROM public.appointments
      WHERE doctor_id = v_me.id AND status IN ('requested', 'scheduled', 'confirmed') AND appointment_date >= current_date
    ) p;
  END IF;

  PERFORM set_config('medsync.closing_account', 'on', true);
  UPDATE public.appointments SET status = 'cancelled', updated_at = now()
  WHERE (patient_id = v_me.id OR doctor_id = v_me.id)
    AND status IN ('requested', 'scheduled', 'confirmed') AND appointment_date >= current_date;
  PERFORM set_config('medsync.closing_account', 'off', true);
  UPDATE public.doctor_patient_assignments SET is_active = false, updated_at = now()
  WHERE (patient_id = v_me.id OR doctor_id = v_me.id) AND is_active;

  -- Contact details go now; what identifies the medical records stays with them.
  UPDATE public.profiles
  SET closed_at = now(), delete_after = v_delete_after, online = false,
      phone = NULL, address = NULL, emergency_contact = NULL,
      expertise = CASE WHEN role = 'doctor' THEN NULL ELSE expertise END,
      share_before = CASE WHEN role = 'doctor' THEN NULL ELSE share_before END
  WHERE id = v_me.id;

  -- No more signing in, here or on other devices.
  UPDATE auth.users SET banned_until = 'infinity' WHERE id = v_me.id;
  BEGIN
    DELETE FROM auth.sessions WHERE user_id = v_me.id;
  EXCEPTION WHEN insufficient_privilege OR undefined_table THEN
    NULL; -- the ban still stops new sign-ins
  END;

  INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, details)
  VALUES (v_me.id, 'update', 'profiles', v_me.id, jsonb_build_object('event', 'account_closed', 'delete_after', v_delete_after));

  RETURN v_delete_after;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.close_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_my_account() TO authenticated;

-- An admin can reopen a closed account (for example, closed by mistake). Contact
-- details and care links don't come back.
CREATE OR REPLACE FUNCTION public.admin_reopen_account(p_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  UPDATE public.profiles SET closed_at = NULL, delete_after = NULL WHERE id = p_user AND closed_at IS NOT NULL;
  IF FOUND THEN
    UPDATE auth.users SET banned_until = NULL WHERE id = p_user;
    INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, details)
    VALUES (auth.uid(), 'update', 'profiles', p_user, '{"event": "account_reopened"}'::jsonb);
  END IF;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.admin_reopen_account(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reopen_account(uuid) TO authenticated;

-- Permanently delete a closed patient account whose retention period is over. Returns
-- the storage paths of its files (by bucket); /api/admin/purge removes them afterwards.
-- Any table this misses makes the delete fail as a whole, so nothing is half-deleted.
CREATE OR REPLACE FUNCTION public.admin_purge_patient(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_p public.profiles;
  v_files jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_p FROM public.profiles WHERE id = p_user;
  IF v_p.id IS NULL OR v_p.role <> 'patient' OR v_p.closed_at IS NULL OR v_p.delete_after IS NULL OR v_p.delete_after > now() THEN
    RAISE EXCEPTION 'Only closed patient accounts past their retention date can be deleted' USING ERRCODE = '22023';
  END IF;

  v_files := jsonb_build_object(
    'reports', (SELECT coalesce(jsonb_agg(DISTINCT f), '[]'::jsonb) FROM (
                  SELECT unnest(ARRAY[r.file_name, r.original_image_url, r.masked_image_url, r.overlayed_image_url]) AS f
                  FROM public.reports r WHERE r.patient_id = p_user) s
                WHERE f IS NOT NULL AND f !~ '^https?://'),
    'review-notes', (SELECT coalesce(jsonb_agg(rr.note_image_path), '[]'::jsonb)
                     FROM public.report_reviews rr JOIN public.reports r ON r.id = rr.report_id
                     WHERE r.patient_id = p_user AND rr.note_image_path IS NOT NULL),
    'imaging', (SELECT coalesce(jsonb_agg(f), '[]'::jsonb)
                FROM public.imaging_studies i, unnest(i.file_paths) AS f WHERE i.patient_id = p_user));

  DELETE FROM public.video_call_messages WHERE sender_id = p_user;
  DELETE FROM public.video_call_logs WHERE user_id = p_user;
  DELETE FROM public.video_call_sessions WHERE patient_id = p_user;
  DELETE FROM public.ml_suggestions
  WHERE patient_id = p_user OR report_id IN (SELECT id FROM public.reports WHERE patient_id = p_user);
  DELETE FROM public.prescriptions WHERE patient_id = p_user;
  DELETE FROM public.reports WHERE patient_id = p_user;                    -- reviews and their notes go with them
  DELETE FROM public.appointments WHERE patient_id = p_user;               -- and their call meetings
  DELETE FROM public.doctor_patient_assignments WHERE patient_id = p_user;
  DELETE FROM public.lab_samples WHERE patient_id = p_user;
  DELETE FROM public.imaging_studies WHERE patient_id = p_user;
  DELETE FROM public.messages WHERE sender_id = p_user OR receiver_id = p_user;
  DELETE FROM public.notifications WHERE user_id = p_user;

  INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, details)
  VALUES (auth.uid(), 'delete', 'profiles', p_user, jsonb_build_object('event', 'account_deleted', 'short_id', v_p.short_id));

  DELETE FROM auth.users WHERE id = p_user;                                -- the profile and the rest cascade
  RETURN v_files;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.admin_purge_patient(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_purge_patient(uuid) TO authenticated;

-- Admin lists and counts know about closed accounts. (Replace the versions in
-- 20261020120000; the account list gains two columns, so it is dropped first.)
CREATE OR REPLACE FUNCTION public.admin_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT jsonb_build_object(
      'patients',     count(*) FILTER (WHERE p.role = 'patient' AND p.closed_at IS NULL),
      'doctors',      count(*) FILTER (WHERE p.role = 'doctor' AND p.verified AND p.closed_at IS NULL),
      'labs',         count(*) FILTER (WHERE p.role = 'lab' AND p.verified AND p.closed_at IS NULL),
      'pending',      count(*) FILTER (WHERE p.role IN ('doctor', 'lab') AND NOT p.verified AND p.verification_reviewed_at IS NULL AND p.closed_at IS NULL),
      'turned_down',  count(*) FILTER (WHERE p.role IN ('doctor', 'lab') AND NOT p.verified AND p.verification_reviewed_at IS NOT NULL AND p.closed_at IS NULL),
      'closed',       count(*) FILTER (WHERE p.closed_at IS NOT NULL),
      'due_for_deletion', count(*) FILTER (WHERE p.role = 'patient' AND p.closed_at IS NOT NULL AND p.delete_after <= now()),
      'unconfirmed',  (SELECT count(*) FROM auth.users u WHERE u.email_confirmed_at IS NULL),
      'reports_week', (SELECT count(*) FROM public.reports r WHERE r.uploaded_at > now() - interval '7 days'),
      'ai_failed_week', (SELECT count(*) FROM public.reports r WHERE r.ai_status = 'failed' AND r.uploaded_at > now() - interval '7 days'),
      'open_invites', (SELECT count(*) FROM public.signup_codes c WHERE c.used_at IS NULL AND c.revoked_at IS NULL AND c.expires_at > now())
    )
    FROM public.profiles p
  );
END;
$function$;

DROP FUNCTION IF EXISTS public.admin_list_accounts();
CREATE FUNCTION public.admin_list_accounts()
RETURNS TABLE (
  id uuid, name text, email text, role text, short_id text,
  verified boolean, license_number text, medical_council text, qualification text, specialty text,
  verification_note text, verification_reviewed_at timestamptz,
  email_confirmed boolean, created_at timestamptz, last_sign_in_at timestamptz, invite_code text,
  closed_at timestamptz, delete_after timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT p.id, p.name, coalesce(u.email, p.email)::text, p.role, p.short_id,
         p.verified, p.license_number, p.medical_council, p.qualification, p.specialty,
         p.verification_note, p.verification_reviewed_at,
         u.email_confirmed_at IS NOT NULL, coalesce(u.created_at, p.created_at), u.last_sign_in_at,
         (SELECT c.code FROM public.signup_codes c WHERE c.used_by = p.id LIMIT 1),
         p.closed_at, p.delete_after
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  ORDER BY coalesce(u.created_at, p.created_at) DESC NULLS LAST
  LIMIT 1000;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.admin_list_accounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_accounts() TO authenticated;

-- Closed accounts leave the directory. (Replaces the view in 20261020120000.)
CREATE OR REPLACE VIEW public.profile_directory
WITH (security_barrier = true, security_invoker = false)
AS
SELECT p.id, p.name, p.role, p.short_id, p.specialty, p.lab_name, p.online, p.last_seen,
       p.expertise, p.share_before,
       CASE WHEN p.role IN ('doctor', 'lab') THEN p.license_number END AS license_number,
       CASE WHEN p.role = 'doctor' THEN p.medical_council END AS medical_council,
       CASE WHEN p.role = 'doctor' THEN p.qualification END AS qualification
FROM public.profiles p
WHERE p.id = auth.uid()
   OR (p.closed_at IS NULL AND (
         (p.role IN ('doctor', 'lab') AND p.verified)
         OR (SELECT public.is_verified_lab())
         OR (SELECT public.is_verified_doctor())));

REVOKE ALL ON public.profile_directory FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.profile_directory TO authenticated;
