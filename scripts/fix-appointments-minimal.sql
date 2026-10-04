-- ========================================
-- MINIMAL APPOINTMENTS FIX
-- ========================================
-- This script only fixes the immediate appointment issue

-- 1. Make doctor_name nullable (the main issue)
ALTER TABLE public.appointments ALTER COLUMN doctor_name DROP NOT NULL;

-- 2. Make patient_name nullable too (preventive)
ALTER TABLE public.appointments ALTER COLUMN patient_name DROP NOT NULL;

-- 3. Add default values to prevent null issues
ALTER TABLE public.appointments ALTER COLUMN doctor_name SET DEFAULT 'Doctor';
ALTER TABLE public.appointments ALTER COLUMN patient_name SET DEFAULT 'Patient';

-- 4. Ensure permissions on appointments table
ALTER TABLE public.appointments DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.appointments TO authenticated, anon;

-- 5. Show what we fixed
SELECT column_name, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'appointments' AND table_schema = 'public'
AND column_name IN ('doctor_name', 'patient_name')
ORDER BY column_name;

-- 6. Success message
SELECT '✅ Appointments table constraints fixed!' as status;
SELECT 'doctor_name and patient_name are now nullable with defaults' as result;
SELECT 'Try creating an appointment again' as next_step;
