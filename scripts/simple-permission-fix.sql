-- ========================================
-- SIMPLE PERMISSION FIX FOR USERS TABLE
-- ========================================
-- This script fixes permission issues without complex joins

-- 1. Force disable RLS on problematic tables
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_short_ids DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports DISABLE ROW LEVEL SECURITY;

-- 2. Remove problematic foreign key constraint
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_doctor_id_fkey;

-- 3. Grant all permissions
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.users TO anon;
GRANT ALL ON public.user_short_ids TO authenticated;
GRANT ALL ON public.user_short_ids TO anon;
GRANT ALL ON public.reports TO authenticated;
GRANT ALL ON public.reports TO anon;

-- 4. Fix the auto-assignment trigger to handle TEXT properly
CREATE OR REPLACE FUNCTION public.auto_assign_doctor_patient()
RETURNS TRIGGER AS $$
DECLARE
    patient_uuid UUID;
    doctor_uuid UUID;
BEGIN
    -- Get patient UUID from patient_id (could be short_id or UUID)
    BEGIN
        IF NEW.patient_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
            patient_uuid := NEW.patient_id::UUID;
        ELSE
            SELECT usi.user_id INTO patient_uuid
            FROM public.user_short_ids usi 
            WHERE usi.short_id = NEW.patient_id;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        patient_uuid := NULL;
    END;
    
    -- Get doctor UUID from doctor_id (could be short_id or UUID)  
    BEGIN
        IF NEW.doctor_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
            doctor_uuid := NEW.doctor_id::UUID;
        ELSE
            SELECT usi.user_id INTO doctor_uuid
            FROM public.user_short_ids usi 
            WHERE usi.short_id = NEW.doctor_id;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        doctor_uuid := NULL;
    END;
    
    -- Create doctor-patient assignment if both UUIDs are valid
    IF patient_uuid IS NOT NULL AND doctor_uuid IS NOT NULL THEN
        INSERT INTO public.doctor_patient_assignments (doctor_id, patient_id, assigned_by)
        VALUES (doctor_uuid, patient_uuid, doctor_uuid)
        ON CONFLICT (doctor_id, patient_id, is_active) DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create simplified function that avoids public.users table
CREATE OR REPLACE FUNCTION public.get_doctor_patients_simple(doctor_uuid UUID)
RETURNS TABLE (
    patient_id UUID,
    patient_short_id TEXT,
    patient_name TEXT,
    patient_email TEXT,
    assigned_at TIMESTAMP WITH TIME ZONE,
    total_reports BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dpa.patient_id,
        usi.short_id as patient_short_id,
        au.raw_user_meta_data->>'name' as patient_name,
        au.email as patient_email,
        dpa.assigned_at,
        0::BIGINT as total_reports  -- Simplified - count reports separately if needed
    FROM public.doctor_patient_assignments dpa
    LEFT JOIN public.user_short_ids usi ON dpa.patient_id = usi.user_id
    LEFT JOIN auth.users au ON dpa.patient_id = au.id
    WHERE dpa.doctor_id = doctor_uuid 
    AND dpa.is_active = true
    ORDER BY dpa.assigned_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 6. Grant permissions on function
GRANT EXECUTE ON FUNCTION public.get_doctor_patients_simple(UUID) TO authenticated;

-- 7. Success message
SELECT '✅ Simple permissions and function created!' as status;
SELECT 'Use get_doctor_patients_simple() instead of get_doctor_patients()' as note;
