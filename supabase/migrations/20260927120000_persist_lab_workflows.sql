CREATE TABLE public.lab_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  patient_name text NOT NULL,
  sample_type text NOT NULL CHECK (length(trim(sample_type)) > 0),
  collection_date timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'urgent')),
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  notes text NOT NULL DEFAULT '',
  assigned_tech text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lab_samples ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.lab_samples TO authenticated;

CREATE POLICY lab_samples_select_own
ON public.lab_samples FOR SELECT TO authenticated
USING (lab_id = auth.uid() AND public.get_auth_role() = 'lab');

CREATE POLICY lab_samples_insert_own
ON public.lab_samples FOR INSERT TO authenticated
WITH CHECK (
  lab_id = auth.uid()
  AND public.get_auth_role() = 'lab'
  AND EXISTS (
    SELECT 1 FROM public.profile_directory AS p
    WHERE p.id = patient_id AND p.role = 'patient'
  )
);

CREATE POLICY lab_samples_update_own
ON public.lab_samples FOR UPDATE TO authenticated
USING (lab_id = auth.uid() AND public.get_auth_role() = 'lab')
WITH CHECK (
  lab_id = auth.uid()
  AND public.get_auth_role() = 'lab'
  AND EXISTS (
    SELECT 1 FROM public.profile_directory AS p
    WHERE p.id = patient_id AND p.role = 'patient'
  )
);

CREATE TABLE public.imaging_studies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  patient_name text NOT NULL,
  study_type text NOT NULL CHECK (length(trim(study_type)) > 0),
  body_part text NOT NULL CHECK (length(trim(body_part)) > 0),
  scheduled_date timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'in_progress', 'completed', 'urgent')),
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  radiologist text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  file_paths text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.imaging_studies ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.imaging_studies TO authenticated;

CREATE POLICY imaging_studies_select_own
ON public.imaging_studies FOR SELECT TO authenticated
USING (lab_id = auth.uid() AND public.get_auth_role() = 'lab');

CREATE POLICY imaging_studies_insert_own
ON public.imaging_studies FOR INSERT TO authenticated
WITH CHECK (
  lab_id = auth.uid()
  AND public.get_auth_role() = 'lab'
  AND EXISTS (
    SELECT 1 FROM public.profile_directory AS p
    WHERE p.id = patient_id AND p.role = 'patient'
  )
  AND cardinality(file_paths) = 0
);

CREATE POLICY imaging_studies_update_own
ON public.imaging_studies FOR UPDATE TO authenticated
USING (lab_id = auth.uid() AND public.get_auth_role() = 'lab')
WITH CHECK (
  lab_id = auth.uid()
  AND public.get_auth_role() = 'lab'
  AND EXISTS (
    SELECT 1 FROM public.profile_directory AS p
    WHERE p.id = patient_id AND p.role = 'patient'
  )
);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'imaging',
  'imaging',
  false,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'application/dicom']
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY imaging_objects_insert_own_study
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'imaging'
  AND public.get_auth_role() = 'lab'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.imaging_studies AS study
    WHERE study.id::text = (storage.foldername(name))[2]
      AND study.lab_id = auth.uid()
  )
);

CREATE POLICY imaging_objects_select_own
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'imaging'
  AND public.get_auth_role() = 'lab'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY imaging_objects_delete_own
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'imaging'
  AND public.get_auth_role() = 'lab'
  AND (storage.foldername(name))[1] = auth.uid()::text
);