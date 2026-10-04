-- ========================================
-- FIX APPOINTMENTS UUID ERRORS - ROBUST VERSION
-- ========================================
-- This script fixes the "invalid input syntax for type uuid" errors
-- with better error handling and edge case management

-- 1. First, check if appointments table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'appointments') THEN
        RAISE NOTICE 'Appointments table does not exist. Creating it...';
        
        CREATE TABLE public.appointments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            doctor_id UUID NOT NULL,
            patient_id UUID NOT NULL,
            patient_name TEXT NOT NULL,
            doctor_name TEXT,
            appointment_date DATE NOT NULL,
            start_time TIME NOT NULL,
            end_time TIME NOT NULL,
            duration_minutes INTEGER DEFAULT 30,
            appointment_type TEXT DEFAULT 'consultation',
            status TEXT DEFAULT 'scheduled',
            notes TEXT,
            scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Create indexes
        CREATE INDEX appointments_doctor_id_idx ON public.appointments(doctor_id);
        CREATE INDEX appointments_patient_id_idx ON public.appointments(patient_id);
        CREATE INDEX appointments_date_idx ON public.appointments(appointment_date);
        CREATE INDEX appointments_status_idx ON public.appointments(status);
        
        -- Disable RLS
        ALTER TABLE public.appointments DISABLE ROW LEVEL SECURITY;
        
        -- Grant permissions
        GRANT ALL ON public.appointments TO authenticated;
        
        RAISE NOTICE 'Created appointments table with proper UUID schema';
    END IF;
END $$;

-- 2. Check current appointments table schema
SELECT 
    'Current appointments table schema:' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'appointments' 
ORDER BY ordinal_position;

-- 3. Check for problematic appointments (if any exist)
SELECT 
    'Appointments with potential UUID issues:' as info,
    COUNT(*) as count
FROM public.appointments
WHERE doctor_id IS NOT NULL 
  AND doctor_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
   OR patient_id IS NOT NULL 
  AND patient_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

-- 4. Show sample problematic appointments (if any)
SELECT 
    'Sample problematic appointments:' as info,
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
LIMIT 5;

-- 5. Create helper functions for resolving Short IDs
CREATE OR REPLACE FUNCTION resolve_doctor_short_id_to_uuid(input_short_id TEXT)
RETURNS UUID AS $$
DECLARE
    resolved_uuid UUID;
BEGIN
    -- First try to find by short_id in user_short_ids
    SELECT d.id INTO resolved_uuid
    FROM public.doctors d
    JOIN public.user_short_ids usi ON d.user_id = usi.user_id
    WHERE usi.short_id = input_short_id AND usi.role = 'doctor';
    
    -- If not found, try to find by direct match (in case it's already a UUID)
    IF resolved_uuid IS NULL THEN
        SELECT d.id INTO resolved_uuid
        FROM public.doctors d
        WHERE d.id::text = input_short_id;
    END IF;
    
    RETURN resolved_uuid;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION resolve_patient_short_id_to_uuid(input_short_id TEXT)
RETURNS UUID AS $$
DECLARE
    resolved_uuid UUID;
BEGIN
    -- First try to find by short_id in user_short_ids
    SELECT p.id INTO resolved_uuid
    FROM public.patients p
    JOIN public.user_short_ids usi ON p.user_id = usi.user_id
    WHERE usi.short_id = input_short_id AND usi.role = 'patient';
    
    -- If not found, try to find by direct match (in case it's already a UUID)
    IF resolved_uuid IS NULL THEN
        SELECT p.id INTO resolved_uuid
        FROM public.patients p
        WHERE p.id::text = input_short_id;
    END IF;
    
    RETURN resolved_uuid;
END;
$$ LANGUAGE plpgsql;

-- 6. Fix appointments with Short ID doctor_ids (only if there are problematic ones)
DO $$
DECLARE
    problematic_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO problematic_count
    FROM public.appointments
    WHERE doctor_id IS NOT NULL 
      AND doctor_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
    
    IF problematic_count > 0 THEN
        RAISE NOTICE 'Found % appointments with problematic doctor_ids. Attempting to fix...', problematic_count;
        
        UPDATE public.appointments 
        SET doctor_id = resolve_doctor_short_id_to_uuid(doctor_id::text)
        WHERE doctor_id IS NOT NULL 
          AND doctor_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          AND resolve_doctor_short_id_to_uuid(doctor_id::text) IS NOT NULL;
    ELSE
        RAISE NOTICE 'No problematic doctor_ids found.';
    END IF;
END $$;

-- 7. Fix appointments with Short ID patient_ids (only if there are problematic ones)
DO $$
DECLARE
    problematic_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO problematic_count
    FROM public.appointments
    WHERE patient_id IS NOT NULL 
      AND patient_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
    
    IF problematic_count > 0 THEN
        RAISE NOTICE 'Found % appointments with problematic patient_ids. Attempting to fix...', problematic_count;
        
        UPDATE public.appointments 
        SET patient_id = resolve_patient_short_id_to_uuid(patient_id::text)
        WHERE patient_id IS NOT NULL 
          AND patient_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          AND resolve_patient_short_id_to_uuid(patient_id::text) IS NOT NULL;
    ELSE
        RAISE NOTICE 'No problematic patient_ids found.';
    END IF;
END $$;

-- 8. Delete appointments that couldn't be resolved (only if there are any)
DO $$
DECLARE
    unresolved_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO unresolved_count
    FROM public.appointments
    WHERE (doctor_id IS NOT NULL 
      AND doctor_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND resolve_doctor_short_id_to_uuid(doctor_id::text) IS NULL)
       OR (patient_id IS NOT NULL 
      AND patient_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND resolve_patient_short_id_to_uuid(patient_id::text) IS NULL);
    
    IF unresolved_count > 0 THEN
        RAISE NOTICE 'Found % appointments that could not be resolved. Deleting them...', unresolved_count;
        
        DELETE FROM public.appointments 
        WHERE (doctor_id IS NOT NULL 
          AND doctor_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          AND resolve_doctor_short_id_to_uuid(doctor_id::text) IS NULL)
           OR (patient_id IS NOT NULL 
          AND patient_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          AND resolve_patient_short_id_to_uuid(patient_id::text) IS NULL);
    ELSE
        RAISE NOTICE 'No unresolved appointments found.';
    END IF;
END $$;

-- 9. Ensure appointments table has proper UUID constraints (only if needed)
DO $$
BEGIN
    -- Check if doctor_id column is UUID type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' 
        AND column_name = 'doctor_id' 
        AND data_type != 'uuid'
    ) THEN
        RAISE NOTICE 'Converting doctor_id to UUID type...';
        ALTER TABLE public.appointments ALTER COLUMN doctor_id TYPE UUID USING doctor_id::UUID;
    END IF;
    
    -- Check if patient_id column is UUID type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' 
        AND column_name = 'patient_id' 
        AND data_type != 'uuid'
    ) THEN
        RAISE NOTICE 'Converting patient_id to UUID type...';
        ALTER TABLE public.appointments ALTER COLUMN patient_id TYPE UUID USING patient_id::UUID;
    END IF;
END $$;

-- 10. Add foreign key constraints (only if they don't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'appointments_doctor_id_fkey' 
        AND table_name = 'appointments'
    ) THEN
        RAISE NOTICE 'Adding foreign key constraint for doctor_id...';
        ALTER TABLE public.appointments ADD CONSTRAINT appointments_doctor_id_fkey 
            FOREIGN KEY (doctor_id) REFERENCES public.doctors(id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'appointments_patient_id_fkey' 
        AND table_name = 'appointments'
    ) THEN
        RAISE NOTICE 'Adding foreign key constraint for patient_id...';
        ALTER TABLE public.appointments ADD CONSTRAINT appointments_patient_id_fkey 
            FOREIGN KEY (patient_id) REFERENCES public.patients(id);
    END IF;
END $$;

-- 11. Verify the fix
SELECT 
    'Appointments after fix:' as info,
    COUNT(*) as total_appointments,
    COUNT(CASE WHEN doctor_id IS NOT NULL THEN 1 END) as with_doctor_id,
    COUNT(CASE WHEN patient_id IS NOT NULL THEN 1 END) as with_patient_id
FROM public.appointments;

-- 12. Show sample appointments to verify they're working
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

-- 13. Show any remaining issues (should be 0)
SELECT 
    'Remaining problematic appointments:' as info,
    COUNT(*) as count
FROM public.appointments
WHERE doctor_id IS NOT NULL 
  AND doctor_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
   OR patient_id IS NOT NULL 
  AND patient_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
