BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

-- Tests for 20261019150000_health_record.sql.
-- Fixtures: patient P with doctor D (current) and a report; doctor DX (not treating P).
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
VALUES
 ('b1111111-1111-4111-8111-111111111111','authenticated','authenticated','hr-p@example.test','',now(),'{}','{"name":"P","role":"patient"}'),
 ('b2222222-2222-4222-8222-222222222222','authenticated','authenticated','hr-d@example.test','',now(),'{}','{"name":"D","role":"doctor","license_number":"G-1"}'),
 ('b3333333-3333-4333-8333-333333333333','authenticated','authenticated','hr-dx@example.test','',now(),'{}','{"name":"DX","role":"doctor","license_number":"G-2"}');
UPDATE public.profiles SET verified = true WHERE id IN ('b2222222-2222-4222-8222-222222222222','b3333333-3333-4333-8333-333333333333');
INSERT INTO public.doctor_patient_assignments (doctor_id, patient_id, is_active)
VALUES ('b2222222-2222-4222-8222-222222222222','b1111111-1111-4111-8111-111111111111',true);
INSERT INTO public.reports (patient_id, doctor_id, test_type, original_name, file_name)
VALUES ('b1111111-1111-4111-8111-111111111111','b2222222-2222-4222-8222-222222222222','x_ray','a.png','a.png');

CREATE FUNCTION pg_temp.as_user(uid text) RETURNS void
LANGUAGE sql AS $$ SELECT set_config('request.jwt.claim.sub', uid, true); $$;

SELECT plan(10);

SET LOCAL ROLE authenticated;

-- The patient fills in their profile.
SELECT pg_temp.as_user('b1111111-1111-4111-8111-111111111111');
SELECT lives_ok($$UPDATE public.profiles SET allergies = 'Penicillin', blood_type = 'O+' WHERE id = 'b1111111-1111-4111-8111-111111111111'$$,
  'patients edit their health profile');
SELECT throws_ok($$UPDATE public.profiles SET allergies = repeat('x', 1001) WHERE id = 'b1111111-1111-4111-8111-111111111111'$$,
  '23514', NULL, 'health text has a length limit');
SELECT is((SELECT count(*)::int FROM public.get_patient_timeline('b1111111-1111-4111-8111-111111111111') WHERE kind IN ('report', 'care')), 2,
  'the patient''s timeline shows the report and the start of care');

-- Their doctor reads it and prescribes; the prescription joins the timeline.
SELECT pg_temp.as_user('b2222222-2222-4222-8222-222222222222');
SELECT is((SELECT allergies FROM public.get_patient_record('b1111111-1111-4111-8111-111111111111')), 'Penicillin',
  'the treating doctor sees the patient''s allergies');
SELECT lives_ok($$SELECT public.create_prescription('b1111111-1111-4111-8111-111111111111','[{"medicine":"Ibuprofen 400 mg"}]',NULL,NULL,NULL,NULL)$$,
  'the doctor prescribes from the record');
SELECT is((SELECT count(*)::int FROM public.get_patient_timeline('b1111111-1111-4111-8111-111111111111') WHERE kind = 'prescription'), 1,
  'prescriptions appear in the timeline');

-- A doctor not treating the patient sees nothing.
SELECT pg_temp.as_user('b3333333-3333-4333-8333-333333333333');
SELECT is((SELECT count(*)::int FROM public.get_patient_record('b1111111-1111-4111-8111-111111111111')), 0, 'other doctors cannot read the record');
SELECT is((SELECT count(*)::int FROM public.get_patient_timeline('b1111111-1111-4111-8111-111111111111')), 0, 'or the timeline');

-- After care ends, the doctor loses the record; the patient's timeline shows the end.
SELECT pg_temp.as_user('b1111111-1111-4111-8111-111111111111');
SELECT public.end_care('b2222222-2222-4222-8222-222222222222');
SELECT is((SELECT count(*)::int FROM public.get_patient_timeline('b1111111-1111-4111-8111-111111111111') WHERE title LIKE 'Care ended%'), 1,
  'ending care is recorded in the timeline');
SELECT pg_temp.as_user('b2222222-2222-4222-8222-222222222222');
SELECT is((SELECT count(*)::int FROM public.get_patient_record('b1111111-1111-4111-8111-111111111111')), 0, 'a former doctor cannot read the record');

SELECT * FROM finish();
ROLLBACK;
