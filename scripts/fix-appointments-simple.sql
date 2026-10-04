-- ========================================
-- SIMPLE APPOINTMENTS FIX
-- ========================================
-- This script fixes the appointments loading issue with better error handling

-- 1. Create appointments table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.appointments (
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
    consultation_type TEXT DEFAULT 'video',
    status TEXT DEFAULT 'scheduled',
    notes TEXT,
    symptoms TEXT,
    diagnosis TEXT,
    prescription TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create doctors table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.doctors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    specialty TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create patients table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    date_of_birth DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Add missing columns safely
DO $$
BEGIN
    -- Add email column to doctors if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'doctors' AND column_name = 'email'
    ) THEN
        ALTER TABLE public.doctors ADD COLUMN email TEXT;
    END IF;
    
    -- Add email column to patients if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'patients' AND column_name = 'email'
    ) THEN
        ALTER TABLE public.patients ADD COLUMN email TEXT;
    END IF;
    
    -- Add consultation_type column to appointments if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' AND column_name = 'consultation_type'
    ) THEN
        ALTER TABLE public.appointments ADD COLUMN consultation_type TEXT DEFAULT 'video';
    END IF;
    
    -- Add symptoms column to appointments if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' AND column_name = 'symptoms'
    ) THEN
        ALTER TABLE public.appointments ADD COLUMN symptoms TEXT;
    END IF;
    
    -- Add diagnosis column to appointments if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' AND column_name = 'diagnosis'
    ) THEN
        ALTER TABLE public.appointments ADD COLUMN diagnosis TEXT;
    END IF;
    
    -- Add prescription column to appointments if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' AND column_name = 'prescription'
    ) THEN
        ALTER TABLE public.appointments ADD COLUMN prescription TEXT;
    END IF;
    
    -- Drop the status check constraint if it exists to allow more flexible status values
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'appointments' 
        AND constraint_name = 'appointments_status_check'
    ) THEN
        ALTER TABLE public.appointments DROP CONSTRAINT appointments_status_check;
    END IF;
END $$;

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS appointments_doctor_id_idx ON public.appointments(doctor_id);
CREATE INDEX IF NOT EXISTS appointments_patient_id_idx ON public.appointments(patient_id);
CREATE INDEX IF NOT EXISTS appointments_date_idx ON public.appointments(appointment_date);
CREATE INDEX IF NOT EXISTS appointments_status_idx ON public.appointments(status);
CREATE INDEX IF NOT EXISTS doctors_user_id_idx ON public.doctors(user_id);
CREATE INDEX IF NOT EXISTS patients_user_id_idx ON public.patients(user_id);

-- 6. Disable RLS on all tables
ALTER TABLE public.appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients DISABLE ROW LEVEL SECURITY;

-- 7. Grant permissions
GRANT ALL ON public.appointments TO authenticated;
GRANT ALL ON public.doctors TO authenticated;
GRANT ALL ON public.patients TO authenticated;

-- 8. Insert sample doctor if none exists (without email to avoid errors)
INSERT INTO public.doctors (user_id, name, specialty)
SELECT 
    au.id,
    COALESCE(au.raw_user_meta_data->>'name', 'Dr. Sample Doctor'),
    'General Medicine'
FROM auth.users au
WHERE au.raw_user_meta_data->>'role' = 'doctor'
AND NOT EXISTS (SELECT 1 FROM public.doctors WHERE user_id = au.id)
LIMIT 1;

-- 9. Insert sample patient if none exists (without email to avoid errors)
INSERT INTO public.patients (user_id, name)
SELECT 
    au.id,
    COALESCE(au.raw_user_meta_data->>'name', 'Sample Patient')
FROM auth.users au
WHERE au.raw_user_meta_data->>'role' = 'patient'
AND NOT EXISTS (SELECT 1 FROM public.patients WHERE user_id = au.id)
LIMIT 1;

-- 10. Insert sample appointments for today and tomorrow
INSERT INTO public.appointments (
    doctor_id,
    patient_id,
    patient_name,
    doctor_name,
    appointment_date,
    start_time,
    end_time,
    consultation_type,
    status,
    symptoms
)
SELECT 
    d.id,
    p.id,
    p.name,
    d.name,
    CURRENT_DATE,
    '09:00:00',
    '09:30:00',
    'video',
    'scheduled',
    'Headache, fever, fatigue'
FROM public.doctors d
CROSS JOIN public.patients p
WHERE NOT EXISTS (
    SELECT 1 FROM public.appointments 
    WHERE doctor_id = d.id 
    AND patient_id = p.id 
    AND appointment_date = CURRENT_DATE
)
LIMIT 1;

INSERT INTO public.appointments (
    doctor_id,
    patient_id,
    patient_name,
    doctor_name,
    appointment_date,
    start_time,
    end_time,
    consultation_type,
    status,
    symptoms
)
SELECT 
    d.id,
    p.id,
    p.name,
    d.name,
    CURRENT_DATE,
    '10:00:00',
    '10:30:00',
    'audio',
    'active',
    'Chest pain, shortness of breath'
FROM public.doctors d
CROSS JOIN public.patients p
WHERE NOT EXISTS (
    SELECT 1 FROM public.appointments 
    WHERE doctor_id = d.id 
    AND patient_id = p.id 
    AND appointment_date = CURRENT_DATE
    AND start_time = '10:00:00'
)
LIMIT 1;

INSERT INTO public.appointments (
    doctor_id,
    patient_id,
    patient_name,
    doctor_name,
    appointment_date,
    start_time,
    end_time,
    consultation_type,
    status,
    symptoms
)
SELECT 
    d.id,
    p.id,
    p.name,
    d.name,
    CURRENT_DATE + INTERVAL '1 day',
    '14:00:00',
    '14:30:00',
    'chat',
    'scheduled',
    'Skin rash, itching'
FROM public.doctors d
CROSS JOIN public.patients p
WHERE NOT EXISTS (
    SELECT 1 FROM public.appointments 
    WHERE doctor_id = d.id 
    AND patient_id = p.id 
    AND appointment_date = CURRENT_DATE + INTERVAL '1 day'
)
LIMIT 1;

-- 11. Show results
SELECT 
    'Setup complete!' as status,
    COUNT(*) as total_appointments
FROM public.appointments;

SELECT 
    'Today''s appointments:' as info,
    id,
    patient_name,
    doctor_name,
    appointment_date,
    start_time,
    end_time,
    consultation_type,
    status
FROM public.appointments
WHERE appointment_date = CURRENT_DATE
ORDER BY start_time;
