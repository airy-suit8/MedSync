-- ========================================
-- QUICK FIX FOR YESTERDAY'S WORKING STATE
-- ========================================
-- This script restores the functionality that was working yesterday

-- 1. Ensure tables exist and have proper structure
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_id UUID UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('doctor', 'patient', 'admin')),
    name TEXT NOT NULL,
    specialty TEXT,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS public.doctors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    specialty TEXT,
    email TEXT,
    phone TEXT,
    license_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    date_of_birth DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add missing columns safely
DO $$
BEGIN
    -- Add missing columns to appointments
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'consultation_type') THEN
        ALTER TABLE public.appointments ADD COLUMN consultation_type TEXT DEFAULT 'video';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'symptoms') THEN
        ALTER TABLE public.appointments ADD COLUMN symptoms TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'diagnosis') THEN
        ALTER TABLE public.appointments ADD COLUMN diagnosis TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'prescription') THEN
        ALTER TABLE public.appointments ADD COLUMN prescription TEXT;
    END IF;
    
    -- Add missing columns to doctors
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'doctors' AND column_name = 'email') THEN
        ALTER TABLE public.doctors ADD COLUMN email TEXT;
    END IF;
    
    -- Add missing columns to patients
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'email') THEN
        ALTER TABLE public.patients ADD COLUMN email TEXT;
    END IF;
END $$;

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS appointments_doctor_id_idx ON public.appointments(doctor_id);
CREATE INDEX IF NOT EXISTS appointments_date_idx ON public.appointments(appointment_date);
CREATE INDEX IF NOT EXISTS doctors_user_id_idx ON public.doctors(user_id);
CREATE INDEX IF NOT EXISTS patients_user_id_idx ON public.patients(user_id);
CREATE INDEX IF NOT EXISTS users_auth_id_idx ON public.users(auth_id);

-- 4. Disable RLS and grant permissions
ALTER TABLE public.appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

GRANT ALL ON public.appointments TO authenticated;
GRANT ALL ON public.doctors TO authenticated;
GRANT ALL ON public.patients TO authenticated;
GRANT ALL ON public.users TO authenticated;

-- 5. Create test data if none exists
DO $$
DECLARE
    test_user_id UUID := gen_random_uuid();
    test_doctor_id UUID := gen_random_uuid();
    test_patient_id UUID := gen_random_uuid();
    today_date DATE := CURRENT_DATE;
    appointment_count INTEGER;
BEGIN
    -- Check if we have any appointments
    SELECT COUNT(*) INTO appointment_count FROM public.appointments;
    
    -- Only create test data if no appointments exist
    IF appointment_count = 0 THEN
        -- Create a test user
        INSERT INTO public.users (id, auth_id, role, name, specialty, email)
        VALUES (test_user_id, gen_random_uuid(), 'doctor', 'Dr. Test Doctor', 'General Medicine', 'doctor@test.com')
        ON CONFLICT DO NOTHING;
        
        -- Create a test doctor
        INSERT INTO public.doctors (id, user_id, name, specialty, email, license_number)
        VALUES (test_doctor_id, test_user_id, 'Dr. Test Doctor', 'General Medicine', 'doctor@test.com', 'DR' || substr(md5(random()::text), 1, 8))
        ON CONFLICT DO NOTHING;
        
        -- Create a test patient
        INSERT INTO public.patients (id, user_id, name, email)
        VALUES (test_patient_id, gen_random_uuid(), 'Test Patient', 'patient@test.com')
        ON CONFLICT DO NOTHING;
        
        -- Insert test appointments for today and tomorrow
        INSERT INTO public.appointments (
            doctor_id, patient_id, patient_name, doctor_name,
            appointment_date, start_time, end_time, consultation_type, status, symptoms
        ) VALUES 
        (test_doctor_id, test_patient_id, 'Test Patient', 'Dr. Test Doctor',
         today_date, '09:00:00', '09:30:00', 'video', 'scheduled', 'Headache, fever, fatigue'),
         
        (test_doctor_id, test_patient_id, 'Test Patient', 'Dr. Test Doctor',
         today_date, '10:00:00', '10:30:00', 'audio', 'scheduled', 'Chest pain, shortness of breath'),
         
        (test_doctor_id, test_patient_id, 'Test Patient', 'Dr. Test Doctor',
         today_date + INTERVAL '1 day', '14:00:00', '14:30:00', 'video', 'scheduled', 'Skin rash, itching')
        ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Created test data: user_id=%, doctor_id=%, patient_id=%, today=%', test_user_id, test_doctor_id, test_patient_id, today_date;
    ELSE
        RAISE NOTICE 'Appointments already exist, skipping test data creation';
    END IF;
END $$;

-- 6. Show final state
SELECT 
    'Final state:' as info,
    (SELECT COUNT(*) FROM public.appointments) as appointments_count,
    (SELECT COUNT(*) FROM public.doctors) as doctors_count,
    (SELECT COUNT(*) FROM public.patients) as patients_count,
    (SELECT COUNT(*) FROM public.users) as users_count;

SELECT 
    'Today''s appointments:' as info,
    id,
    patient_name,
    doctor_name,
    appointment_date,
    start_time,
    end_time,
    status
FROM public.appointments
WHERE appointment_date = CURRENT_DATE
ORDER BY start_time;
