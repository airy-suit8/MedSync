BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

-- Four real auth/profile rows: two patients, one doctor, one lab user.
-- The doctor has exactly one active assignment (patient A).
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
VALUES
 ('11111111-1111-4111-8111-111111111111','authenticated','authenticated','rls-patient-a@example.test','',now(),'{}','{"name":"Patient A","role":"patient"}'),
 ('22222222-2222-4222-8222-222222222222','authenticated','authenticated','rls-patient-b@example.test','',now(),'{}','{"name":"Patient B","role":"patient"}'),
 ('33333333-3333-4333-8333-333333333333','authenticated','authenticated','rls-doctor@example.test','',now(),'{}','{"name":"Doctor","role":"doctor"}'),
 ('44444444-4444-4444-8444-444444444444','authenticated','authenticated','rls-lab@example.test','',now(),'{}','{"name":"Lab","role":"lab"}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.doctor_patient_assignments (id, doctor_id, patient_id, is_active)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',true);

UPDATE public.profiles
SET date_of_birth = '1980-01-02', gender = 'female', phone = '555-0100',
    address = 'Private Address', chronic_conditions = 'Private Condition',
    current_medications = 'Private Medication', allergies = 'Private Allergy'
WHERE id = '11111111-1111-4111-8111-111111111111';

INSERT INTO public.reports (id, patient_id, test_type, original_name, file_name, uploaded_by)
VALUES
 ('aaaaaaaa-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','blood','a.pdf','a.pdf','44444444-4444-4444-8444-444444444444'),
 ('aaaaaaaa-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222','blood','b.pdf','b.pdf','22222222-2222-4222-8222-222222222222');

-- Distinct immutable probe rows ensure a preceding DELETE assertion cannot
-- consume the row used by another role's DELETE cell.
INSERT INTO public.reports (id, patient_id, test_type, original_name, file_name, uploaded_by)
VALUES
 ('aaaaaaaa-0000-4000-8000-000000000011','11111111-1111-4111-8111-111111111111','blood','delete-a.pdf','delete-a.pdf','44444444-4444-4444-8444-444444444444'),
 ('aaaaaaaa-0000-4000-8000-000000000012','11111111-1111-4111-8111-111111111111','blood','delete-b.pdf','delete-b.pdf','44444444-4444-4444-8444-444444444444'),
 ('aaaaaaaa-0000-4000-8000-000000000013','11111111-1111-4111-8111-111111111111','blood','delete-doctor.pdf','delete-doctor.pdf','44444444-4444-4444-8444-444444444444'),
 ('aaaaaaaa-0000-4000-8000-000000000014','11111111-1111-4111-8111-111111111111','blood','delete-lab.pdf','delete-lab.pdf','44444444-4444-4444-8444-444444444444');

INSERT INTO public.ml_suggestions (id, report_id, patient_id, test_type, findings, confidence)
VALUES
 ('bbbbbbbb-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','blood','A finding',0.80),
 ('bbbbbbbb-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222','blood','B finding',0.70);

INSERT INTO public.notifications (id, user_id, title, message, notification_type)
VALUES
 ('cccccccc-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','A','A notice','general'),
 ('cccccccc-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222','B','B notice','general');

INSERT INTO public.lab_samples (id, lab_id, patient_id, patient_name, sample_type, collection_date)
VALUES ('dddddddd-0000-4000-8000-000000000001','44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','Patient A','Blood',now());

INSERT INTO public.imaging_studies (id, lab_id, patient_id, patient_name, study_type, body_part, scheduled_date)
VALUES ('eeeeeeee-0000-4000-8000-000000000001','44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','Patient A','X-Ray','Chest',now());

CREATE FUNCTION pg_temp.affected_rows(statement text) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE affected integer;
BEGIN
  EXECUTE statement;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

SELECT plan(107);
SET LOCAL ROLE authenticated;

-- SELECT cell: reports
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
SELECT throws_ok($$UPDATE public.profiles SET role='doctor' WHERE id='11111111-1111-4111-8111-111111111111'$$,'42501',NULL,'patient cannot change trusted profile role');
SELECT is((SELECT count(*)::int FROM public.reports WHERE id IN ('aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000002')),1,'patient A sees only patient A report');
SELECT is((SELECT count(*)::int FROM public.ml_suggestions WHERE id IN ('bbbbbbbb-0000-4000-8000-000000000001','bbbbbbbb-0000-4000-8000-000000000002')),1,'patient A sees only patient A suggestion');
SELECT is((SELECT count(*)::int FROM public.notifications WHERE id IN ('cccccccc-0000-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000002')),1,'patient A sees only patient A notification');
SELECT is((SELECT count(*)::int FROM public.profiles WHERE id IN ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444')),1,'patient A reads only own full profile');
SELECT is((SELECT count(*)::int FROM public.profile_directory WHERE id IN ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444')),4,'patient A can read safe directory entries');
SELECT is((SELECT count(*)::int FROM public.doctor_patient_assignments WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),1,'patient A sees own assignment');
SELECT is((SELECT count(*)::int FROM public.lab_samples),0,'patient cannot read lab samples');
SELECT is((SELECT count(*)::int FROM public.imaging_studies),0,'patient cannot read imaging studies');

SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
SELECT is((SELECT count(*)::int FROM public.reports WHERE id IN ('aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000002')),1,'patient B sees only patient B report');
SELECT is((SELECT count(*)::int FROM public.ml_suggestions WHERE id IN ('bbbbbbbb-0000-4000-8000-000000000001','bbbbbbbb-0000-4000-8000-000000000002')),1,'patient B sees only patient B suggestion');
SELECT is((SELECT count(*)::int FROM public.notifications WHERE id IN ('cccccccc-0000-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000002')),1,'patient B sees only patient B notification');
SELECT is((SELECT count(*)::int FROM public.profiles WHERE id IN ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444')),1,'patient B reads only own full profile');
SELECT is((SELECT count(*)::int FROM public.profile_directory WHERE id IN ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444')),4,'patient B can read safe directory entries');
SELECT is((SELECT count(*)::int FROM public.doctor_patient_assignments WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),0,'patient B sees no assignments');

SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
SELECT is((SELECT count(*)::int FROM public.reports WHERE id IN ('aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000002')),1,'doctor sees only assigned patient A report');
SELECT is((SELECT count(*)::int FROM public.ml_suggestions WHERE id IN ('bbbbbbbb-0000-4000-8000-000000000001','bbbbbbbb-0000-4000-8000-000000000002')),1,'doctor sees only assigned patient A suggestion');
SELECT is((SELECT count(*)::int FROM public.notifications WHERE id IN ('cccccccc-0000-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000002')),0,'doctor sees no patient notifications');
SELECT is((SELECT count(*)::int FROM public.profiles WHERE id IN ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444')),1,'doctor reads only own full profile');
SELECT is((SELECT count(*)::int FROM public.profiles WHERE id='11111111-1111-4111-8111-111111111111'),0,'assigned doctor cannot directly read patient clinical profile');
SELECT is((SELECT count(*)::int FROM public.profile_directory WHERE id IN ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444')),4,'doctor can read safe directory entries');
SELECT is((SELECT count(*)::int FROM public.doctor_patient_assignments WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),1,'doctor sees own assignment');
SELECT is((SELECT count(*)::int FROM public.lab_samples),0,'doctor cannot read lab samples');
SELECT is((SELECT count(*)::int FROM public.imaging_studies),0,'doctor cannot read imaging studies');

SELECT set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
SELECT is((SELECT count(*)::int FROM public.reports WHERE id IN ('aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000002')),1,'lab sees only its own uploaded report');
SELECT is((SELECT count(*)::int FROM public.ml_suggestions WHERE id IN ('bbbbbbbb-0000-4000-8000-000000000001','bbbbbbbb-0000-4000-8000-000000000002')),0,'lab sees no ML suggestions');
SELECT is((SELECT count(*)::int FROM public.notifications WHERE id IN ('cccccccc-0000-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000002')),0,'lab sees no patient notifications');
SELECT is((SELECT count(*)::int FROM public.profiles WHERE id IN ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444')),1,'lab reads only own full profile');
SELECT is((SELECT count(*)::int FROM public.profiles WHERE id='11111111-1111-4111-8111-111111111111'),0,'lab cannot directly read patient clinical profile');
SELECT is((SELECT count(*)::int FROM public.profile_directory WHERE id IN ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444')),4,'lab can read safe directory entries');
SELECT is((SELECT count(*)::int FROM public.get_lab_upload_patient_profile('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333')),1,'lab can retrieve assigned patient upload details through guarded function');
SELECT is((SELECT count(*)::int FROM public.get_lab_upload_patient_profile('22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333')),0,'lab cannot retrieve patient details for unassigned doctor');
SELECT is((SELECT count(*)::int FROM public.lab_samples),1,'lab reads only own specimen records');
SELECT is((SELECT count(*)::int FROM public.imaging_studies),1,'lab reads only own imaging records');
SELECT is((SELECT count(*)::int FROM public.doctor_patient_assignments WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),0,'lab sees no assignments');

-- INSERT cells. Only the lab role may create reports; the row must identify
-- the authenticated uploader. The other tables have no INSERT policy.
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
SELECT throws_ok($$INSERT INTO public.reports(patient_id,test_type,original_name,file_name,uploaded_by) VALUES ('22222222-2222-4222-8222-222222222222','x','x','x','11111111-1111-4111-8111-111111111111')$$,'42501',NULL,'patient INSERT report denied');
SELECT throws_ok($$INSERT INTO public.ml_suggestions(patient_id,test_type,findings,confidence) VALUES ('11111111-1111-4111-8111-111111111111','x','x',0.5)$$,'42501',NULL,'patient INSERT suggestion denied');
SELECT throws_ok($$INSERT INTO public.notifications(user_id,title,message,notification_type) VALUES ('11111111-1111-4111-8111-111111111111','x','x','general')$$,'42501',NULL,'patient INSERT notification denied');
SELECT throws_ok($$INSERT INTO public.profiles(id,name,role) VALUES ('11111111-1111-4111-8111-111111111111','x','patient')$$,'42501',NULL,'patient INSERT profile denied');
SELECT throws_ok($$INSERT INTO public.doctor_patient_assignments(doctor_id,patient_id) VALUES ('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222')$$,'42501',NULL,'patient INSERT assignment denied');
SELECT throws_ok($$INSERT INTO public.lab_samples(lab_id,patient_id,patient_name,sample_type,collection_date) VALUES ('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','Patient A','Blood',now())$$,'42501',NULL,'patient INSERT lab sample denied');
SELECT throws_ok($$INSERT INTO public.imaging_studies(lab_id,patient_id,patient_name,study_type,body_part,scheduled_date) VALUES ('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','Patient A','X-Ray','Chest',now())$$,'42501',NULL,'patient INSERT imaging study denied');

SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
SELECT throws_ok($$INSERT INTO public.reports(patient_id,test_type,original_name,file_name,uploaded_by) VALUES ('22222222-2222-4222-8222-222222222222','x','x','x','22222222-2222-4222-8222-222222222222')$$,'42501',NULL,'patient B INSERT report denied');
SELECT throws_ok($$INSERT INTO public.ml_suggestions(patient_id,test_type,findings,confidence) VALUES ('22222222-2222-4222-8222-222222222222','x','x',0.5)$$,'42501',NULL,'patient B INSERT suggestion denied');
SELECT throws_ok($$INSERT INTO public.notifications(user_id,title,message,notification_type) VALUES ('22222222-2222-4222-8222-222222222222','x','x','general')$$,'42501',NULL,'patient B INSERT notification denied');
SELECT throws_ok($$INSERT INTO public.profiles(id,name,role) VALUES ('22222222-2222-4222-8222-222222222222','x','patient')$$,'42501',NULL,'patient B INSERT profile denied');
SELECT throws_ok($$INSERT INTO public.doctor_patient_assignments(doctor_id,patient_id) VALUES ('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222')$$,'42501',NULL,'patient B INSERT assignment denied');

SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
SELECT throws_ok($$INSERT INTO public.reports(patient_id,test_type,original_name,file_name,uploaded_by) VALUES ('11111111-1111-4111-8111-111111111111','x','x','x','33333333-3333-4333-8333-333333333333')$$,'42501',NULL,'doctor INSERT report denied');
SELECT throws_ok($$INSERT INTO public.ml_suggestions(patient_id,test_type,findings,confidence) VALUES ('11111111-1111-4111-8111-111111111111','x','x',0.5)$$,'42501',NULL,'doctor INSERT suggestion denied');
SELECT throws_ok($$INSERT INTO public.notifications(user_id,title,message,notification_type) VALUES ('33333333-3333-4333-8333-333333333333','x','x','general')$$,'42501',NULL,'doctor INSERT notification denied');
SELECT throws_ok($$INSERT INTO public.profiles(id,name,role) VALUES ('33333333-3333-4333-8333-333333333333','x','doctor')$$,'42501',NULL,'doctor INSERT profile denied');
SELECT throws_ok($$INSERT INTO public.doctor_patient_assignments(doctor_id,patient_id) VALUES ('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222')$$,'42501',NULL,'doctor INSERT assignment denied');
SELECT throws_ok($$INSERT INTO public.lab_samples(lab_id,patient_id,patient_name,sample_type,collection_date) VALUES ('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','Patient A','Blood',now())$$,'42501',NULL,'doctor INSERT lab sample denied');
SELECT throws_ok($$INSERT INTO public.imaging_studies(lab_id,patient_id,patient_name,study_type,body_part,scheduled_date) VALUES ('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','Patient A','X-Ray','Chest',now())$$,'42501',NULL,'doctor INSERT imaging study denied');

SELECT set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
SELECT lives_ok($$INSERT INTO public.reports(patient_id,doctor_id,test_type,original_name,file_name,uploaded_by) VALUES ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','x','lab-upload.pdf','lab-upload.pdf','44444444-4444-4444-8444-444444444444')$$,'lab INSERT report allowed for actively assigned patient');
SELECT is((SELECT count(*)::int FROM public.reports WHERE file_name='lab-upload.pdf'),1,'lab report insert persisted');
SELECT lives_ok($$INSERT INTO public.lab_samples(lab_id,patient_id,patient_name,sample_type,collection_date) VALUES ('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','Patient A','Urine',now())$$,'lab INSERT own sample allowed');
SELECT is((SELECT count(*)::int FROM public.lab_samples WHERE sample_type='Urine'),1,'lab sample insert persisted');
SELECT lives_ok($$INSERT INTO public.imaging_studies(lab_id,patient_id,patient_name,study_type,body_part,scheduled_date) VALUES ('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','Patient A','MRI','Knee',now())$$,'lab INSERT own imaging study allowed');
SELECT is((SELECT count(*)::int FROM public.imaging_studies WHERE study_type='MRI'),1,'imaging study insert persisted');
SELECT is(pg_temp.affected_rows($$UPDATE public.lab_samples SET status='processing' WHERE id='dddddddd-0000-4000-8000-000000000001'$$),1,'lab updates own sample status');
SELECT is(pg_temp.affected_rows($$UPDATE public.imaging_studies SET status='in_progress' WHERE id='eeeeeeee-0000-4000-8000-000000000001'$$),1,'lab updates own imaging status');
SELECT throws_ok($$INSERT INTO public.ml_suggestions(patient_id,test_type,findings,confidence) VALUES ('11111111-1111-4111-8111-111111111111','x','x',0.5)$$,'42501',NULL,'lab INSERT suggestion denied');
SELECT throws_ok($$INSERT INTO public.notifications(user_id,title,message,notification_type) VALUES ('44444444-4444-4444-8444-444444444444','x','x','general')$$,'42501',NULL,'lab INSERT notification denied');
SELECT throws_ok($$INSERT INTO public.profiles(id,name,role) VALUES ('44444444-4444-4444-8444-444444444444','x','lab')$$,'42501',NULL,'lab INSERT profile denied');
SELECT throws_ok($$INSERT INTO public.doctor_patient_assignments(doctor_id,patient_id) VALUES ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111')$$,'42501',NULL,'lab INSERT assignment denied');

-- UPDATE cells: only own profiles are updateable. Every other role/table pair
-- affects zero rows because the table has no UPDATE policy.
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
SELECT is(pg_temp.affected_rows($$UPDATE public.reports SET notes='changed' WHERE id='aaaaaaaa-0000-4000-8000-000000000001'$$),0,'patient UPDATE report affects zero rows');
SELECT is(pg_temp.affected_rows($$UPDATE public.ml_suggestions SET doctor_notes='changed' WHERE id='bbbbbbbb-0000-4000-8000-000000000001'$$),0,'patient UPDATE suggestion affects zero rows');
SELECT is(pg_temp.affected_rows($$UPDATE public.notifications SET title='changed' WHERE id='cccccccc-0000-4000-8000-000000000001'$$),1,'patient A UPDATE own notification affects one row');
SELECT is(pg_temp.affected_rows($$UPDATE public.profiles SET phone='changed' WHERE id='11111111-1111-4111-8111-111111111111'$$),1,'patient UPDATE own profile affects one row');
SELECT is(pg_temp.affected_rows($$UPDATE public.doctor_patient_assignments SET notes='changed' WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$),0,'patient UPDATE assignment affects zero rows');

SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
SELECT is(pg_temp.affected_rows($$UPDATE public.reports SET notes='changed' WHERE id='aaaaaaaa-0000-4000-8000-000000000001'$$),0,'patient B UPDATE report affects zero rows');
SELECT is(pg_temp.affected_rows($$UPDATE public.ml_suggestions SET doctor_notes='changed' WHERE id='bbbbbbbb-0000-4000-8000-000000000001'$$),0,'patient B UPDATE suggestion affects zero rows');
SELECT is(pg_temp.affected_rows($$UPDATE public.notifications SET title='changed' WHERE id='cccccccc-0000-4000-8000-000000000001'$$),0,'patient B UPDATE notification affects zero rows');
SELECT is(pg_temp.affected_rows($$UPDATE public.profiles SET phone='changed' WHERE id='22222222-2222-4222-8222-222222222222'$$),1,'patient B UPDATE own profile affects one row');
SELECT is(pg_temp.affected_rows($$UPDATE public.doctor_patient_assignments SET notes='changed' WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$),0,'patient B UPDATE assignment affects zero rows');

SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
SELECT is(pg_temp.affected_rows($$UPDATE public.reports SET notes='doctor clinical note' WHERE id='aaaaaaaa-0000-4000-8000-000000000001'$$),1,'doctor UPDATE assigned report clinical note affects one row');
SELECT throws_ok($$UPDATE public.reports SET file_name='forged.pdf' WHERE id='aaaaaaaa-0000-4000-8000-000000000001'$$,'42501',NULL,'doctor cannot UPDATE report upload identity');
SELECT is(pg_temp.affected_rows($$UPDATE public.ml_suggestions SET doctor_notes='changed' WHERE id='bbbbbbbb-0000-4000-8000-000000000001'$$),0,'doctor UPDATE assigned suggestion affects zero rows');
SELECT is(pg_temp.affected_rows($$UPDATE public.notifications SET title='changed' WHERE id='cccccccc-0000-4000-8000-000000000001'$$),0,'doctor UPDATE notification affects zero rows');
SELECT is(pg_temp.affected_rows($$UPDATE public.profiles SET phone='changed' WHERE id='33333333-3333-4333-8333-333333333333'$$),1,'doctor UPDATE own profile affects one row');
SELECT is(pg_temp.affected_rows($$UPDATE public.doctor_patient_assignments SET notes='changed' WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$),0,'doctor UPDATE assignment affects zero rows');

SELECT set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
SELECT is(pg_temp.affected_rows($$UPDATE public.reports SET notes='changed' WHERE id='aaaaaaaa-0000-4000-8000-000000000001'$$),0,'lab UPDATE report affects zero rows');
SELECT is(pg_temp.affected_rows($$UPDATE public.ml_suggestions SET doctor_notes='changed' WHERE id='bbbbbbbb-0000-4000-8000-000000000001'$$),0,'lab UPDATE suggestion affects zero rows');
SELECT is(pg_temp.affected_rows($$UPDATE public.notifications SET title='changed' WHERE id='cccccccc-0000-4000-8000-000000000001'$$),0,'lab UPDATE notification affects zero rows');
SELECT is(pg_temp.affected_rows($$UPDATE public.profiles SET phone='changed' WHERE id='44444444-4444-4444-8444-444444444444'$$),1,'lab UPDATE own profile affects one row');
SELECT is(pg_temp.affected_rows($$UPDATE public.doctor_patient_assignments SET notes='changed' WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$),0,'lab UPDATE assignment affects zero rows');

-- DELETE cells: none of these five tables has a DELETE policy.
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
SELECT is(pg_temp.affected_rows($$DELETE FROM public.reports WHERE id='aaaaaaaa-0000-4000-8000-000000000011'$$),0,'patient DELETE report affects zero rows');
SELECT is(pg_temp.affected_rows($$DELETE FROM public.ml_suggestions WHERE id='bbbbbbbb-0000-4000-8000-000000000001'$$),0,'patient DELETE suggestion affects zero rows');
SELECT is(pg_temp.affected_rows($$DELETE FROM public.notifications WHERE id='cccccccc-0000-4000-8000-000000000001'$$),0,'patient DELETE notification affects zero rows');
SELECT is(pg_temp.affected_rows($$DELETE FROM public.profiles WHERE id='11111111-1111-4111-8111-111111111111'$$),0,'patient DELETE profile affects zero rows');
SELECT is(pg_temp.affected_rows($$DELETE FROM public.doctor_patient_assignments WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$),0,'patient DELETE assignment affects zero rows');

SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
SELECT is(pg_temp.affected_rows($$DELETE FROM public.reports WHERE id='aaaaaaaa-0000-4000-8000-000000000012'$$),0,'patient B DELETE report affects zero rows');
SELECT is(pg_temp.affected_rows($$DELETE FROM public.ml_suggestions WHERE id='bbbbbbbb-0000-4000-8000-000000000001'$$),0,'patient B DELETE suggestion affects zero rows');
SELECT is(pg_temp.affected_rows($$DELETE FROM public.notifications WHERE id='cccccccc-0000-4000-8000-000000000001'$$),0,'patient B DELETE notification affects zero rows');
SELECT is(pg_temp.affected_rows($$DELETE FROM public.profiles WHERE id='11111111-1111-4111-8111-111111111111'$$),0,'patient B DELETE profile affects zero rows');
SELECT is(pg_temp.affected_rows($$DELETE FROM public.doctor_patient_assignments WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$),0,'patient B DELETE assignment affects zero rows');

SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
SELECT is(pg_temp.affected_rows($$DELETE FROM public.reports WHERE id='aaaaaaaa-0000-4000-8000-000000000013'$$),0,'doctor DELETE report affects zero rows');
SELECT is(pg_temp.affected_rows($$DELETE FROM public.ml_suggestions WHERE id='bbbbbbbb-0000-4000-8000-000000000001'$$),0,'doctor DELETE suggestion affects zero rows');
SELECT is(pg_temp.affected_rows($$DELETE FROM public.notifications WHERE id='cccccccc-0000-4000-8000-000000000001'$$),0,'doctor DELETE notification affects zero rows');
SELECT is(pg_temp.affected_rows($$DELETE FROM public.profiles WHERE id='33333333-3333-4333-8333-333333333333'$$),0,'doctor DELETE profile affects zero rows');
SELECT is(pg_temp.affected_rows($$DELETE FROM public.doctor_patient_assignments WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$),0,'doctor DELETE assignment affects zero rows');

SELECT set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
SELECT is(pg_temp.affected_rows($$DELETE FROM public.reports WHERE id='aaaaaaaa-0000-4000-8000-000000000014'$$),0,'lab DELETE report affects zero rows');
SELECT is(pg_temp.affected_rows($$DELETE FROM public.ml_suggestions WHERE id='bbbbbbbb-0000-4000-8000-000000000001'$$),0,'lab DELETE suggestion affects zero rows');
SELECT is(pg_temp.affected_rows($$DELETE FROM public.notifications WHERE id='cccccccc-0000-4000-8000-000000000001'$$),0,'lab DELETE notification affects zero rows');
SELECT is(pg_temp.affected_rows($$DELETE FROM public.profiles WHERE id='44444444-4444-4444-8444-444444444444'$$),0,'lab DELETE profile affects zero rows');
SELECT is(pg_temp.affected_rows($$DELETE FROM public.doctor_patient_assignments WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$),0,'lab DELETE assignment affects zero rows');

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
