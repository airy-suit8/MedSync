-- Backfill missing patient rows and keep future signups in sync.
-- Run this in Supabase SQL editor.

BEGIN;

-- 1) Backfill any patient user that exists in public.users but not public.patients.
INSERT INTO public.patients (user_id, name, email)
SELECT
  u.auth_id,
  COALESCE(NULLIF(u.name, ''), u.email, 'Patient'),
  u.email
FROM public.users u
LEFT JOIN public.patients p
  ON p.user_id = u.auth_id
WHERE u.role = 'patient'
  AND u.auth_id IS NOT NULL
  AND p.user_id IS NULL;

-- 2) Keep future signups synced to patients table.
CREATE OR REPLACE FUNCTION public.ensure_patient_row_from_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.role = 'patient' AND NEW.auth_id IS NOT NULL THEN
    INSERT INTO public.patients (user_id, name, email)
    VALUES (
      NEW.auth_id,
      COALESCE(NULLIF(NEW.name, ''), NEW.email, 'Patient'),
      NEW.email
    )
    ON CONFLICT (user_id) DO UPDATE
    SET
      name = EXCLUDED.name,
      email = EXCLUDED.email;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_ensure_patient_row ON public.users;
CREATE TRIGGER trg_users_ensure_patient_row
AFTER INSERT OR UPDATE OF role, auth_id, name, email
ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.ensure_patient_row_from_users();

COMMIT;
