-- Any signed-in user could read and list every file in the private "reports" bucket
-- (61 objects on 2026-10-04: scans and lab reports of every patient) and upload into it.
-- Policies from 20260926065940_remote_schema.sql and 20260926070000_phase1_security.sql.
-- Server routes use the service role and are unaffected.
DROP POLICY IF EXISTS "Authenticated users can read files" ON storage.objects;
DROP POLICY IF EXISTS "auth_read_reports" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "auth_upload_reports" ON storage.objects;

-- A file is readable by whoever may read the report it belongs to (reports RLS applies
-- inside the subquery): the patient, their assigned verified doctor, the uploading lab.
-- Files with no report row (57 today) are server-only.
CREATE POLICY "reports_objects_select_visible_report"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'reports' AND EXISTS (SELECT 1 FROM public.reports r WHERE r.file_name = objects.name));

-- Labs upload report files from the browser (lab-dashboard/upload); nobody else does.
CREATE POLICY "reports_objects_insert_lab"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'reports' AND (SELECT public.get_auth_role()) = 'lab');
