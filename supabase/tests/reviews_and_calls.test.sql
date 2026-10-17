BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

-- Tests for 20261019120000_report_reviews_and_call_security.sql.
-- Fixtures: patient P; verified doctors D and D2 treating P; verified doctor DX not
-- treating P; verified lab L. Report R (uploaded by L for D) with an AI result; a
-- confirmed appointment A between D and P with a meeting.
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
VALUES
 ('81111111-1111-4111-8111-111111111111','authenticated','authenticated','rv-p@example.test','',now(),'{}','{"name":"P","role":"patient"}'),
 ('82222222-2222-4222-8222-222222222222','authenticated','authenticated','rv-d@example.test','',now(),'{}','{"name":"D","role":"doctor","license_number":"GMC-81"}'),
 ('83333333-3333-4333-8333-333333333333','authenticated','authenticated','rv-d2@example.test','',now(),'{}','{"name":"D2","role":"doctor","license_number":"GMC-82"}'),
 ('84444444-4444-4444-8444-444444444444','authenticated','authenticated','rv-dx@example.test','',now(),'{}','{"name":"DX","role":"doctor","license_number":"GMC-83"}'),
 ('85555555-5555-4555-8555-555555555555','authenticated','authenticated','rv-l@example.test','',now(),'{}','{"name":"L","role":"lab","license_number":"NABL-81"}');

UPDATE public.profiles SET verified = true WHERE id IN
 ('82222222-2222-4222-8222-222222222222','83333333-3333-4333-8333-333333333333','84444444-4444-4444-8444-444444444444','85555555-5555-4555-8555-555555555555');

INSERT INTO public.doctor_patient_assignments (doctor_id, patient_id, is_active) VALUES
 ('82222222-2222-4222-8222-222222222222','81111111-1111-4111-8111-111111111111',true),
 ('83333333-3333-4333-8333-333333333333','81111111-1111-4111-8111-111111111111',true);

INSERT INTO public.reports (id, patient_id, doctor_id, test_type, original_name, file_name, uploaded_by) VALUES
 ('d3000000-0000-4000-8000-000000000001','81111111-1111-4111-8111-111111111111','82222222-2222-4222-8222-222222222222',
  'x_ray','arm.png','arm.png','85555555-5555-4555-8555-555555555555');
INSERT INTO public.ml_suggestions (report_id, patient_id, test_type, findings, confidence, severity, status) VALUES
 ('d3000000-0000-4000-8000-000000000001','81111111-1111-4111-8111-111111111111','x_ray','Fracture detected',0.87,'moderate','pending_review');

INSERT INTO public.appointments (id, doctor_id, patient_id, appointment_date, start_time, end_time, status) VALUES
 ('d1000000-0000-4000-8000-000000000001','82222222-2222-4222-8222-222222222222','81111111-1111-4111-8111-111111111111',current_date + 1,'10:00','10:30','confirmed');
INSERT INTO public.consultation_meetings (appointment_id, meeting_id, password, host_id) VALUES
 ('d1000000-0000-4000-8000-000000000001','M1','secret','82222222-2222-4222-8222-222222222222');

CREATE FUNCTION pg_temp.as_user(uid text) RETURNS void
LANGUAGE sql AS $$ SELECT set_config('request.jwt.claim.sub', uid, true); $$;

SELECT plan(24);

-- Run as postgres.
SELECT has_table('public', 'report_reviews', 'reviews are stored');
SELECT has_column('public', 'appointments', 'call_secret', 'every appointment has a call secret');
SELECT ok(NOT has_function_privilege('anon', 'public.submit_report_review(uuid, text, text, text, text)', 'EXECUTE'), 'anon cannot submit reviews');

SET LOCAL ROLE authenticated;

-- A doctor who is not treating P.
SELECT pg_temp.as_user('84444444-4444-4444-8444-444444444444');
SELECT throws_ok($$SELECT public.submit_report_review('d3000000-0000-4000-8000-000000000001','agree','x',NULL,NULL)$$,
  '42501', NULL, 'a doctor not treating the patient cannot review');
SELECT is((SELECT count(*)::int FROM public.consultation_meetings WHERE appointment_id = 'd1000000-0000-4000-8000-000000000001'), 0,
  'outsiders cannot see a consultation meeting');
SELECT throws_ok($$INSERT INTO public.consultation_meetings (appointment_id, meeting_id, password, host_id)
  VALUES ('d1000000-0000-4000-8000-000000000001','M2','x','84444444-4444-4444-8444-444444444444')$$,
  '42501', NULL, 'outsiders cannot create a meeting for someone else''s appointment');
SELECT is((SELECT count(*)::int FROM public.appointments WHERE id = 'd1000000-0000-4000-8000-000000000001'), 0,
  'outsiders cannot read the appointment (or its call secret)');
SELECT throws_ok($$INSERT INTO storage.objects (bucket_id, name) VALUES ('review-notes','d3000000-0000-4000-8000-000000000001/84444444-4444-4444-8444-444444444444-1.jpg')$$,
  '42501', NULL, 'outsiders cannot attach note photos to the report');

-- D, who treats P, reviews the report.
SELECT pg_temp.as_user('82222222-2222-4222-8222-222222222222');
SELECT lives_ok($$INSERT INTO storage.objects (bucket_id, name) VALUES ('review-notes','d3000000-0000-4000-8000-000000000001/82222222-2222-4222-8222-222222222222-1.jpg')$$,
  'the treating doctor uploads a photo of a handwritten note');
SELECT throws_ok($$SELECT public.submit_report_review('d3000000-0000-4000-8000-000000000001','agree','x',NULL,'other-report/photo.jpg')$$,
  '22023', NULL, 'a review cannot point at someone else''s photo');
SELECT lives_ok($$SELECT public.submit_report_review('d3000000-0000-4000-8000-000000000001','agree',
  'Your arm is fractured; keep the cast on.', 'Re-image in 6 weeks.',
  'd3000000-0000-4000-8000-000000000001/82222222-2222-4222-8222-222222222222-1.jpg')$$,
  'the treating doctor saves a review');
SELECT is((SELECT status FROM public.ml_suggestions WHERE report_id = 'd3000000-0000-4000-8000-000000000001'), 'accepted',
  'agreeing marks the AI result accepted (the old Approve button never saved)');
SELECT is((SELECT count(*)::int FROM public.consultation_meetings WHERE appointment_id = 'd1000000-0000-4000-8000-000000000001'), 1,
  'the appointment''s doctor sees the meeting');

-- D2, also treating P, gives a second opinion.
SELECT pg_temp.as_user('83333333-3333-4333-8333-333333333333');
SELECT is((SELECT count(*)::int FROM public.report_review_private_notes), 1, 'the patient''s other doctors read private notes');
SELECT lives_ok($$SELECT public.submit_report_review('d3000000-0000-4000-8000-000000000001','unclear','Let us discuss.',NULL,NULL)$$,
  'a second doctor adds their own review');
SELECT is((SELECT count(*)::int FROM public.report_reviews WHERE report_id = 'd3000000-0000-4000-8000-000000000001'), 2,
  'each doctor has their own review');

-- The patient.
SELECT pg_temp.as_user('81111111-1111-4111-8111-111111111111');
SELECT is((SELECT count(*)::int FROM public.report_reviews), 2, 'the patient reads both reviews');
SELECT is((SELECT count(*)::int FROM public.report_review_private_notes), 0, 'the patient cannot read private notes');
SELECT is((SELECT count(*)::int FROM public.notifications WHERE notification_type = 'test_result'), 2, 'the patient is told about each review');
SELECT is((SELECT count(*)::int FROM storage.objects WHERE bucket_id = 'review-notes'), 1, 'the patient can open the note photo');
SELECT throws_ok($$INSERT INTO public.report_reviews (report_id, doctor_id, verdict) VALUES ('d3000000-0000-4000-8000-000000000001','81111111-1111-4111-8111-111111111111','agree')$$,
  '42501', NULL, 'nobody writes reviews directly');
SELECT is((SELECT count(*)::int FROM public.consultation_meetings WHERE appointment_id = 'd1000000-0000-4000-8000-000000000001'), 1,
  'the appointment''s patient sees the meeting');

-- The lab that uploaded the report.
SELECT pg_temp.as_user('85555555-5555-4555-8555-555555555555');
SELECT is((SELECT count(*)::int FROM public.report_reviews), 0, 'labs do not see doctors'' reviews');

RESET ROLE;
SET LOCAL ROLE anon;
SELECT throws_ok($$SELECT count(*) FROM public.consultation_meetings$$, '42501', NULL, 'signed-out visitors cannot read meetings at all');

SELECT * FROM finish();
ROLLBACK;
