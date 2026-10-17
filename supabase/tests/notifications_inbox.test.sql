BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

-- Tests for 20261019160000_notifications_inbox.sql.
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
VALUES
 ('c1111111-1111-4111-8111-111111111111','authenticated','authenticated','ni-p@example.test','',now(),'{}','{"name":"Ravi","role":"patient"}'),
 ('c2222222-2222-4222-8222-222222222222','authenticated','authenticated','ni-d@example.test','',now(),'{}','{"name":"Dr Rao","role":"doctor","license_number":"G-7"}');
UPDATE public.profiles SET verified = true WHERE id = 'c2222222-2222-4222-8222-222222222222';

CREATE FUNCTION pg_temp.as_user(uid text) RETURNS void
LANGUAGE sql AS $$ SELECT set_config('request.jwt.claim.sub', uid, true); $$;

SELECT plan(5);

SELECT ok(EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'),
  'notifications update live');

SET LOCAL ROLE authenticated;

-- The doctor schedules; the patient is told (with the profile name, not the typed one).
SELECT pg_temp.as_user('c2222222-2222-4222-8222-222222222222');
INSERT INTO public.appointments (id, doctor_id, patient_id, doctor_name, appointment_date, start_time, end_time)
VALUES ('c9000000-0000-4000-8000-000000000001','c2222222-2222-4222-8222-222222222222','c1111111-1111-4111-8111-111111111111',
        'Dr Somebody Famous', current_date + 2, '11:00', '11:30');

SELECT pg_temp.as_user('c1111111-1111-4111-8111-111111111111');
SELECT is((SELECT message FROM public.notifications WHERE title = 'Appointment request') LIKE 'Dr Rao asked to see you%', true,
  'the patient is told about the request, with the doctor''s real name');

-- The patient confirms; the doctor is told.
SELECT public.respond_to_appointment('c9000000-0000-4000-8000-000000000001', true);
SELECT pg_temp.as_user('c2222222-2222-4222-8222-222222222222');
SELECT is((SELECT count(*)::int FROM public.notifications WHERE title = 'Appointment confirmed'), 1, 'the doctor is told it was confirmed');

-- The doctor completes it; the patient gets the summary notice.
SELECT is(public.safe_appointment_update('c9000000-0000-4000-8000-000000000001', '{"status":"completed","diagnosis":"Sprain"}')->>'success', 'true',
  'the doctor completes the consultation');
SELECT pg_temp.as_user('c1111111-1111-4111-8111-111111111111');
SELECT is((SELECT count(*)::int FROM public.notifications WHERE title = 'Consultation summary'), 1, 'the patient is told the summary is ready');

SELECT * FROM finish();
ROLLBACK;
