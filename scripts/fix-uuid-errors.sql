-- ========================================
-- FIX UUID ERRORS IN APPOINTMENTS SYSTEM
-- ========================================
-- This script fixes the "invalid input syntax for type uuid" errors

-- 1. First, let's check what's causing the UUID errors
SELECT 
    'Current appointments with potential UUID issues:' as info,
    COUNT(*) as count
FROM public.appointments
WHERE doctor_id IS NOT NULL 
  AND doctor_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
   OR patient_id IS NOT NULL 
  AND patient_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

-- 2. Show problematic appointments
SELECT 
    'Problematic appointments:' as info,
    id,
    doctor_id,
    patient_id,
    appointment_date,
    status,
    CASE 
        WHEN doctor_id IS NOT NULL AND doctor_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' 
        THEN 'Invalid doctor_id format'
        WHEN patient_id IS NOT NULL AND patient_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' 
        THEN 'Invalid patient_id format'
        ELSE 'Unknown issue'
    END as issue_type
FROM public.appointments
WHERE doctor_id IS NOT NULL 
  AND doctor_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
   OR patient_id IS NOT NULL 
  AND patient_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
LIMIT 10;

-- 3. Create functions to resolve Short ID to UUID for doctors and patients
CREATE OR REPLACE FUNCTION resolve_doctor_short_id_to_uuid(input_short_id TEXT)
RETURNS UUID AS $$
DECLARE
    resolved_uuid UUID;
BEGIN
    SELECT d.id INTO resolved_uuid
    FROM public.doctors d
    JOIN public.user_short_ids usi ON d.user_id = usi.user_id
    WHERE usi.short_id = input_short_id AND usi.role = 'doctor';
    
    RETURN resolved_uuid;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION resolve_patient_short_id_to_uuid(input_short_id TEXT)
RETURNS UUID AS $$
DECLARE
    resolved_uuid UUID;
BEGIN
    SELECT p.id INTO resolved_uuid
    FROM public.patients p
    JOIN public.user_short_ids usi ON p.user_id = usi.user_id
    WHERE usi.short_id = input_short_id AND usi.role = 'patient';
    
    RETURN resolved_uuid;
END;
$$ LANGUAGE plpgsql;

-- 4. Fix appointments with Short ID doctor_ids
UPDATE public.appointments 
SET doctor_id = resolve_doctor_short_id_to_uuid(doctor_id::text)
WHERE doctor_id IS NOT NULL 
  AND doctor_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND resolve_doctor_short_id_to_uuid(doctor_id::text) IS NOT NULL;

-- 5. Fix appointments with Short ID patient_ids
UPDATE public.appointments 
SET patient_id = resolve_patient_short_id_to_uuid(patient_id::text)
WHERE patient_id IS NOT NULL 
  AND patient_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND resolve_patient_short_id_to_uuid(patient_id::text) IS NOT NULL;

-- 6. Delete appointments that couldn't be resolved (invalid Short IDs)
DELETE FROM public.appointments 
WHERE doctor_id IS NOT NULL 
  AND doctor_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND resolve_doctor_short_id_to_uuid(doctor_id::text) IS NULL;

DELETE FROM public.appointments 
WHERE patient_id IS NOT NULL 
  AND patient_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND resolve_patient_short_id_to_uuid(patient_id::text) IS NULL;

-- 7. Ensure appointments table has proper UUID constraints
ALTER TABLE public.appointments 
ALTER COLUMN doctor_id TYPE UUID USING doctor_id::UUID,
ALTER COLUMN patient_id TYPE UUID USING patient_id::UUID;

-- 8. Add foreign key constraints if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'appointments_doctor_id_fkey' 
        AND table_name = 'appointments'
    ) THEN
        ALTER TABLE public.appointments ADD CONSTRAINT appointments_doctor_id_fkey 
            FOREIGN KEY (doctor_id) REFERENCES public.doctors(id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'appointments_patient_id_fkey' 
        AND table_name = 'appointments'
    ) THEN
        ALTER TABLE public.appointments ADD CONSTRAINT appointments_patient_id_fkey 
            FOREIGN KEY (patient_id) REFERENCES public.patients(id);
    END IF;
END $$;

-- 9. Verify the fix
SELECT 
    'Appointments after fix:' as info,
    COUNT(*) as total_appointments,
    COUNT(CASE WHEN doctor_id IS NOT NULL THEN 1 END) as with_doctor_id,
    COUNT(CASE WHEN patient_id IS NOT NULL THEN 1 END) as with_patient_id
FROM public.appointments;

-- 10. Show sample appointments to verify they're working
SELECT 
    'Sample appointments after fix:' as info,
    id,
    doctor_id,
    patient_id,
    patient_name,
    appointment_date,
    status
FROM public.appointments
ORDER BY created_at DESC
LIMIT 5;
