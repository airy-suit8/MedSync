BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

-- Tests for 20261017120000_lab_verification_and_read_receipts.sql.
-- Fixtures: patient P, verified doctor D (assigned to P), verified lab LV, unverified lab LU.
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
VALUES
 ('61111111-1111-4111-8111-111111111111','authenticated','authenticated','lv-p@example.test','',now(),'{}','{"name":"P","role":"patient"}'),
 ('62222222-2222-4222-8222-222222222222','authenticated','authenticated','lv-d@example.test','',now(),'{}','{"name":"D","role":"doctor","license_number":"GMC-9"}'),
 ('63333333-3333-4333-8333-333333333333','authenticated','authenticated','lv-lv@example.test','',now(),'{}','{"name":"LV","role":"lab","license_number":"NABL-1"}'),
 ('64444444-4444-4444-8444-444444444444','authenticated','authenticated','lv-lu@example.test','',now(),'{}','{"name":"LU","role":"lab","license_number":"NABL-2"}');

UPDATE public.profiles SET verified = true
WHERE id IN ('62222222-2222-4222-8222-222222222222','63333333-3333-4333-8333-333333333333');

INSERT INTO public.doctor_patient_assignments (doctor_id, patient_id, is_active)
VALUES ('62222222-2222-4222-8222-222222222222','61111111-1111-4111-8111-111111111111',true);

-- A report LU uploaded before it lost verification.
INSERT INTO public.reports (id, patient_id, doctor_id, test_type, original_name, file_name, uploaded_by) VALUES
 ('b3000000-0000-4000-8000-000000000001','61111111-1111-4111-8111-111111111111','62222222-2222-4222-8222-222222222222','x_ray','old.png','old.png','64444444-4444-4444-8444-444444444444');

-- D -> P (unread) and P -> D (unread).
INSERT INTO public.messages (id, content, sender_id, sender_name, sender_role, receiver_id, receiver_name, receiver_role) VALUES
 ('b2000000-0000-4000-8000-000000000001','to patient','62222222-2222-4222-8222-222222222222','D','doctor','61111111-1111-4111-8111-111111111111','P','patient'),
 ('b2000000-0000-4000-8000-000000000002','to doctor','61111111-1111-4111-8111-111111111111','P','patient','62222222-2222-4222-8222-222222222222','D','doctor');

CREATE FUNCTION pg_temp.affected_rows(statement text) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE affected integer;
BEGIN
  EXECUTE statement;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

SELECT plan(21);

-- Run as postgres.
SELECT is((SELECT verified FROM public.profiles WHERE id = '64444444-4444-4444-8444-444444444444'), false, 'new labs start unverified');
SELECT is((SELECT license_number FROM public.profiles WHERE id = '64444444-4444-4444-8444-444444444444'), 'NABL-2', 'signup stores the lab registration number');
SELECT ok(NOT has_function_privilege('anon', 'public.is_verified_lab()', 'EXECUTE'), 'anon cannot run is_verified_lab');
SELECT ok(NOT has_function_privilege('anon', 'public.mark_messages_read(uuid)', 'EXECUTE'), 'anon cannot run mark_messages_read');

SET LOCAL ROLE authenticated;

-- Unverified lab LU.
SELECT set_config('request.jwt.claim.sub','64444444-4444-4444-8444-444444444444',true);
SELECT is((SELECT count(*)::int FROM public.profile_directory WHERE id = '61111111-1111-4111-8111-111111111111'), 0, 'unverified lab cannot list patients');
SELECT is((SELECT count(*)::int FROM public.get_lab_upload_patient_profile('61111111-1111-4111-8111-111111111111','62222222-2222-4222-8222-222222222222')), 0,
  'unverified lab cannot read patient details for an upload');
SELECT is((SELECT count(*)::int FROM public.reports WHERE id = 'b3000000-0000-4000-8000-000000000001'), 0, 'unverified lab loses access to its old uploads');
SELECT throws_ok($$INSERT INTO public.reports (patient_id, doctor_id, test_type, original_name, file_name, uploaded_by)
  VALUES ('61111111-1111-4111-8111-111111111111','62222222-2222-4222-8222-222222222222','x_ray','j.png','j.png','64444444-4444-4444-8444-444444444444')$$,
  '42501',NULL,'unverified lab cannot create reports');
SELECT throws_ok($$INSERT INTO storage.objects (bucket_id, name) VALUES ('reports','junk.png')$$,'42501',NULL,'unverified lab cannot upload report files');
SELECT throws_ok($$INSERT INTO public.lab_samples (lab_id, patient_id, patient_name, sample_type, collection_date)
  VALUES ('64444444-4444-4444-8444-444444444444','61111111-1111-4111-8111-111111111111','P','blood',now())$$,'42501',NULL,'unverified lab cannot log samples');
SELECT throws_ok($$UPDATE public.profiles SET verified = true WHERE id = '64444444-4444-4444-8444-444444444444'$$,'42501',NULL,'lab cannot verify itself');

-- Verified lab LV.
SELECT set_config('request.jwt.claim.sub','63333333-3333-4333-8333-333333333333',true);
SELECT is((SELECT count(*)::int FROM public.profile_directory WHERE id = '61111111-1111-4111-8111-111111111111'), 1, 'verified lab lists patients');
SELECT is((SELECT count(*)::int FROM public.get_lab_upload_patient_profile('61111111-1111-4111-8111-111111111111','62222222-2222-4222-8222-222222222222')), 1,
  'verified lab reads patient details for an upload');
SELECT lives_ok($$INSERT INTO storage.objects (bucket_id, name) VALUES ('reports','lv-upload.png')$$,'verified lab uploads report files');
SELECT lives_ok($$INSERT INTO public.reports (patient_id, doctor_id, test_type, original_name, file_name, uploaded_by)
  VALUES ('61111111-1111-4111-8111-111111111111','62222222-2222-4222-8222-222222222222','x_ray','lv-upload.png','lv-upload.png','63333333-3333-4333-8333-333333333333')$$,
  'verified lab creates reports');
-- A third party can't mark D's messages to P as read.
SELECT lives_ok($$SELECT public.mark_messages_read('62222222-2222-4222-8222-222222222222')$$, 'mark_messages_read runs for anyone signed in');

-- Patient P.
SELECT set_config('request.jwt.claim.sub','61111111-1111-4111-8111-111111111111',true);
SELECT is((SELECT count(*)::int FROM public.profile_directory WHERE id = '64444444-4444-4444-8444-444444444444'), 0, 'unverified labs are not listed');
SELECT is((SELECT is_read FROM public.messages WHERE id = 'b2000000-0000-4000-8000-000000000001'), false, 'another user''s call left P''s message unread');
SELECT is(pg_temp.affected_rows($$UPDATE public.messages SET content = 'edited' WHERE id = 'b2000000-0000-4000-8000-000000000001'$$), 0,
  'the receiver still cannot edit a message');
SELECT public.mark_messages_read('62222222-2222-4222-8222-222222222222');
SELECT is((SELECT is_read FROM public.messages WHERE id = 'b2000000-0000-4000-8000-000000000001'), true, 'the receiver marks the doctor''s message read');
SELECT is((SELECT is_read FROM public.messages WHERE id = 'b2000000-0000-4000-8000-000000000002'), false, 'the patient''s own sent message stays unread');

SELECT * FROM finish();
ROLLBACK;
