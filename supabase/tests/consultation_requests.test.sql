BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

-- Tests for 20261018120000_doctor_directory_and_patient_requests.sql.
-- Fixtures: patients P and P2, verified doctors D and D2, unverified doctor DU.
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
VALUES
 ('71111111-1111-4111-8111-111111111111','authenticated','authenticated','cr-p@example.test','',now(),'{}','{"name":"P","role":"patient"}'),
 ('72222222-2222-4222-8222-222222222222','authenticated','authenticated','cr-p2@example.test','',now(),'{}','{"name":"P2","role":"patient"}'),
 ('73333333-3333-4333-8333-333333333333','authenticated','authenticated','cr-d@example.test','',now(),'{}','{"name":"D","role":"doctor","license_number":"GMC-71"}'),
 ('74444444-4444-4444-8444-444444444444','authenticated','authenticated','cr-d2@example.test','',now(),'{}','{"name":"D2","role":"doctor","license_number":"GMC-72"}'),
 ('75555555-5555-4555-8555-555555555555','authenticated','authenticated','cr-du@example.test','',now(),'{}','{"name":"DU","role":"doctor","license_number":"GMC-73"}');

UPDATE public.profiles SET verified = true
WHERE id IN ('73333333-3333-4333-8333-333333333333','74444444-4444-4444-8444-444444444444');

INSERT INTO public.reports (id, patient_id, test_type, original_name, file_name) VALUES
 ('c3000000-0000-4000-8000-000000000001','71111111-1111-4111-8111-111111111111','x_ray','p.png','p.png');

CREATE FUNCTION pg_temp.as_user(uid text) RETURNS void
LANGUAGE sql AS $$ SELECT set_config('request.jwt.claim.sub', uid, true); $$;

-- P's open request to a doctor, read as P.
CREATE FUNCTION pg_temp.request_to(doctor text) RETURNS uuid
LANGUAGE sql AS $$
  SELECT id FROM public.appointments
  WHERE patient_id = '71111111-1111-4111-8111-111111111111' AND doctor_id = doctor::uuid AND status = 'requested';
$$;

SELECT plan(32);

-- Run as postgres.
SELECT has_column('public', 'profiles', 'expertise', 'doctors can publish what they treat');
SELECT ok(NOT has_function_privilege('anon', 'public.request_consultation(uuid, date, time, text)', 'EXECUTE'), 'anon cannot run request_consultation');
SELECT ok(NOT has_function_privilege('anon', 'public.end_care(uuid)', 'EXECUTE'), 'anon cannot run end_care');

SET LOCAL ROLE authenticated;

-- Doctors publish their profile; patients see it in the directory.
SELECT pg_temp.as_user('73333333-3333-4333-8333-333333333333');
SELECT lives_ok($$UPDATE public.profiles SET expertise = 'Fractures and sports injuries', share_before = 'Recent X-rays'
  WHERE id = '73333333-3333-4333-8333-333333333333'$$, 'a doctor can edit their public profile');
SELECT pg_temp.as_user('71111111-1111-4111-8111-111111111111');
SELECT is((SELECT expertise FROM public.profile_directory WHERE id = '73333333-3333-4333-8333-333333333333'),
  'Fractures and sports injuries', 'patients see what a doctor treats');

-- P asks D for a consultation.
SELECT throws_ok($$SELECT public.request_consultation('75555555-5555-4555-8555-555555555555', current_date + 1, '10:00', 'cough')$$,
  '42501', NULL, 'patients cannot request an unverified doctor');
SELECT throws_ok($$SELECT public.request_consultation('73333333-3333-4333-8333-333333333333', current_date - 1, '10:00', 'cough')$$,
  '22023', NULL, 'a request cannot be in the past');
SELECT lives_ok($$SELECT public.request_consultation('73333333-3333-4333-8333-333333333333', current_date + 1, '10:00', 'Cold for a week')$$,
  'a patient can request a verified doctor');
SELECT throws_ok($$SELECT public.request_consultation('73333333-3333-4333-8333-333333333333', current_date + 2, '11:00', 'again')$$,
  '23505', NULL, 'one open request per doctor');
SELECT throws_ok($$INSERT INTO public.appointments (doctor_id, patient_id, appointment_date, start_time, end_time, status)
  VALUES ('74444444-4444-4444-8444-444444444444','71111111-1111-4111-8111-111111111111',current_date + 1,'10:00','10:30','requested')$$,
  '42501', NULL, 'patients cannot insert appointments directly');

-- Another doctor cannot fake or answer P's request.
SELECT pg_temp.as_user('74444444-4444-4444-8444-444444444444');
SELECT throws_ok($$INSERT INTO public.appointments (doctor_id, patient_id, appointment_date, start_time, end_time, status)
  VALUES ('74444444-4444-4444-8444-444444444444','72222222-2222-4222-8222-222222222222',current_date + 1,'10:00','10:30','requested')$$,
  '42501', NULL, 'a doctor cannot create a patient''s request');
INSERT INTO public.appointments (id, doctor_id, patient_id, appointment_date, start_time, end_time)
  VALUES ('c1000000-0000-4000-8000-000000000001','74444444-4444-4444-8444-444444444444','72222222-2222-4222-8222-222222222222',current_date + 1,'12:00','12:30');
SELECT throws_ok($$UPDATE public.appointments SET status = 'requested' WHERE id = 'c1000000-0000-4000-8000-000000000001'$$,
  '42501', NULL, 'a doctor cannot turn an appointment into a patient request');

-- D answers P's request.
SELECT pg_temp.as_user('73333333-3333-4333-8333-333333333333');
SELECT throws_ok(format($$UPDATE public.appointments SET patient_id = '72222222-2222-4222-8222-222222222222' WHERE id = %L$$,
  (SELECT id FROM public.appointments WHERE doctor_id = '73333333-3333-4333-8333-333333333333' AND status = 'requested')),
  '42501', NULL, 'a request cannot be re-pointed at another patient');
SELECT is((SELECT count(*)::int FROM public.reports WHERE id = 'c3000000-0000-4000-8000-000000000001'), 0,
  'the doctor sees no reports before accepting');
SELECT is(public.respond_to_consultation_request(
  (SELECT id FROM public.appointments WHERE doctor_id = '73333333-3333-4333-8333-333333333333' AND status = 'requested'), true),
  'confirmed', 'the doctor accepts the request');
SELECT is((SELECT count(*)::int FROM public.reports WHERE id = 'c3000000-0000-4000-8000-000000000001'), 1,
  'accepting links the doctor to the patient''s reports');
SELECT is((SELECT count(*)::int FROM public.notifications
           WHERE user_id = '73333333-3333-4333-8333-333333333333' AND notification_type = 'consultation_request'), 1,
  'the doctor was notified of the request');

-- A second doctor for the same patient; P withdraws one request first.
SELECT pg_temp.as_user('71111111-1111-4111-8111-111111111111');
SELECT lives_ok($$SELECT public.request_consultation('74444444-4444-4444-8444-444444444444', current_date + 3, '09:00', 'Second opinion')$$,
  'the patient asks a second doctor');
SELECT lives_ok($$SELECT public.withdraw_consultation_request(pg_temp.request_to('74444444-4444-4444-8444-444444444444'))$$,
  'the patient can withdraw a request');
SELECT is((SELECT count(*)::int FROM public.appointments
           WHERE patient_id = '71111111-1111-4111-8111-111111111111' AND doctor_id = '74444444-4444-4444-8444-444444444444' AND status = 'cancelled'), 1,
  'a withdrawn request is cancelled');
SELECT lives_ok($$SELECT public.request_consultation('74444444-4444-4444-8444-444444444444', current_date + 3, '09:00', 'Second opinion')$$,
  'the patient can ask again after withdrawing');
SELECT pg_temp.as_user('74444444-4444-4444-8444-444444444444');
SELECT is(public.respond_to_consultation_request(
  (SELECT id FROM public.appointments WHERE doctor_id = '74444444-4444-4444-8444-444444444444' AND status = 'requested'), true),
  'confirmed', 'the second doctor accepts');
SELECT pg_temp.as_user('71111111-1111-4111-8111-111111111111');
SELECT is((SELECT count(*)::int FROM public.doctor_patient_assignments
           WHERE patient_id = '71111111-1111-4111-8111-111111111111' AND is_active), 2,
  'a patient can have several doctors');

-- Ending care.
SELECT lives_ok($$SELECT public.end_care('73333333-3333-4333-8333-333333333333')$$, 'the patient ends care with a doctor');
SELECT throws_ok($$SELECT public.end_care('73333333-3333-4333-8333-333333333333')$$, 'P0002', NULL, 'care can only be ended once');
SELECT pg_temp.as_user('73333333-3333-4333-8333-333333333333');
SELECT is((SELECT count(*)::int FROM public.reports WHERE id = 'c3000000-0000-4000-8000-000000000001'), 0,
  'that doctor loses access to the patient''s reports');
SELECT pg_temp.as_user('74444444-4444-4444-8444-444444444444');
SELECT is((SELECT count(*)::int FROM public.reports WHERE id = 'c3000000-0000-4000-8000-000000000001'), 1,
  'the patient''s other doctor keeps access');
SELECT lives_ok($$SELECT public.end_care('71111111-1111-4111-8111-111111111111')$$, 'a doctor can discharge a patient');
SELECT is((SELECT count(*)::int FROM public.reports WHERE id = 'c3000000-0000-4000-8000-000000000001'), 0,
  'the discharging doctor loses access too');

-- Coming back later: a new request links the doctor again, and care can end again.
SELECT pg_temp.as_user('71111111-1111-4111-8111-111111111111');
SELECT lives_ok($$SELECT public.request_consultation('73333333-3333-4333-8333-333333333333', current_date + 7, '10:00', 'New problem')$$,
  'the patient can return to a former doctor');
SELECT pg_temp.as_user('73333333-3333-4333-8333-333333333333');
SELECT lives_ok($$SELECT public.respond_to_consultation_request(
  (SELECT id FROM public.appointments WHERE doctor_id = '73333333-3333-4333-8333-333333333333' AND status = 'requested'), true)$$,
  'the former doctor accepts again');
SELECT lives_ok($$SELECT public.end_care('71111111-1111-4111-8111-111111111111')$$,
  'care can end a second time (the older inactive link is replaced)');

SELECT * FROM finish();
ROLLBACK;
