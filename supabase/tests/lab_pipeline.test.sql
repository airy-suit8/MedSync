BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

-- Tests for 20261019130000_lab_pipeline.sql.
-- Fixtures: patient P with verified doctors D1 and D2 (and a past doctor D3, care ended);
-- verified lab L, unverified lab LU.
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
VALUES
 ('91111111-1111-4111-8111-111111111111','authenticated','authenticated','lp-p@example.test','',now(),'{}','{"name":"P","role":"patient"}'),
 ('92222222-2222-4222-8222-222222222222','authenticated','authenticated','lp-d1@example.test','',now(),'{}','{"name":"D1","role":"doctor","license_number":"G-91"}'),
 ('93333333-3333-4333-8333-333333333333','authenticated','authenticated','lp-d2@example.test','',now(),'{}','{"name":"D2","role":"doctor","license_number":"G-92"}'),
 ('94444444-4444-4444-8444-444444444444','authenticated','authenticated','lp-d3@example.test','',now(),'{}','{"name":"D3","role":"doctor","license_number":"G-93"}'),
 ('95555555-5555-4555-8555-555555555555','authenticated','authenticated','lp-l@example.test','',now(),'{}','{"name":"L","role":"lab","license_number":"N-91"}'),
 ('96666666-6666-4666-8666-666666666666','authenticated','authenticated','lp-lu@example.test','',now(),'{}','{"name":"LU","role":"lab","license_number":"N-92"}');

UPDATE public.profiles SET verified = true WHERE id IN
 ('92222222-2222-4222-8222-222222222222','93333333-3333-4333-8333-333333333333','94444444-4444-4444-8444-444444444444','95555555-5555-4555-8555-555555555555');

INSERT INTO public.doctor_patient_assignments (doctor_id, patient_id, is_active) VALUES
 ('92222222-2222-4222-8222-222222222222','91111111-1111-4111-8111-111111111111',true),
 ('93333333-3333-4333-8333-333333333333','91111111-1111-4111-8111-111111111111',true),
 ('94444444-4444-4444-8444-444444444444','91111111-1111-4111-8111-111111111111',false);

-- A report file in use, and one left behind by a failed upload; both uploaded by L.
INSERT INTO storage.objects (bucket_id, name, owner) VALUES
 ('reports','used.pdf','95555555-5555-4555-8555-555555555555'),
 ('reports','orphan.pdf','95555555-5555-4555-8555-555555555555');
INSERT INTO public.reports (patient_id, doctor_id, test_type, original_name, file_name, uploaded_by) VALUES
 ('91111111-1111-4111-8111-111111111111','92222222-2222-4222-8222-222222222222','blood_test','used.pdf','used.pdf','95555555-5555-4555-8555-555555555555');

CREATE FUNCTION pg_temp.as_user(uid text) RETURNS void
LANGUAGE sql AS $$ SELECT set_config('request.jwt.claim.sub', uid, true); $$;

-- Rows a caller's delete of a report file actually removed (RLS filters silently).
CREATE FUNCTION pg_temp.affected_delete(file text) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  DELETE FROM storage.objects WHERE bucket_id = 'reports' AND name = file;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- Newer Supabase blocks SQL deletes on storage tables unless this is set; the Storage
-- API the app uses applies the same RLS policies.
SELECT set_config('storage.allow_delete_query', 'true', true);

SELECT plan(11);

SELECT is((SELECT ai_status FROM public.reports WHERE file_name = 'used.pdf'), 'pending', 'new reports start with the AI pending');
SELECT throws_ok($$UPDATE public.reports SET ai_status = 'maybe' WHERE file_name = 'used.pdf'$$, '23514', NULL, 'AI status takes known values only');
SELECT has_column('public', 'ml_suggestions', 'details', 'AI readings can carry structured values');

-- Storage RLS only matches the Storage API's auth, so a SQL caller cannot see the row to delete it;
-- the orphan-delete rule is checked on the policy itself.
SELECT ok((SELECT cmd = 'DELETE' AND roles = '{authenticated}'
             AND qual LIKE '%bucket_id = ''reports''%'
             AND qual LIKE '%owner = ( SELECT auth.uid()%'
             AND qual LIKE '%NOT (EXISTS%r.file_name = objects.name%'
           FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'reports_objects_delete_own_orphan'),
  'a lab can delete only its own leftover report files (owner, and no report uses the file)');
SELECT is((SELECT count(*)::int FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
             AND cmd IN ('DELETE', 'ALL') AND qual LIKE '%''reports''%'), 1,
  'no other policy lets anyone delete report files');

SET LOCAL ROLE authenticated;

SELECT pg_temp.as_user('95555555-5555-4555-8555-555555555555');
SELECT is((SELECT count(*)::int FROM public.get_patient_doctors_for_lab('91111111-1111-4111-8111-111111111111')), 2,
  'a verified lab sees the patient''s current doctors (not past ones)');
SELECT throws_ok($$UPDATE public.reports SET ai_status = 'done' WHERE file_name = 'used.pdf'$$, '42501', NULL,
  'labs cannot set the AI status (server only)');
SELECT is(pg_temp.affected_delete('used.pdf'), 0, 'a lab cannot delete a file a report uses');

SELECT pg_temp.as_user('96666666-6666-4666-8666-666666666666');
SELECT is((SELECT count(*)::int FROM public.get_patient_doctors_for_lab('91111111-1111-4111-8111-111111111111')), 0,
  'an unverified lab sees no doctors');

SELECT pg_temp.as_user('91111111-1111-4111-8111-111111111111');
SELECT is((SELECT count(*)::int FROM public.get_patient_doctors_for_lab('91111111-1111-4111-8111-111111111111')), 0,
  'patients cannot use the lab lookup');
SELECT ok(NOT has_function_privilege('anon', 'public.get_patient_doctors_for_lab(uuid)', 'EXECUTE'), 'anon cannot run the lab lookup');

SELECT * FROM finish();
ROLLBACK;
