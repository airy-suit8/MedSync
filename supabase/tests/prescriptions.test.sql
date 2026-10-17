BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

-- Tests for 20261019140000_prescriptions.sql.
-- Fixtures: patient P (and another patient P2); verified doctor D treating P; verified
-- doctor D2 also treating P; verified doctor DX not treating P.
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
VALUES
 ('a1111111-1111-4111-8111-111111111111','authenticated','authenticated','rx-p@example.test','',now(),'{}','{"name":"P","role":"patient"}'),
 ('a2222222-2222-4222-8222-222222222222','authenticated','authenticated','rx-p2@example.test','',now(),'{}','{"name":"P2","role":"patient"}'),
 ('a3333333-3333-4333-8333-333333333333','authenticated','authenticated','rx-d@example.test','',now(),'{}','{"name":"Dr D","role":"doctor","license_number":"GMC-123"}'),
 ('a4444444-4444-4444-8444-444444444444','authenticated','authenticated','rx-d2@example.test','',now(),'{}','{"name":"D2","role":"doctor","license_number":"GMC-124"}'),
 ('a5555555-5555-4555-8555-555555555555','authenticated','authenticated','rx-dx@example.test','',now(),'{}','{"name":"DX","role":"doctor","license_number":"GMC-125"}');
UPDATE public.profiles SET verified = true WHERE role = 'doctor' AND id IN
 ('a3333333-3333-4333-8333-333333333333','a4444444-4444-4444-8444-444444444444','a5555555-5555-4555-8555-555555555555');
INSERT INTO public.doctor_patient_assignments (doctor_id, patient_id, is_active) VALUES
 ('a3333333-3333-4333-8333-333333333333','a1111111-1111-4111-8111-111111111111',true),
 ('a4444444-4444-4444-8444-444444444444','a1111111-1111-4111-8111-111111111111',true);

CREATE FUNCTION pg_temp.as_user(uid text) RETURNS void
LANGUAGE sql AS $$ SELECT set_config('request.jwt.claim.sub', uid, true); $$;

SELECT plan(14);

SELECT ok(NOT has_function_privilege('anon', 'public.create_prescription(uuid, jsonb, text, text, uuid, uuid)', 'EXECUTE'), 'anon cannot prescribe');

SET LOCAL ROLE authenticated;

SELECT pg_temp.as_user('a5555555-5555-4555-8555-555555555555');
SELECT throws_ok($$SELECT public.create_prescription('a1111111-1111-4111-8111-111111111111','[{"medicine":"X"}]',NULL,NULL,NULL,NULL)$$,
  '42501', NULL, 'a doctor not treating the patient cannot prescribe');

SELECT pg_temp.as_user('a3333333-3333-4333-8333-333333333333');
SELECT throws_ok($$SELECT public.create_prescription('a1111111-1111-4111-8111-111111111111','[{"medicine":"  "}]',NULL,NULL,NULL,NULL)$$,
  '22023', NULL, 'a prescription needs at least one named medicine');
SELECT throws_ok($$SELECT public.create_prescription('a1111111-1111-4111-8111-111111111111','"not a list"',NULL,NULL,NULL,NULL)$$,
  '22023', NULL, 'items must be a list');
SELECT lives_ok($$SELECT public.create_prescription('a1111111-1111-4111-8111-111111111111',
  '[{"medicine":"Paracetamol 500 mg","dose":"1 tablet","frequency":"Three times a day","duration":"5 days","instructions":"after food","extra":"dropped"},
    {"medicine":"Cetirizine 10 mg","frequency":"At night"},{"medicine":""}]',
  'Viral fever','Rest and fluids',NULL,NULL)$$, 'the treating doctor prescribes');
SELECT is((SELECT jsonb_array_length(items) FROM public.prescriptions), 2, 'blank rows are dropped');
SELECT is((SELECT items->0->>'medicine' FROM public.prescriptions), 'Paracetamol 500 mg', 'medicines keep their order');
SELECT ok((SELECT NOT (items->0 ? 'extra') FROM public.prescriptions), 'unknown fields are dropped');
SELECT is((SELECT doctor_registration FROM public.prescriptions), 'GMC-123', 'the doctor''s registration number is recorded');

SELECT pg_temp.as_user('a4444444-4444-4444-8444-444444444444');
SELECT is((SELECT count(*)::int FROM public.prescriptions), 1, 'the patient''s other doctor can read it');
SELECT throws_ok($$SELECT public.cancel_prescription((SELECT id FROM public.prescriptions LIMIT 1))$$,
  'P0002', NULL, 'only the prescribing doctor can cancel it');

SELECT pg_temp.as_user('a1111111-1111-4111-8111-111111111111');
SELECT is((SELECT count(*)::int FROM public.notifications WHERE notification_type = 'prescription_update'), 1, 'the patient is told');

SELECT pg_temp.as_user('a2222222-2222-4222-8222-222222222222');
SELECT is((SELECT count(*)::int FROM public.prescriptions), 0, 'other patients cannot read it');

SELECT pg_temp.as_user('a5555555-5555-4555-8555-555555555555');
SELECT is((SELECT count(*)::int FROM public.prescriptions), 0, 'doctors not treating the patient cannot read it');

SELECT * FROM finish();
ROLLBACK;
