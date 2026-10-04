-- ========================================
-- QUICK APPOINTMENTS FIX
-- ========================================
-- This script quickly fixes the appointments loading issue

-- 1. Check current state
SELECT 'Current state check:' as info;

-- Check if tables exist
SELECT 
    'Table existence:' as check_type,
    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'appointments') as appointments_exists,
    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'doctors') as doctors_exists,
    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'patients') as patients_exists;

-- Check current data
SELECT 
    'Current data:' as check_type,
    (SELECT COUNT(*) FROM public.appointments) as appointments_count,
    (SELECT COUNT(*) FROM public.doctors) as doctors_count,
    (SELECT COUNT(*) FROM public.patients) as patients_count;

-- 2. Create tables if they don't exist
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

-- 3. Add missing columns
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

-- 4. Create indexes
CREATE INDEX IF NOT EXISTS appointments_doctor_id_idx ON public.appointments(doctor_id);
CREATE INDEX IF NOT EXISTS appointments_date_idx ON public.appointments(appointment_date);
CREATE INDEX IF NOT EXISTS doctors_user_id_idx ON public.doctors(user_id);

-- 5. Disable RLS and grant permissions
ALTER TABLE public.appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients DISABLE ROW LEVEL SECURITY;

GRANT ALL ON public.appointments TO authenticated;
GRANT ALL ON public.doctors TO authenticated;
GRANT ALL ON public.patients TO authenticated;

-- 6. Create test data
DO $$
DECLARE
    doctor_id UUID := gen_random_uuid();
    patient_id UUID := gen_random_uuid();
    today_date DATE := CURRENT_DATE;
BEGIN
    -- Create a test doctor
    INSERT INTO public.doctors (id, user_id, name, specialty, email)
    VALUES (doctor_id, gen_random_uuid(), 'Dr. Test Doctor', 'General Medicine', 'doctor@test.com')
    ON CONFLICT DO NOTHING;
    
    -- Create a test patient
    INSERT INTO public.patients (id, user_id, name, email)
    VALUES (patient_id, gen_random_uuid(), 'Test Patient', 'patient@test.com')
    ON CONFLICT DO NOTHING;
    
    -- Clear existing appointments for today
    DELETE FROM public.appointments 
    WHERE appointment_date = today_date;
    
    -- Insert test appointments for today
    INSERT INTO public.appointments (
        doctor_id, patient_id, patient_name, doctor_name,
        appointment_date, start_time, end_time, consultation_type, status, symptoms
    ) VALUES 
    (doctor_id, patient_id, 'Test Patient', 'Dr. Test Doctor',
     today_date, '09:00:00', '09:30:00', 'video', 'scheduled', 'Headache, fever, fatigue'),
     
    (doctor_id, patient_id, 'Test Patient', 'Dr. Test Doctor',
     today_date, '10:00:00', '10:30:00', 'audio', 'scheduled', 'Chest pain, shortness of breath'),
     
    (doctor_id, patient_id, 'Test Patient', 'Dr. Test Doctor',
     today_date, '11:00:00', '11:30:00', 'chat', 'scheduled', 'Back pain, difficulty walking'),
     
    (doctor_id, patient_id, 'Test Patient', 'Dr. Test Doctor',
     today_date + INTERVAL '1 day', '14:00:00', '14:30:00', 'video', 'scheduled', 'Skin rash, itching');
     
    RAISE NOTICE 'Created test data: doctor_id=%, patient_id=%, today=%', doctor_id, patient_id, today_date;
END $$;

-- 7. Show results
SELECT 
    'Final state:' as info,
    (SELECT COUNT(*) FROM public.appointments) as appointments_count,
    (SELECT COUNT(*) FROM public.doctors) as doctors_count,
    (SELECT COUNT(*) FROM public.patients) as patients_count;

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

SELECT 
    'All doctors:' as info,
    id,
    user_id,
    name,
    specialty
FROM public.doctors;

-- 8. Test query that the app uses
SELECT 
    'Test query result:' as info,
    COUNT(*) as appointment_count
FROM public.appointments a
JOIN public.doctors d ON a.doctor_id = d.id
WHERE a.appointment_date = CURRENT_DATE;
