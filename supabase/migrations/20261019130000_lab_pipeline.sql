-- Lab pipeline. Approved 2026-10-18.
--
-- Every upload now reaches the doctor: the server notifies them whatever the test type,
-- and the AI step runs in the background with a visible status and a retry. Blood and
-- urine reports get an AI reading of their values. Labs pick the doctor from the
-- patient's own doctors, and can remove files left behind by a failed upload.
-- Apply after 20261019120000_report_reviews_and_call_security.sql.

-- 1. Where the AI reading stands, so doctors see "in progress", "failed - run again" or
--    "no AI for this test" instead of nothing. Written by the server only.
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS ai_status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_ai_status_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_ai_status_check
  CHECK (ai_status IN ('pending', 'running', 'done', 'failed', 'not_applicable'));

-- Existing reports: done if an AI result exists (a failed call stored a placeholder),
-- otherwise there was no AI for them.
UPDATE public.reports r SET ai_status = CASE
  WHEN EXISTS (SELECT 1 FROM public.ml_suggestions m WHERE m.report_id = r.id
               AND m.findings NOT LIKE 'AI analysis unavailable%') THEN 'done'
  WHEN EXISTS (SELECT 1 FROM public.ml_suggestions m WHERE m.report_id = r.id) THEN 'failed'
  ELSE 'not_applicable' END
WHERE ai_status = 'pending';

-- 2. Structured AI output (lab values, detector boxes). Lab-value readings have no
--    meaningful confidence score, so it may be empty.
ALTER TABLE public.ml_suggestions ADD COLUMN IF NOT EXISTS details jsonb;
ALTER TABLE public.ml_suggestions ALTER COLUMN confidence DROP NOT NULL;

-- 3. The doctors a patient has, for the lab's upload form: with several doctors per
--    patient, labs pick from the list instead of typing an ID. Verified labs only.
CREATE OR REPLACE FUNCTION public.get_patient_doctors_for_lab(p_patient_id uuid)
RETURNS TABLE (id uuid, name text, short_id text, specialty text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT d.id, d.name, d.short_id, d.specialty
  FROM public.doctor_patient_assignments dpa
  JOIN public.profiles d ON d.id = dpa.doctor_id AND d.role = 'doctor' AND d.verified
  WHERE public.is_verified_lab()
    AND dpa.patient_id = p_patient_id
    AND dpa.is_active IS TRUE
  ORDER BY d.name;
$function$;
REVOKE EXECUTE ON FUNCTION public.get_patient_doctors_for_lab(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_patient_doctors_for_lab(uuid) TO authenticated;

-- 4. A lab can delete a file it uploaded that no report uses (the upload page removes
--    the file when creating the report fails; this used to fail silently and leave
--    orphan files behind).
DROP POLICY IF EXISTS reports_objects_delete_own_orphan ON storage.objects;
CREATE POLICY reports_objects_delete_own_orphan ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'reports'
  AND owner = (SELECT auth.uid())
  AND NOT EXISTS (SELECT 1 FROM public.reports r WHERE r.file_name = objects.name)
);
