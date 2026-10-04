BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

-- Tests for 20261004120000_security_fixes.sql and
-- 20261004121000_doctor_verification_and_patient_confirmation.sql.
-- Fixtures: patients P1 and P2, verified doctor D1, unverified doctor D2, lab L1.
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
VALUES
 ('51111111-1111-4111-8111-111111111111','authenticated','authenticated','sec-p1@example.test','',now(),'{}','{"name":"P1","role":"patient"}'),
 ('52222222-2222-4222-8222-222222222222','authenticated','authenticated','sec-p2@example.test','',now(),'{}','{"name":"P2","role":"patient"}'),
 ('53333333-3333-4333-8333-333333333333','authenticated','authenticated','sec-d1@example.test','',now(),'{}','{"name":"D1","role":"doctor","license_number":"GMC-1"}'),
 ('54444444-4444-4444-8444-444444444444','authenticated','authenticated','sec-d2@example.test','',now(),'{}','{"name":"D2","role":"doctor","license_number":"GMC-2"}'),
 ('55555555-5555-4555-8555-555555555555','authenticated','authenticated','sec-l1@example.test','',now(),'{}','{"name":"L1","role":"lab"}');

-- The team verifies D1 in the dashboard (runs as postgres, which the guard allows).
UPDATE public.profiles SET verified = true WHERE id = '53333333-3333-4333-8333-333333333333';

INSERT INTO public.appointments (id, doctor_id, patient_id, appointment_date, start_time, status) VALUES
 ('a1000000-0000-4000-8000-000000000001','53333333-3333-4333-8333-333333333333','51111111-1111-4111-8111-111111111111',current_date + 1,'10:00','scheduled'),
 ('a1000000-0000-4000-8000-000000000002','53333333-3333-4333-8333-333333333333','52222222-2222-4222-8222-222222222222',current_date + 1,'11:00','scheduled'),
 ('a1000000-0000-4000-8000-000000000003','53333333-3333-4333-8333-333333333333','51111111-1111-4111-8111-111111111111',current_date + 2,'10:00','scheduled'),
 ('a1000000-0000-4000-8000-000000000004','54444444-4444-4444-8444-444444444444','52222222-2222-4222-8222-222222222222',current_date + 1,'12:00','scheduled');

INSERT INTO public.messages (id, content, sender_id, sender_name, sender_role, receiver_id, receiver_name, receiver_role)
VALUES ('a2000000-0000-4000-8000-000000000001','private','53333333-3333-4333-8333-333333333333','D1','doctor','51111111-1111-4111-8111-111111111111','P1','patient');

INSERT INTO public.reports (id, patient_id, test_type, original_name, file_name, uploaded_by)
VALUES ('a3000000-0000-4000-8000-000000000001','51111111-1111-4111-8111-111111111111','x_ray','x.png','x.png','55555555-5555-4555-8555-555555555555');

SELECT plan(44);

-- Run as postgres: schema and backfill checks.
SELECT lives_ok($$INSERT INTO public.ml_suggestions (report_id, patient_id, test_type, findings, confidence, severity)
  VALUES ('a3000000-0000-4000-8000-000000000001','51111111-1111-4111-8111-111111111111','x_ray','normal',0.90,'none')$$,
  'normal ML results can be stored with severity none');
SELECT is((SELECT count(*)::int FROM auth.users u JOIN public.profiles p ON p.id = u.id
           WHERE (u.raw_app_meta_data->>'role') IS DISTINCT FROM p.role), 0,
  'every account has its profile role in app_metadata');
SELECT is((SELECT license_number FROM public.profiles WHERE id = '53333333-3333-4333-8333-333333333333'), 'GMC-1',
  'signup stores the doctor registration number');
SELECT is((SELECT verified FROM public.profiles WHERE id = '54444444-4444-4444-8444-444444444444'), false,
  'new doctors start unverified');

-- Function privileges: signed-out callers can run none of the SECURITY DEFINER functions.
SELECT ok(NOT has_function_privilege('anon', 'public.safe_appointment_update(text, jsonb)', 'EXECUTE'), 'anon cannot run safe_appointment_update');
SELECT ok(NOT has_function_privilege('anon', 'public.get_doctor_patients_bulletproof(uuid)', 'EXECUTE'), 'anon cannot run get_doctor_patients_bulletproof');
SELECT ok(NOT has_function_privilege('anon', 'public.get_doctor_reports_with_ml(uuid)', 'EXECUTE'), 'anon cannot run get_doctor_reports_with_ml');
SELECT ok(NOT has_function_privilege('anon', 'public.resolve_doctor_id(text)', 'EXECUTE'), 'anon cannot run resolve_doctor_id');
SELECT ok(NOT has_function_privilege('anon', 'public.resolve_patient_id(text)', 'EXECUTE'), 'anon cannot run resolve_patient_id');
SELECT ok(NOT has_function_privilege('anon', 'public.lab_can_upload_patient_report(uuid, uuid)', 'EXECUTE'), 'anon cannot run lab_can_upload_patient_report');
SELECT ok(NOT has_function_privilege('anon', 'public.get_auth_role()', 'EXECUTE'), 'anon cannot run get_auth_role');
SELECT ok(NOT has_function_privilege('anon', 'public.get_auth_short_id()', 'EXECUTE'), 'anon cannot run get_auth_short_id');
SELECT ok(NOT has_function_privilege('anon', 'public.ensure_patient_row_from_users()', 'EXECUTE'), 'anon cannot run ensure_patient_row_from_users');
SELECT ok(NOT has_function_privilege('anon', 'public.minimal_handle_new_user()', 'EXECUTE'), 'anon cannot run minimal_handle_new_user');
SELECT ok(NOT has_function_privilege('anon', 'public.respond_to_appointment(uuid, boolean)', 'EXECUTE'), 'anon cannot run respond_to_appointment');
SELECT ok(NOT has_function_privilege('anon', 'public.is_verified_doctor()', 'EXECUTE'), 'anon cannot run is_verified_doctor');
SELECT ok(NOT has_function_privilege('authenticated', 'public.get_doctor_reports_with_ml(uuid)', 'EXECUTE'), 'unused get_doctor_reports_with_ml is server-only');
SELECT ok(NOT has_function_privilege('authenticated', 'public.resolve_doctor_id(text)', 'EXECUTE'), 'unused resolve_doctor_id is server-only');
SELECT ok(NOT has_function_privilege('authenticated', 'public.resolve_patient_id(text)', 'EXECUTE'), 'unused resolve_patient_id is server-only');
SELECT ok(has_function_privilege('authenticated', 'public.safe_appointment_update(text, jsonb)', 'EXECUTE'), 'signed-in app can still call safe_appointment_update');

SET LOCAL ROLE authenticated;

-- C1: messages are visible only to their sender and receiver.
SELECT set_config('request.jwt.claim.sub','52222222-2222-4222-8222-222222222222',true);
SELECT is((SELECT count(*)::int FROM public.messages WHERE id = 'a2000000-0000-4000-8000-000000000001'), 0, 'P2 cannot read a D1-P1 message');
SELECT set_config('request.jwt.claim.sub','51111111-1111-4111-8111-111111111111',true);
SELECT is((SELECT count(*)::int FROM public.messages WHERE id = 'a2000000-0000-4000-8000-000000000001'), 1, 'P1 reads own message');

-- H1: browsers cannot create notifications (server routes use the service role).
SELECT throws_ok($$INSERT INTO public.notifications(user_id,title,message,notification_type) VALUES ('52222222-2222-4222-8222-222222222222','x','x','general')$$,'42501',NULL,'P1 cannot notify P2');
SELECT throws_ok($$INSERT INTO public.notifications(user_id,title,message,notification_type) VALUES ('51111111-1111-4111-8111-111111111111','x','x','general')$$,'42501',NULL,'P1 cannot insert notifications at all');

-- Directory: patients and unverified doctors cannot list patients.
SELECT is((SELECT count(*)::int FROM public.profile_directory WHERE id IN (
  '51111111-1111-4111-8111-111111111111','52222222-2222-4222-8222-222222222222','53333333-3333-4333-8333-333333333333',
  '54444444-4444-4444-8444-444444444444','55555555-5555-4555-8555-555555555555')), 3, 'P1 sees self, D1 and L1 only');

-- C3: only the appointment's doctor can rewrite it.
SELECT is(public.safe_appointment_update('a1000000-0000-4000-8000-000000000001','{"diagnosis":"tampered"}')->>'success','false','patient cannot update an appointment');
SELECT set_config('request.jwt.claim.sub','54444444-4444-4444-8444-444444444444',true);
SELECT is(public.safe_appointment_update('a1000000-0000-4000-8000-000000000001','{"diagnosis":"tampered"}')->>'success','false','another doctor cannot update the appointment');
SELECT is((SELECT count(*)::int FROM public.profile_directory WHERE id IN (
  '51111111-1111-4111-8111-111111111111','52222222-2222-4222-8222-222222222222','53333333-3333-4333-8333-333333333333',
  '54444444-4444-4444-8444-444444444444','55555555-5555-4555-8555-555555555555')), 3, 'unverified D2 sees self, D1 and L1, no patients');

-- D1 verification gate.
SELECT throws_ok($$INSERT INTO public.appointments (doctor_id, patient_id, appointment_date, start_time) VALUES ('54444444-4444-4444-8444-444444444444','51111111-1111-4111-8111-111111111111',current_date + 3,'09:00')$$,'42501',NULL,'unverified doctor cannot schedule');
SELECT throws_ok($$UPDATE public.profiles SET verified = true WHERE id = '54444444-4444-4444-8444-444444444444'$$,'42501',NULL,'doctor cannot verify themselves');

SELECT set_config('request.jwt.claim.sub','53333333-3333-4333-8333-333333333333',true);
SELECT is((SELECT diagnosis FROM public.appointments WHERE id = 'a1000000-0000-4000-8000-000000000001'), NULL, 'rejected updates left the diagnosis untouched');
SELECT is(public.safe_appointment_update('a1000000-0000-4000-8000-000000000001','{"diagnosis":"ok"}')->>'success','true','the appointment''s doctor can update it');
SELECT lives_ok($$INSERT INTO public.appointments (doctor_id, patient_id, appointment_date, start_time) VALUES ('53333333-3333-4333-8333-333333333333','51111111-1111-4111-8111-111111111111',current_date + 3,'09:00')$$,'verified doctor can schedule');
SELECT throws_ok($$INSERT INTO public.doctor_patient_assignments (doctor_id, patient_id) VALUES ('53333333-3333-4333-8333-333333333333','52222222-2222-4222-8222-222222222222')$$,'42501',NULL,'doctor cannot assign a patient to themselves');
SELECT is((SELECT count(*)::int FROM public.profile_directory WHERE id IN (
  '51111111-1111-4111-8111-111111111111','52222222-2222-4222-8222-222222222222','53333333-3333-4333-8333-333333333333',
  '54444444-4444-4444-8444-444444444444','55555555-5555-4555-8555-555555555555')), 5, 'verified D1 sees everyone');
SELECT is((SELECT count(*)::int FROM public.get_doctor_patients_bulletproof('53333333-3333-4333-8333-333333333333')), 0, 'D1 has no patients before anyone confirms');

-- Patients confirm or decline doctor-initiated appointments.
SELECT set_config('request.jwt.claim.sub','52222222-2222-4222-8222-222222222222',true);
SELECT throws_ok($$SELECT public.respond_to_appointment('a1000000-0000-4000-8000-000000000001', true)$$,'P0002',NULL,'P2 cannot answer P1''s appointment');
SELECT throws_ok($$SELECT public.respond_to_appointment('a1000000-0000-4000-8000-000000000004', true)$$,'42501',NULL,'nobody can confirm an unverified doctor');

SELECT set_config('request.jwt.claim.sub','51111111-1111-4111-8111-111111111111',true);
SELECT is(public.respond_to_appointment('a1000000-0000-4000-8000-000000000001', true), 'confirmed', 'P1 confirms D1''s appointment');
SELECT is((SELECT count(*)::int FROM public.doctor_patient_assignments
           WHERE doctor_id = '53333333-3333-4333-8333-333333333333' AND patient_id = '51111111-1111-4111-8111-111111111111' AND is_active), 1,
  'confirming assigns P1 to D1');
SELECT throws_ok($$SELECT public.respond_to_appointment('a1000000-0000-4000-8000-000000000001', true)$$,'22023',NULL,'an appointment can be answered only once');
SELECT is(public.respond_to_appointment('a1000000-0000-4000-8000-000000000003', false), 'cancelled', 'P1 declines another appointment');

SELECT set_config('request.jwt.claim.sub','53333333-3333-4333-8333-333333333333',true);
SELECT is((SELECT count(*)::int FROM public.get_doctor_patients_bulletproof('53333333-3333-4333-8333-333333333333')
           WHERE patient_id = '51111111-1111-4111-8111-111111111111'), 1, 'D1''s assigned-patients list shows P1');
SELECT is((SELECT count(*)::int FROM public.get_doctor_patients_bulletproof('54444444-4444-4444-8444-444444444444')), 0,
  'a doctor cannot list another doctor''s patients');

SELECT * FROM finish();
ROLLBACK;
