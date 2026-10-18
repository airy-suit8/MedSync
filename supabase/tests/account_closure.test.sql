BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

-- Tests for 20261021120000_account_closure.sql.
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
VALUES
 ('ac111111-1111-4111-8111-111111111111','authenticated','authenticated','ac-patient@example.test','',now(),'{}','{"name":"Ravi","role":"patient"}'),
 ('ac222222-2222-4222-8222-222222222222','authenticated','authenticated','ac-doctor@example.test','',now(),'{}','{"name":"Dr Rao","role":"doctor","license_number":"G-7"}'),
 ('ac333333-3333-4333-8333-333333333333','authenticated','authenticated','ac-admin@example.test','',now(),'{}','{"name":"Admin","role":"patient"}'),
 ('ac444444-4444-4444-8444-444444444444','authenticated','authenticated','ac-other@example.test','',now(),'{}','{"name":"Anita","role":"patient"}');
UPDATE public.profiles SET verified = true WHERE id = 'ac222222-2222-4222-8222-222222222222';
UPDATE public.profiles SET phone = '+91 98200 11223', address = '14 Lake Road' WHERE id = 'ac111111-1111-4111-8111-111111111111';
SELECT public.promote_to_admin('ac-admin@example.test');

INSERT INTO public.doctor_patient_assignments (doctor_id, patient_id, is_active) VALUES
 ('ac222222-2222-4222-8222-222222222222','ac111111-1111-4111-8111-111111111111',true),
 ('ac222222-2222-4222-8222-222222222222','ac444444-4444-4444-8444-444444444444',true);
INSERT INTO public.reports (id, patient_id, doctor_id, test_type, original_name, file_name, uploaded_at)
VALUES ('ac900000-0000-4000-8000-000000000001','ac111111-1111-4111-8111-111111111111','ac222222-2222-4222-8222-222222222222',
        'x_ray','a.png','ac111111-1111-4111-8111-111111111111/a.png', now() - interval '1 year');
INSERT INTO public.appointments (id, doctor_id, patient_id, appointment_date, start_time, end_time, status)
VALUES ('ac900000-0000-4000-8000-000000000002','ac222222-2222-4222-8222-222222222222','ac111111-1111-4111-8111-111111111111',
        current_date + 3, '10:00', '10:30', 'confirmed');

CREATE FUNCTION pg_temp.as_user(uid text) RETURNS void
LANGUAGE sql AS $$ SELECT set_config('request.jwt.claim.sub', uid, true); $$;

SELECT plan(19);

SET LOCAL ROLE authenticated;

-- An admin can't close their account from the app.
SELECT pg_temp.as_user('ac333333-3333-4333-8333-333333333333');
SELECT throws_ok('SELECT public.close_my_account()', '22023', NULL, 'an admin account is not closed from the app');

-- The patient closes theirs.
SELECT pg_temp.as_user('ac111111-1111-4111-8111-111111111111');
SELECT ok(public.close_my_account() BETWEEN now() + interval '2 years' - interval '1 day' AND now() + interval '2 years' + interval '1 day',
  'records are kept 3 years after the last report (a year ago), so 2 years from now');
SELECT throws_ok($$UPDATE public.profiles SET closed_at = NULL WHERE id = 'ac111111-1111-4111-8111-111111111111'$$, '42501', NULL,
  'a closed account cannot reopen itself');

RESET ROLE;
SELECT is((SELECT phone IS NULL AND address IS NULL FROM public.profiles WHERE id = 'ac111111-1111-4111-8111-111111111111'), true,
  'contact details are deleted at once');
SELECT is((SELECT status FROM public.appointments WHERE id = 'ac900000-0000-4000-8000-000000000002'), 'cancelled',
  'even a confirmed upcoming appointment is cancelled');
SELECT is((SELECT is_active FROM public.doctor_patient_assignments
           WHERE patient_id = 'ac111111-1111-4111-8111-111111111111'), false, 'care with their doctor ends');
SELECT is((SELECT banned_until FROM auth.users WHERE id = 'ac111111-1111-4111-8111-111111111111'), 'infinity'::timestamptz,
  'they can no longer sign in');
SELECT is((SELECT count(*)::int FROM public.notifications
           WHERE user_id = 'ac222222-2222-4222-8222-222222222222' AND title = 'A patient closed their account'), 1, 'the doctor is told');
SELECT is((SELECT count(*)::int FROM public.reports WHERE patient_id = 'ac111111-1111-4111-8111-111111111111'), 1, 'the medical records stay');

SET LOCAL ROLE authenticated;
-- Only an admin deletes for good, and only after the retention date.
SELECT pg_temp.as_user('ac222222-2222-4222-8222-222222222222');
SELECT throws_ok($$SELECT public.admin_purge_patient('ac111111-1111-4111-8111-111111111111')$$, '42501', 'Admins only', 'a doctor cannot delete accounts');
SELECT pg_temp.as_user('ac333333-3333-4333-8333-333333333333');
SELECT throws_ok($$SELECT public.admin_purge_patient('ac111111-1111-4111-8111-111111111111')$$, '22023', NULL, 'not before the retention date');
SELECT is((public.admin_overview()->>'closed')::int, 1, 'the overview counts closed accounts');

RESET ROLE;
UPDATE public.profiles SET delete_after = now() - interval '1 day' WHERE id = 'ac111111-1111-4111-8111-111111111111';
SET LOCAL ROLE authenticated;
SELECT pg_temp.as_user('ac333333-3333-4333-8333-333333333333');
SELECT is(public.admin_purge_patient('ac111111-1111-4111-8111-111111111111')->'reports',
  '["ac111111-1111-4111-8111-111111111111/a.png"]'::jsonb, 'deleting returns the files to remove from storage');

RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.reports WHERE patient_id = 'ac111111-1111-4111-8111-111111111111'), 0, 'the records are gone');
SELECT is((SELECT count(*)::int FROM auth.users WHERE id = 'ac111111-1111-4111-8111-111111111111'), 0, 'and so is the account');

-- A doctor closing leaves the directory and loses access; their patients are told.
SET LOCAL ROLE authenticated;
SELECT pg_temp.as_user('ac222222-2222-4222-8222-222222222222');
SELECT is(public.close_my_account(), NULL::timestamptz, 'a doctor account is closed, not scheduled for deletion');
SELECT ok(NOT public.is_verified_doctor(), 'a closed doctor no longer counts as verified');
SELECT pg_temp.as_user('ac444444-4444-4444-8444-444444444444');
SELECT is((SELECT count(*)::int FROM public.profile_directory WHERE id = 'ac222222-2222-4222-8222-222222222222'), 0,
  'patients no longer find the doctor');
-- 20261022120000: nor can they ask the closed doctor for a consultation by id.
SELECT throws_ok($$SELECT public.request_consultation('ac222222-2222-4222-8222-222222222222', current_date + 2, '11:00', 'Cough')$$,
  '42501', 'This doctor is not taking requests', 'a closed doctor gets no new requests');

SELECT * FROM finish();
ROLLBACK;
