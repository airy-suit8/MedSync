BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

-- Tests for 20261020120000_admin_and_invites.sql.
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
VALUES
 ('ad111111-1111-4111-8111-111111111111','authenticated','authenticated','ai-admin@example.test','',now(),'{}','{"name":"Asha Admin","role":"patient"}'),
 ('ad222222-2222-4222-8222-222222222222','authenticated','authenticated','ai-pending@example.test','',now(),'{}','{"name":"Dr Pending","role":"doctor","license_number":"MMC-1"}'),
 ('ad666666-6666-4666-8666-666666666666','authenticated','authenticated','ai-patient@example.test','',now(),'{}','{"name":"Ravi","role":"patient"}'),
 ('ad777777-7777-4777-8777-777777777777','authenticated','authenticated','ai-unconfirmed@example.test','',NULL,'{}','{"name":"Late","role":"patient"}'),
 -- nobody can make themselves an admin at sign-up
 ('ad888888-8888-4888-8888-888888888888','authenticated','authenticated','ai-sneaky@example.test','',now(),'{}','{"name":"Sneaky","role":"admin"}');

CREATE FUNCTION pg_temp.as_user(uid text) RETURNS void
LANGUAGE sql AS $$ SELECT set_config('request.jwt.claim.sub', uid, true); $$;

SELECT plan(29);

SELECT is((SELECT role FROM public.profiles WHERE id = 'ad888888-8888-4888-8888-888888888888'), 'patient',
  'signing up as "admin" gives a patient account');
SELECT is((SELECT count(*)::int FROM public.notifications WHERE title = 'Doctor waiting for approval'), 0,
  'no admin yet, so nobody to notify');

SELECT is(public.promote_to_admin('AI-Admin@example.test') LIKE '%is now an admin%', true, 'promote_to_admin makes an admin');
SELECT is((SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = 'ad111111-1111-4111-8111-111111111111'), 'admin',
  'the admin role is in the sign-in token metadata too');

-- A doctor signing up without a code after there is an admin: the admin hears about it.
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('ad999999-9999-4999-8999-999999999999','authenticated','authenticated','ai-nocode@example.test','',now(),'{}',
        '{"name":"Dr No Code","role":"doctor","license_number":"KMC-9","medical_council":"Karnataka","qualification":"MBBS"}');
SELECT is((SELECT count(*)::int FROM public.notifications
           WHERE user_id = 'ad111111-1111-4111-8111-111111111111' AND title = 'Doctor waiting for approval'), 1,
  'admins are told about a doctor who signed up without a code');
SELECT is((SELECT verified FROM public.profiles WHERE id = 'ad999999-9999-4999-8999-999999999999'), false,
  'without a code the doctor waits for approval');

SET LOCAL ROLE authenticated;

-- Only admins use the admin functions.
SELECT pg_temp.as_user('ad222222-2222-4222-8222-222222222222');
SELECT throws_ok('SELECT public.admin_overview()', '42501', 'Admins only', 'a doctor cannot open the admin overview');
SELECT throws_ok($$SELECT public.admin_create_signup_codes('doctor', 1)$$, '42501', 'Admins only', 'or make invite codes');
SELECT throws_ok($$SELECT public.promote_to_admin('ai-pending@example.test')$$, '42501', NULL, 'or promote anyone');

SELECT pg_temp.as_user('ad111111-1111-4111-8111-111111111111');
SELECT ok(public.is_admin(), 'the admin is an admin');
SELECT set_config('test.code', (SELECT c FROM public.admin_create_signup_codes('doctor', 1, NULL, 14, 'Dr Iyer') c LIMIT 1), true);
SELECT set_config('test.bound', (SELECT c FROM public.admin_create_signup_codes('doctor', 1, 'only@example.test', 14) c LIMIT 1), true);
SELECT ok(current_setting('test.code') ~ '^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$', 'codes look like XXXX-XXXX-XXXX');
SELECT ok(public.signup_code_is_valid(lower(replace(current_setting('test.code'), '-', ' ')), 'doctor', 'x@example.test'),
  'a new code is valid however it is typed');
SELECT ok(NOT public.signup_code_is_valid(current_setting('test.code'), 'lab', 'x@example.test'), 'but only for its role');
SELECT throws_ok($$SELECT public.admin_create_signup_codes('doctor', 2, 'a@example.test')$$, '22023', NULL,
  'a code tied to an email is made one at a time');

RESET ROLE;
-- Signing up with the code verifies the doctor and uses the code up.
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('ad333333-3333-4333-8333-333333333333','authenticated','authenticated','ai-invited@example.test','',now(),'{}',
        jsonb_build_object('name','Dr Invited','role','doctor','license_number','MMC-2019-1','medical_council','Maharashtra',
                           'qualification','MBBS, MD (Radiology)','invite_code', current_setting('test.code')));
SELECT is((SELECT verified FROM public.profiles WHERE id = 'ad333333-3333-4333-8333-333333333333'), true,
  'signing up with a valid code verifies the account');
SELECT is((SELECT used_by FROM public.signup_codes WHERE code = current_setting('test.code')), 'ad333333-3333-4333-8333-333333333333'::uuid,
  'the code records who used it');
-- The same code again: not verified.
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('ad444444-4444-4444-8444-444444444444','authenticated','authenticated','ai-reuse@example.test','',now(),'{}',
        jsonb_build_object('name','Dr Reuse','role','doctor','license_number','X','invite_code', current_setting('test.code')));
SELECT is((SELECT verified FROM public.profiles WHERE id = 'ad444444-4444-4444-8444-444444444444'), false, 'a code works once');
-- A code tied to an email doesn't work for another one.
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('ad555555-5555-4555-8555-555555555555','authenticated','authenticated','someone-else@example.test','',now(),'{}',
        jsonb_build_object('name','Dr Else','role','doctor','license_number','Y','invite_code', current_setting('test.bound')));
SELECT is((SELECT verified FROM public.profiles WHERE id = 'ad555555-5555-4555-8555-555555555555'), false,
  'a code tied to an email only works for that email');

SET LOCAL ROLE authenticated;
-- Patients see the registration details of verified doctors.
SELECT pg_temp.as_user('ad666666-6666-4666-8666-666666666666');
SELECT is((SELECT license_number || ' / ' || medical_council || ' / ' || qualification FROM public.profile_directory
           WHERE id = 'ad333333-3333-4333-8333-333333333333'), 'MMC-2019-1 / Maharashtra / MBBS, MD (Radiology)',
  'patients see the registration number, council and qualification');

-- A verified doctor can't change what was checked, or touch the verification fields.
SELECT pg_temp.as_user('ad333333-3333-4333-8333-333333333333');
SELECT throws_ok($$UPDATE public.profiles SET qualification = 'MBBS, MS' WHERE id = 'ad333333-3333-4333-8333-333333333333'$$,
  '42501', NULL, 'a verified doctor cannot change their qualification');
SELECT pg_temp.as_user('ad222222-2222-4222-8222-222222222222');
SELECT throws_ok($$UPDATE public.profiles SET verification_note = NULL, verified = true WHERE id = 'ad222222-2222-4222-8222-222222222222'$$,
  '42501', NULL, 'a pending doctor cannot approve themselves');

-- The admin reviews.
SELECT pg_temp.as_user('ad111111-1111-4111-8111-111111111111');
SELECT throws_ok($$SELECT public.admin_review_account('ad999999-9999-4999-8999-999999999999', false, '  ')$$, '22023', NULL,
  'turning someone down needs a reason');
SELECT public.admin_review_account('ad222222-2222-4222-8222-222222222222', true);
SELECT public.admin_review_account('ad999999-9999-4999-8999-999999999999', false, 'Registration number not found on the Karnataka register.');
SELECT public.admin_review_account('ad555555-5555-4555-8555-555555555555', true);
SELECT public.admin_confirm_email('ad777777-7777-4777-8777-777777777777');
SELECT is((public.admin_overview()->>'pending')::int, 1, 'the overview counts who is still waiting (the doctor who reused a code)');
SELECT is((SELECT email_confirmed FROM public.admin_list_accounts() WHERE email = 'ai-unconfirmed@example.test'), true,
  'an admin can confirm an email that never arrived');

SELECT pg_temp.as_user('ad222222-2222-4222-8222-222222222222');
SELECT is((SELECT count(*)::int FROM public.notifications WHERE title = 'Your account is verified'), 1, 'an approved doctor is told');
SELECT pg_temp.as_user('ad999999-9999-4999-8999-999999999999');
SELECT is((SELECT message FROM public.notifications WHERE title = 'We couldn''t verify your registration'),
  'Registration number not found on the Karnataka register.', 'a doctor who is turned down is told why');
-- They fix the number and ask again: back in the queue, and the admin is told.
UPDATE public.profiles SET license_number = 'KMC-90210' WHERE id = 'ad999999-9999-4999-8999-999999999999';
SELECT public.request_verification_review();
SELECT is((SELECT verification_reviewed_at IS NULL AND verification_note IS NULL FROM public.profiles
           WHERE id = 'ad999999-9999-4999-8999-999999999999'), true, 'a turned-down doctor can fix their details and ask again');
SELECT pg_temp.as_user('ad111111-1111-4111-8111-111111111111');
SELECT is((SELECT count(*)::int FROM public.notifications WHERE title = 'Asked to be checked again'), 1,
  'the admin hears about it');

SET LOCAL ROLE anon;
SELECT throws_ok('SELECT * FROM public.signup_codes', '42501', NULL, 'nobody reads the codes table directly');

SELECT * FROM finish();
ROLLBACK;
