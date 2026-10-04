-- ========================================
-- FINAL APPOINTMENTS FIX
-- ========================================
-- This script fixes the most common issues with appointments not loading

-- 1. Ensure tables exist with proper structure
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
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    specialty TEXT,
    email TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
    
    -- Remove any problematic constraints
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'appointments' AND constraint_name = 'appointments_status_check') THEN
        ALTER TABLE public.appointments DROP CONSTRAINT appointments_status_check;
    END IF;
END $$;

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS appointments_doctor_id_idx ON public.appointments(doctor_id);
CREATE INDEX IF NOT EXISTS appointments_patient_id_idx ON public.appointments(patient_id);
CREATE INDEX IF NOT EXISTS appointments_date_idx ON public.appointments(appointment_date);
CREATE INDEX IF NOT EXISTS appointments_status_idx ON public.appointments(status);
CREATE INDEX IF NOT EXISTS doctors_user_id_idx ON public.doctors(user_id);
CREATE INDEX IF NOT EXISTS patients_user_id_idx ON public.patients(user_id);

-- 4. Disable RLS and grant permissions
ALTER TABLE public.appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients DISABLE ROW LEVEL SECURITY;

GRANT ALL ON public.appointments TO authenticated;
GRANT ALL ON public.doctors TO authenticated;
GRANT ALL ON public.patients TO authenticated;

-- 5. Create test users if they don't exist
DO $$
DECLARE
    doctor_user_id UUID;
    patient_user_id UUID;
BEGIN
    -- Create a test doctor user if none exists
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE raw_user_meta_data->>'role' = 'doctor') THEN
        INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
        VALUES (
            gen_random_uuid(),
            'doctor@test.com',
            crypt('password123', gen_salt('bf')),
            NOW(),
            '{"role": "doctor", "name": "Dr. Test Doctor"}'
        );
    END IF;
    
    -- Create a test patient user if none exists
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE raw_user_meta_data->>'role' = 'patient') THEN
        INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
        VALUES (
            gen_random_uuid(),
            'patient@test.com',
            crypt('password123', gen_salt('bf')),
            NOW(),
            '{"role": "patient", "name": "Test Patient"}'
        );
    END IF;
    
    -- Get the doctor user ID
    SELECT id INTO doctor_user_id FROM auth.users WHERE raw_user_meta_data->>'role' = 'doctor' LIMIT 1;
    
    -- Get the patient user ID
    SELECT id INTO patient_user_id FROM auth.users WHERE raw_user_meta_data->>'role' = 'patient' LIMIT 1;
    
    -- Create doctor record if it doesn't exist
    IF doctor_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.doctors WHERE user_id = doctor_user_id) THEN
        INSERT INTO public.doctors (user_id, name, specialty, email)
        VALUES (doctor_user_id, 'Dr. Test Doctor', 'General Medicine', 'doctor@test.com');
    END IF;
    
    -- Create patient record if it doesn't exist
    IF patient_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.patients WHERE user_id = patient_user_id) THEN
        INSERT INTO public.patients (user_id, name, email)
        VALUES (patient_user_id, 'Test Patient', 'patient@test.com');
    END IF;
END $$;

-- 6. Insert sample appointments using the actual doctor and patient IDs
DO $$
DECLARE
    doctor_record_id UUID;
    patient_record_id UUID;
BEGIN
    -- Get the doctor record ID
    SELECT d.id INTO doctor_record_id 
    FROM public.doctors d 
    JOIN auth.users u ON d.user_id = u.id 
    WHERE u.raw_user_meta_data->>'role' = 'doctor' 
    LIMIT 1;
    
    -- Get the patient record ID
    SELECT p.id INTO patient_record_id 
    FROM public.patients p 
    JOIN auth.users u ON p.user_id = u.id 
    WHERE u.raw_user_meta_data->>'role' = 'patient' 
    LIMIT 1;
    
    -- Insert appointments if we have both doctor and patient
    IF doctor_record_id IS NOT NULL AND patient_record_id IS NOT NULL THEN
        -- Clear existing appointments for today
        DELETE FROM public.appointments 
        WHERE doctor_id = doctor_record_id 
        AND appointment_date = CURRENT_DATE;
        
        -- Insert new appointments
        INSERT INTO public.appointments (
            doctor_id, patient_id, patient_name, doctor_name,
            appointment_date, start_time, end_time, consultation_type, status, symptoms
        ) VALUES 
        (doctor_record_id, patient_record_id, 'Test Patient', 'Dr. Test Doctor',
         CURRENT_DATE, '09:00:00', '09:30:00', 'video', 'scheduled', 'Headache, fever, fatigue'),
        
        (doctor_record_id, patient_record_id, 'Test Patient', 'Dr. Test Doctor',
         CURRENT_DATE, '10:00:00', '10:30:00', 'audio', 'scheduled', 'Chest pain, shortness of breath'),
        
        (doctor_record_id, patient_record_id, 'Test Patient', 'Dr. Test Doctor',
         CURRENT_DATE + INTERVAL '1 day', '14:00:00', '14:30:00', 'chat', 'scheduled', 'Skin rash, itching');
        
        RAISE NOTICE 'Created appointments for doctor % and patient %', doctor_record_id, patient_record_id;
    ELSE
        RAISE NOTICE 'Could not create appointments: doctor_id=%, patient_id=%', doctor_record_id, patient_record_id;
    END IF;
END $$;

-- 7. Show final results
SELECT 
    'Final setup complete!' as status,
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

SELECT 
    'Test login credentials:' as info,
    'Doctor: doctor@test.com / password123' as doctor_creds,
    'Patient: patient@test.com / password123' as patient_creds;
