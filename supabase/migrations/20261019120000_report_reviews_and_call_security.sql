-- Doctor's review of a report, and video-call privacy. Approved 2026-10-18.
--
-- 1-4: Each doctor treating the patient can review a report (verdict, a note for the
--      patient, an optional photo of a handwritten note, and a private note only the
--      patient's doctors see). This replaces the Approve/Reject AI buttons, which never
--      saved: no policy let doctors update ml_suggestions, so the update changed nothing
--      and reported success.
-- 5-6: Video calls. consultation_meetings was readable by anyone (even signed out) and
--      writable by any signed-in user, and the call's signalling channel was named after
--      the appointment ID. Meetings are now limited to the appointment's doctor and
--      patient, and the channel is named after a per-appointment secret only they can read.
--
-- Apply after 20261018120000_doctor_directory_and_patient_requests.sql and before the
-- matching app deploy.

-- 1. Reviews. One per doctor per report, so a second-opinion doctor adds their own.
CREATE TABLE IF NOT EXISTS public.report_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  verdict text NOT NULL CHECK (verdict IN ('agree', 'disagree', 'unclear', 'reviewed')),
  patient_note text CHECK (char_length(patient_note) <= 4000),
  note_image_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, doctor_id)
);
CREATE INDEX IF NOT EXISTS report_reviews_report_id_idx ON public.report_reviews (report_id);

-- Private notes live in their own table: row-level security can't hide one column from
-- the patient while showing them the rest of the row.
CREATE TABLE IF NOT EXISTS public.report_review_private_notes (
  review_id uuid PRIMARY KEY REFERENCES public.report_reviews(id) ON DELETE CASCADE,
  note text NOT NULL CHECK (char_length(note) <= 4000),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.report_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_review_private_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.report_reviews, public.report_review_private_notes FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.report_reviews, public.report_review_private_notes FROM authenticated;
GRANT SELECT ON public.report_reviews, public.report_review_private_notes TO authenticated;

-- Whoever may read the report (reports RLS applies inside the subquery): the patient and
-- the verified doctors treating them. Labs see their uploads, not the reviews.
DROP POLICY IF EXISTS report_reviews_select ON public.report_reviews;
CREATE POLICY report_reviews_select ON public.report_reviews
FOR SELECT TO authenticated
USING (
  (SELECT public.get_auth_role()) IN ('patient', 'doctor')
  AND EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_reviews.report_id)
);

DROP POLICY IF EXISTS report_review_private_notes_select ON public.report_review_private_notes;
CREATE POLICY report_review_private_notes_select ON public.report_review_private_notes
FOR SELECT TO authenticated
USING (
  (SELECT public.get_auth_role()) = 'doctor'
  AND EXISTS (
    SELECT 1 FROM public.report_reviews rr
    JOIN public.reports r ON r.id = rr.report_id
    WHERE rr.id = report_review_private_notes.review_id
  )
);

-- 2. Photos of handwritten notes: private bucket, <report id>/<doctor id>-<time>.<ext>.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('review-notes', 'review-notes', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS review_notes_insert_treating_doctor ON storage.objects;
CREATE POLICY review_notes_insert_treating_doctor ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'review-notes'
  AND (SELECT public.is_verified_doctor())
  AND split_part(name, '/', 2) LIKE (SELECT auth.uid())::text || '-%'
  AND EXISTS (SELECT 1 FROM public.reports r WHERE r.id::text = split_part(objects.name, '/', 1))
);

-- Readable by whoever can read the review it is attached to.
DROP POLICY IF EXISTS review_notes_select_with_review ON storage.objects;
CREATE POLICY review_notes_select_with_review ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'review-notes'
  AND EXISTS (SELECT 1 FROM public.report_reviews rr WHERE rr.note_image_path = objects.name)
);

-- 3. Save a review (insert or edit your own). Also records the verdict on the AI result
--    and tells the patient.
CREATE OR REPLACE FUNCTION public.submit_report_review(
  p_report_id uuid,
  p_verdict text,
  p_patient_note text,
  p_private_note text,
  p_note_image_path text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  r public.reports%ROWTYPE;
  v_id uuid;
  v_patient_note text := nullif(trim(p_patient_note), '');
  v_private_note text := nullif(trim(p_private_note), '');
  v_image text := nullif(trim(p_note_image_path), '');
  v_doctor_name text;
BEGIN
  SELECT * INTO r FROM public.reports WHERE id = p_report_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.is_verified_doctor() OR NOT EXISTS (
    SELECT 1 FROM public.doctor_patient_assignments
    WHERE doctor_id = auth.uid() AND patient_id = r.patient_id AND is_active IS TRUE
  ) THEN
    RAISE EXCEPTION 'Only a doctor treating this patient can review the report' USING ERRCODE = '42501';
  END IF;
  IF p_verdict IS NULL OR p_verdict NOT IN ('agree', 'disagree', 'unclear', 'reviewed') THEN
    RAISE EXCEPTION 'Choose a verdict' USING ERRCODE = '22023';
  END IF;
  IF v_image IS NOT NULL AND v_image NOT LIKE p_report_id::text || '/' || auth.uid()::text || '-%' THEN
    RAISE EXCEPTION 'That photo does not belong to this review' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.report_reviews (report_id, doctor_id, verdict, patient_note, note_image_path)
  VALUES (p_report_id, auth.uid(), p_verdict, v_patient_note, v_image)
  ON CONFLICT (report_id, doctor_id) DO UPDATE SET
    verdict = EXCLUDED.verdict,
    patient_note = EXCLUDED.patient_note,
    note_image_path = coalesce(EXCLUDED.note_image_path, public.report_reviews.note_image_path),
    updated_at = now()
  RETURNING id INTO v_id;

  IF v_private_note IS NULL THEN
    DELETE FROM public.report_review_private_notes WHERE review_id = v_id;
  ELSE
    INSERT INTO public.report_review_private_notes (review_id, note) VALUES (v_id, v_private_note)
    ON CONFLICT (review_id) DO UPDATE SET note = EXCLUDED.note, updated_at = now();
  END IF;

  UPDATE public.ml_suggestions SET
    status = CASE p_verdict WHEN 'agree' THEN 'accepted' WHEN 'disagree' THEN 'rejected' ELSE 'reviewed' END,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    doctor_notes = v_patient_note,
    updated_at = now()
  WHERE report_id = p_report_id;

  SELECT name INTO v_doctor_name FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.notifications (user_id, title, message, notification_type, related_id, related_type, target_role, action_url)
  VALUES (r.patient_id, 'Your report has been reviewed',
    coalesce(v_doctor_name, 'Your doctor') || ' reviewed your ' || replace(coalesce(r.test_type, 'test'), '_', ' ') || ' report.',
    'test_result', r.id, 'report', 'patient', '/patient-dashboard/reports/' || r.id::text);

  RETURN v_id;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.submit_report_review(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_report_review(uuid, text, text, text, text) TO authenticated;

-- 4. ml_suggestions keeps no direct-update path for browsers; reviews go through the
--    function above, which runs as the table owner.

-- 5. Meetings: only the appointment's doctor and patient (appointments RLS applies in the
--    subquery). Replaces the seven open policies from 20260926065940_remote_schema.sql.
DROP POLICY IF EXISTS "Allow all authenticated users to view meetings" ON public.consultation_meetings;
DROP POLICY IF EXISTS "Allow authenticated users to create meetings" ON public.consultation_meetings;
DROP POLICY IF EXISTS "Allow authenticated users to delete meetings" ON public.consultation_meetings;
DROP POLICY IF EXISTS "Allow authenticated users to read meetings" ON public.consultation_meetings;
DROP POLICY IF EXISTS "Allow authenticated users to update meetings" ON public.consultation_meetings;
DROP POLICY IF EXISTS "Allow doctors to create meetings" ON public.consultation_meetings;
DROP POLICY IF EXISTS "Allow hosts to update meetings" ON public.consultation_meetings;
REVOKE ALL ON public.consultation_meetings FROM anon;

DROP POLICY IF EXISTS consultation_meetings_parties ON public.consultation_meetings;
CREATE POLICY consultation_meetings_parties ON public.consultation_meetings
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.appointments a
  WHERE a.id = consultation_meetings.appointment_id
    AND (SELECT auth.uid()) IN (a.doctor_id, a.patient_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.appointments a
  WHERE a.id = consultation_meetings.appointment_id
    AND (SELECT auth.uid()) IN (a.doctor_id, a.patient_id)
));

-- 6. The call's broadcast channel is named after this secret. Only the appointment's
--    doctor and patient can read appointments, so nobody else can find the channel.
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS call_secret uuid NOT NULL DEFAULT gen_random_uuid();
