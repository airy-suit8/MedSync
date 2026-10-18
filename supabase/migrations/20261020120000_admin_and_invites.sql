-- Admin dashboard, invite codes and fuller registration details. Approved 2026-10-18.
--
-- 1. Doctors give their State Medical Council and qualification at sign-up, next to the
--    registration number; patients see all three (the Telemedicine Practice Guidelines
--    2020 ask platforms to show each practitioner's name, qualification and registration
--    number, and to check them before listing).
-- 2. Invite codes: an admin creates single-use codes for doctors or labs whose
--    registration they have checked. Signing up with a valid code verifies the account at
--    once. Without one, the account waits for an admin, and admins are notified.
-- 3. Admins (profiles.role = 'admin', set only from the SQL editor with promote_to_admin)
--    manage accounts through the admin_* functions below. They see account details and
--    counts, never reports, notes or prescriptions.

-- 1. Registration details and the outcome of an admin's review
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS medical_council text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS qualification text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verification_note text;          -- why it was turned down
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verification_reviewed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_registration_text_length') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_registration_text_length CHECK (
      char_length(coalesce(medical_council, '')) <= 80
      AND char_length(coalesce(qualification, '')) <= 120
      AND char_length(coalesce(verification_note, '')) <= 500);
  END IF;
END $$;

-- What the team checked stays fixed once verified, and only the server or an admin
-- function can change verification. (Replaces the version in 20261004121000.)
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
                 verification_note, verification_reviewed_at ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_role_change();

-- 2. Invite codes (XXXX-XXXX-XXXX, 60 random bits). Only the functions below touch them.
CREATE TABLE IF NOT EXISTS public.signup_codes (
  code        text PRIMARY KEY CHECK (code ~ '^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$'),
  role        text NOT NULL CHECK (role IN ('doctor', 'lab')),
  email       text CHECK (email IS NULL OR char_length(email) <= 254),   -- only this email may use it
  note        text CHECK (note IS NULL OR char_length(note) <= 200),     -- e.g. who it was given to
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  used_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  used_at     timestamptz,
  revoked_at  timestamptz
);
ALTER TABLE public.signup_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.signup_codes FROM PUBLIC, anon, authenticated;

-- "abcd efgh-ijkl" -> "ABCD-EFGH-IJKL"; anything else -> NULL.
CREATE OR REPLACE FUNCTION public.normalize_signup_code(p_code text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $function$
  SELECT CASE WHEN char_length(c) = 12 THEN substr(c, 1, 4) || '-' || substr(c, 5, 4) || '-' || substr(c, 9, 4) END
  FROM (SELECT upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')) AS c) s;
$function$;

-- Twelve characters from a 32-letter alphabet without look-alikes (no 0/O, 1/I), taken
-- from the random bytes of a v4 UUID (skipping its fixed version and variant bytes).
CREATE OR REPLACE FUNCTION public.new_signup_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = ''
AS $function$
DECLARE
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_positions constant int[] := ARRAY[0, 1, 2, 3, 4, 5, 7, 9, 10, 11, 12, 13];
  v_bytes bytea := uuid_send(gen_random_uuid());
  v_code text := '';
BEGIN
  FOR i IN 1..12 LOOP
    v_code := v_code || substr(v_alphabet, 1 + get_byte(v_bytes, v_positions[i]) % 32, 1);
    IF i IN (4, 8) THEN v_code := v_code || '-'; END IF;
  END LOOP;
  RETURN v_code;
END;
$function$;
REVOKE ALL ON FUNCTION public.new_signup_code() FROM PUBLIC, anon, authenticated;

-- Lets the sign-up form say "this code won't work" before creating the account. It
-- reveals only yes or no, and guessing a code means searching 2^60 of them.
CREATE OR REPLACE FUNCTION public.signup_code_is_valid(p_code text, p_role text, p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.signup_codes c
    WHERE c.code = public.normalize_signup_code(p_code)
      AND c.role = p_role
      AND c.used_at IS NULL AND c.revoked_at IS NULL AND c.expires_at > now()
      AND (c.email IS NULL OR lower(c.email) = lower(trim(coalesce(p_email, ''))))
  );
$function$;
REVOKE ALL ON FUNCTION public.signup_code_is_valid(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.signup_code_is_valid(text, text, text) TO anon, authenticated;

-- 3. Sign-up: store the registration details; a valid invite code verifies the account
--    (claimed with a row lock, so one code makes one account); otherwise tell the admins.
--    (Replaces the version in 20261017120000.)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_role text;
  v_name text;
  v_short_id text;
  v_license text;
  v_council text;
  v_qualification text;
  v_code text;
  v_invited boolean;
  v_app_metadata jsonb;
BEGIN
  v_role := coalesce(NEW.raw_user_meta_data->>'role', 'patient');
  IF v_role NOT IN ('patient', 'doctor', 'lab') THEN
    v_role := 'patient';
  END IF;
  v_name := coalesce(NEW.raw_user_meta_data->>'name', 'Unknown User');
  v_license := CASE WHEN v_role IN ('doctor', 'lab')
                    THEN nullif(left(trim(NEW.raw_user_meta_data->>'license_number'), 64), '') END;
  v_council := CASE WHEN v_role = 'doctor'
                    THEN nullif(left(trim(NEW.raw_user_meta_data->>'medical_council'), 80), '') END;
  v_qualification := CASE WHEN v_role = 'doctor'
                          THEN nullif(left(trim(NEW.raw_user_meta_data->>'qualification'), 120), '') END;

  v_app_metadata := coalesce(NEW.raw_app_meta_data, '{}'::jsonb);
  v_app_metadata := jsonb_set(v_app_metadata, '{role}', to_jsonb(v_role));
  UPDATE auth.users SET raw_app_meta_data = v_app_metadata WHERE id = NEW.id;

  v_code := public.normalize_signup_code(NEW.raw_user_meta_data->>'invite_code');
  IF v_role IN ('doctor', 'lab') AND v_code IS NOT NULL THEN
    UPDATE public.signup_codes SET used_at = now()
    WHERE code = v_code AND role = v_role
      AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()
      AND (email IS NULL OR lower(email) = lower(NEW.email))
    RETURNING true INTO v_invited;
  END IF;
  v_invited := coalesce(v_invited, false);

  LOOP
    v_short_id := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE short_id = v_short_id);
  END LOOP;

  INSERT INTO public.profiles (id, email, name, role, short_id, license_number, medical_council, qualification,
                               verified, verification_reviewed_at)
  VALUES (NEW.id, NEW.email, v_name, v_role, v_short_id, v_license, v_council, v_qualification,
          v_invited, CASE WHEN v_invited THEN now() END)
  ON CONFLICT (id) DO NOTHING;

  IF v_invited THEN
    UPDATE public.signup_codes SET used_by = NEW.id WHERE code = v_code;
  ELSIF v_role IN ('doctor', 'lab') THEN
    INSERT INTO public.notifications (user_id, title, message, notification_type, target_role, action_url)
    SELECT a.id,
           CASE v_role WHEN 'doctor' THEN 'Doctor waiting for approval' ELSE 'Lab waiting for approval' END,
           v_name || ' signed up without an invite code. Check their registration number and approve or turn them down.',
           'system_notification', 'admin', '/admin-dashboard/approvals'
    FROM public.profiles a
    WHERE a.role = 'admin';
  END IF;

  RETURN NEW;
END;
$function$;

-- 4. Admins
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT coalesce((SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid()), false);
$function$;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Make an existing account an admin. SQL editor only (nobody can call it from the app):
--   SELECT public.promote_to_admin('you@example.com');
-- Use a separate account for this: an admin is no longer a patient, doctor or lab.
CREATE OR REPLACE FUNCTION public.promote_to_admin(p_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM auth.users WHERE lower(email) = lower(trim(p_email));
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'No account with the email %', p_email;
  END IF;
  UPDATE public.profiles SET role = 'admin', verified = true WHERE id = v_id;
  UPDATE auth.users
  SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb,
      email_confirmed_at = coalesce(email_confirmed_at, now())
  WHERE id = v_id;
  RETURN p_email || ' is now an admin. Sign out and in again, then open /admin-dashboard.';
END;
$function$;
REVOKE ALL ON FUNCTION public.promote_to_admin(text) FROM PUBLIC, anon, authenticated;

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
      'patients',     count(*) FILTER (WHERE p.role = 'patient'),
      'doctors',      count(*) FILTER (WHERE p.role = 'doctor' AND p.verified),
      'labs',         count(*) FILTER (WHERE p.role = 'lab' AND p.verified),
      'pending',      count(*) FILTER (WHERE p.role IN ('doctor', 'lab') AND NOT p.verified AND p.verification_reviewed_at IS NULL),
      'turned_down',  count(*) FILTER (WHERE p.role IN ('doctor', 'lab') AND NOT p.verified AND p.verification_reviewed_at IS NOT NULL),
      'unconfirmed',  (SELECT count(*) FROM auth.users u WHERE u.email_confirmed_at IS NULL),
      'reports_week', (SELECT count(*) FROM public.reports r WHERE r.uploaded_at > now() - interval '7 days'),
      'ai_failed_week', (SELECT count(*) FROM public.reports r WHERE r.ai_status = 'failed' AND r.uploaded_at > now() - interval '7 days'),
      'open_invites', (SELECT count(*) FROM public.signup_codes c WHERE c.used_at IS NULL AND c.revoked_at IS NULL AND c.expires_at > now())
    )
    FROM public.profiles p
  );
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.admin_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_overview() TO authenticated;

-- Every account with what an admin needs to help it: role, verification, whether the
-- email is confirmed, last sign-in, and the invite code it used. No health data.
CREATE OR REPLACE FUNCTION public.admin_list_accounts()
RETURNS TABLE (
  id uuid, name text, email text, role text, short_id text,
  verified boolean, license_number text, medical_council text, qualification text, specialty text,
  verification_note text, verification_reviewed_at timestamptz,
  email_confirmed boolean, created_at timestamptz, last_sign_in_at timestamptz, invite_code text
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
         (SELECT c.code FROM public.signup_codes c WHERE c.used_by = p.id LIMIT 1)
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  ORDER BY coalesce(u.created_at, p.created_at) DESC NULLS LAST
  LIMIT 1000;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.admin_list_accounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_accounts() TO authenticated;

-- Approve, or turn down / withdraw with a reason. The account holder is notified and
-- the decision is logged.
CREATE OR REPLACE FUNCTION public.admin_review_account(p_user uuid, p_approve boolean, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_role text;
  v_note text := nullif(left(trim(coalesce(p_note, '')), 500), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = p_user;
  IF v_role IS NULL OR v_role NOT IN ('doctor', 'lab') THEN
    RAISE EXCEPTION 'Only doctor and lab accounts are verified' USING ERRCODE = '22023';
  END IF;
  IF NOT p_approve AND v_note IS NULL THEN
    RAISE EXCEPTION 'Say why, so they know what to fix' USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles
  SET verified = p_approve,
      verification_note = CASE WHEN p_approve THEN NULL ELSE v_note END,
      verification_reviewed_at = now()
  WHERE id = p_user;

  INSERT INTO public.notifications (user_id, title, message, notification_type, target_role, action_url)
  VALUES (p_user,
    CASE WHEN p_approve THEN 'Your account is verified' ELSE 'We couldn''t verify your registration' END,
    CASE
      WHEN NOT p_approve THEN v_note
      WHEN v_role = 'doctor' THEN 'Patients can now find you and send consultation requests, and you can see your patients'' records and write prescriptions.'
      ELSE 'You can now upload reports for your patients.'
    END,
    'system_notification', v_role, '/' || v_role || '-dashboard');

  INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, details)
  VALUES (auth.uid(), 'update', 'profiles', p_user,
          jsonb_build_object('event', CASE WHEN p_approve THEN 'verified' ELSE 'not_verified' END, 'note', v_note));
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.admin_review_account(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_account(uuid, boolean, text) TO authenticated;

-- For someone whose confirmation email never arrived or whose link expired.
CREATE OR REPLACE FUNCTION public.admin_confirm_email(p_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  UPDATE auth.users SET email_confirmed_at = now() WHERE id = p_user AND email_confirmed_at IS NULL;
  IF FOUND THEN
    INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, details)
    VALUES (auth.uid(), 'update', 'profiles', p_user, '{"event": "email_confirmed_by_admin"}'::jsonb);
  END IF;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.admin_confirm_email(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_confirm_email(uuid) TO authenticated;

-- A doctor or lab that was turned down fixes their registration details (they can edit
-- them while unverified) and asks to be checked again; the admins are told.
CREATE OR REPLACE FUNCTION public.request_verification_review()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_me public.profiles;
BEGIN
  SELECT * INTO v_me FROM public.profiles WHERE id = auth.uid();
  IF v_me.id IS NULL OR v_me.role NOT IN ('doctor', 'lab') OR v_me.verified THEN
    RAISE EXCEPTION 'Only a doctor or lab waiting for verification can ask for a review' USING ERRCODE = '22023';
  END IF;
  IF v_me.verification_reviewed_at IS NULL THEN
    RETURN; -- already waiting
  END IF;
  UPDATE public.profiles SET verification_note = NULL, verification_reviewed_at = NULL WHERE id = v_me.id;
  INSERT INTO public.notifications (user_id, title, message, notification_type, target_role, action_url)
  SELECT a.id, 'Asked to be checked again',
         coalesce(v_me.name, 'Someone') || ' updated their registration details and asks to be verified again.',
         'system_notification', 'admin', '/admin-dashboard/approvals'
  FROM public.profiles a
  WHERE a.role = 'admin';
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.request_verification_review() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_verification_review() TO authenticated;

-- 1 to 50 codes for doctors or labs, valid 1 to 90 days. A code tied to an email is
-- made one at a time.
CREATE OR REPLACE FUNCTION public.admin_create_signup_codes(p_role text, p_count int DEFAULT 1, p_email text DEFAULT NULL,
                                                            p_days int DEFAULT 14, p_note text DEFAULT NULL)
RETURNS SETOF text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_code text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  IF p_role NOT IN ('doctor', 'lab') THEN
    RAISE EXCEPTION 'Codes are for doctors or labs' USING ERRCODE = '22023';
  END IF;
  IF p_count NOT BETWEEN 1 AND 50 OR p_days NOT BETWEEN 1 AND 90 THEN
    RAISE EXCEPTION 'Make 1 to 50 codes, valid for 1 to 90 days' USING ERRCODE = '22023';
  END IF;
  IF v_email IS NOT NULL AND p_count <> 1 THEN
    RAISE EXCEPTION 'A code tied to an email is made one at a time' USING ERRCODE = '22023';
  END IF;

  FOR i IN 1..p_count LOOP
    LOOP
      v_code := public.new_signup_code();
      INSERT INTO public.signup_codes (code, role, email, note, created_by, expires_at)
      VALUES (v_code, p_role, v_email, nullif(left(trim(coalesce(p_note, '')), 200), ''), auth.uid(), now() + make_interval(days => p_days))
      ON CONFLICT (code) DO NOTHING;
      EXIT WHEN FOUND;
    END LOOP;
    RETURN NEXT v_code;
  END LOOP;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.admin_create_signup_codes(text, int, text, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_signup_codes(text, int, text, int, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_signup_codes()
RETURNS TABLE (code text, role text, email text, note text, created_at timestamptz, expires_at timestamptz,
               used_at timestamptz, used_by_name text, used_by_email text, revoked_at timestamptz)
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
  SELECT c.code, c.role, c.email, c.note, c.created_at, c.expires_at, c.used_at, p.name, p.email, c.revoked_at
  FROM public.signup_codes c
  LEFT JOIN public.profiles p ON p.id = c.used_by
  ORDER BY c.created_at DESC
  LIMIT 500;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.admin_list_signup_codes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_signup_codes() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_revoke_signup_code(p_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  UPDATE public.signup_codes SET revoked_at = now()
  WHERE code = public.normalize_signup_code(p_code) AND used_at IS NULL AND revoked_at IS NULL;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_signup_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_revoke_signup_code(text) TO authenticated;

-- 5. Patients see each doctor's registration number, council and qualification.
--    (Replaces the view in 20261018120000; new columns go at the end.)
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
   OR (p.role IN ('doctor', 'lab') AND p.verified)
   OR (SELECT public.is_verified_lab())
   OR (SELECT public.is_verified_doctor());

REVOKE ALL ON public.profile_directory FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.profile_directory TO authenticated;
