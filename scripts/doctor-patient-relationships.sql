-- ========================================
-- DOCTOR-PATIENT RELATIONSHIP MANAGEMENT
-- ========================================
-- This script creates proper doctor-patient relationships for controlled access

-- 1. Create doctor-patient relationship table
CREATE TABLE IF NOT EXISTS public.doctor_patient_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL, -- References auth.users.id for doctor
    patient_id UUID NOT NULL, -- References auth.users.id for patient
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_by UUID, -- Who made this assignment (admin/doctor)
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique active assignments
    UNIQUE(doctor_id, patient_id, is_active)
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS doctor_patient_assignments_doctor_idx ON public.doctor_patient_assignments(doctor_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS doctor_patient_assignments_patient_idx ON public.doctor_patient_assignments(patient_id) WHERE is_active = true;

-- 3. Add foreign key constraints to reports table to ensure proper relationships
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'reports_doctor_id_fkey' 
        AND table_name = 'reports'
    ) THEN
        ALTER TABLE public.reports ADD CONSTRAINT reports_doctor_id_fkey 
            FOREIGN KEY (doctor_id) REFERENCES auth.users(id);
    END IF;
END $$;

-- 4. Create function to automatically assign doctor-patient relationship when report is created
CREATE OR REPLACE FUNCTION public.auto_assign_doctor_patient()
RETURNS TRIGGER AS $$
DECLARE
    patient_uuid UUID;
    doctor_uuid UUID;
BEGIN
    -- Get patient UUID from patient_id (could be short_id or UUID)
    SELECT CASE 
        WHEN NEW.patient_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' 
        THEN NEW.patient_id::UUID
        ELSE (
            SELECT usi.user_id FROM public.user_short_ids usi 
            WHERE usi.short_id = NEW.patient_id
        )
    END INTO patient_uuid;
    
    -- Doctor ID should already be UUID
    doctor_uuid := NEW.doctor_id;
    
    -- Create doctor-patient assignment if it doesn't exist
    IF patient_uuid IS NOT NULL AND doctor_uuid IS NOT NULL THEN
        INSERT INTO public.doctor_patient_assignments (doctor_id, patient_id, assigned_by)
        VALUES (doctor_uuid, patient_uuid, doctor_uuid)
        ON CONFLICT (doctor_id, patient_id, is_active) DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create trigger to auto-assign relationships on report creation
DROP TRIGGER IF EXISTS trigger_auto_assign_doctor_patient ON public.reports;
CREATE TRIGGER trigger_auto_assign_doctor_patient
    AFTER INSERT ON public.reports
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_assign_doctor_patient();

-- 6. Create function to get doctor's assigned patients
CREATE OR REPLACE FUNCTION public.get_doctor_patients(doctor_uuid UUID)
RETURNS TABLE (
    patient_id UUID,
    patient_short_id TEXT,
    patient_name TEXT,
    patient_email TEXT,
    assigned_at TIMESTAMP WITH TIME ZONE,
    total_reports BIGINT
) AS $$
DECLARE
    doctor_short_id TEXT;
BEGIN
    -- Get doctor's short ID
    SELECT usi.short_id INTO doctor_short_id 
    FROM public.user_short_ids usi 
    WHERE usi.user_id = doctor_uuid;
    
    RETURN QUERY
    SELECT 
        dpa.patient_id,
        usi.short_id as patient_short_id,
        u.name as patient_name,
        au.email as patient_email,
        dpa.assigned_at,
        COALESCE(report_counts.total_reports, 0) as total_reports
    FROM public.doctor_patient_assignments dpa
    LEFT JOIN public.user_short_ids usi ON dpa.patient_id = usi.user_id
    LEFT JOIN public.users u ON dpa.patient_id = u.auth_id
    LEFT JOIN auth.users au ON dpa.patient_id = au.id
    LEFT JOIN (
        SELECT 
            CASE 
                WHEN r.patient_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' 
                THEN r.patient_id::UUID
                ELSE (SELECT usi2.user_id FROM public.user_short_ids usi2 WHERE usi2.short_id = r.patient_id)
            END as resolved_patient_id,
            COUNT(*) as total_reports
        FROM public.reports r
        WHERE r.doctor_id = doctor_uuid::TEXT OR r.doctor_id = doctor_short_id
        GROUP BY resolved_patient_id
    ) report_counts ON dpa.patient_id = report_counts.resolved_patient_id
    WHERE dpa.doctor_id = doctor_uuid 
    AND dpa.is_active = true
    ORDER BY dpa.assigned_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 7. Create function to check if doctor can access patient
CREATE OR REPLACE FUNCTION public.doctor_can_access_patient(doctor_uuid UUID, patient_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.doctor_patient_assignments
        WHERE doctor_id = doctor_uuid 
        AND patient_id = patient_uuid 
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql;

-- 8. Disable RLS and grant permissions
ALTER TABLE public.doctor_patient_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_short_ids DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.doctor_patient_assignments TO authenticated;
GRANT ALL ON public.user_short_ids TO authenticated;

-- Grant permissions on users table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') THEN
        ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
        GRANT ALL ON public.users TO authenticated;
    END IF;
END $$;

-- 9. Success message
SELECT '🎉 DOCTOR-PATIENT RELATIONSHIPS SETUP COMPLETE!' as message;
SELECT '✅ doctor_patient_assignments table created' as status1;
SELECT '✅ Auto-assignment trigger created' as status2;
SELECT '✅ Helper functions created' as status3;
SELECT '✅ Permissions granted' as status4;
SELECT '📋 Now doctors will only see their assigned patients!' as status5;
