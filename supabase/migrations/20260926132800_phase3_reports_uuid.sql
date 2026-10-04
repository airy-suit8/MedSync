-- Migration B: Normalize patient_id to UUID in reports and ml_suggestions

-- 1. Add UUID columns
ALTER TABLE public.reports ADD COLUMN patient_uuid UUID;
ALTER TABLE public.ml_suggestions ADD COLUMN patient_uuid UUID;

-- 2. Migrate data
-- Update reports
UPDATE public.reports r
SET patient_uuid = (
    CASE 
        WHEN r.patient_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN r.patient_id::uuid
        ELSE (SELECT id FROM public.profiles p WHERE p.short_id = r.patient_id LIMIT 1)
    END
);

-- Update ml_suggestions
UPDATE public.ml_suggestions m
SET patient_uuid = (
    CASE 
        WHEN m.patient_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN m.patient_id::uuid
        ELSE (SELECT id FROM public.profiles p WHERE p.short_id = m.patient_id LIMIT 1)
    END
);

-- 3. Drop old RLS policies from Phase 1
DROP POLICY IF EXISTS "Patient can read own reports" ON public.reports;
DROP POLICY IF EXISTS "Patient can read own ML suggestions" ON public.ml_suggestions;

-- 4. Swap columns and add FKs
ALTER TABLE public.reports DROP COLUMN patient_id CASCADE;
ALTER TABLE public.reports RENAME COLUMN patient_uuid TO patient_id;
ALTER TABLE public.reports ADD CONSTRAINT reports_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.ml_suggestions DROP COLUMN patient_id CASCADE;
ALTER TABLE public.ml_suggestions RENAME COLUMN patient_uuid TO patient_id;
ALTER TABLE public.ml_suggestions ADD CONSTRAINT ml_suggestions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 5. Recreate RLS policies
CREATE POLICY "Patient can read own reports" 
ON public.reports FOR SELECT 
USING (
  public.get_auth_role() = 'patient' AND patient_id = auth.uid()
);

CREATE POLICY "Patient can read own ML suggestions" 
ON public.ml_suggestions FOR SELECT 
USING (
  public.get_auth_role() = 'patient' AND patient_id = auth.uid()
);
