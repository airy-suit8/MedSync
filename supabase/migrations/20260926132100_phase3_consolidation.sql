-- 1. Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    name TEXT,
    phone TEXT,
    role TEXT CHECK (role IN ('patient', 'doctor', 'lab', 'admin')),
    short_id TEXT UNIQUE,
    address TEXT,
    specialty TEXT,
    license_number TEXT,
    date_of_birth DATE,
    gender TEXT,
    blood_type TEXT,
    height_cm NUMERIC,
    weight_kg NUMERIC,
    emergency_contact TEXT,
    chronic_conditions TEXT,
    current_medications TEXT,
    allergies TEXT,
    insurance_provider TEXT,
    insurance_number TEXT,
    lab_name TEXT,
    certification TEXT,
    lab_type TEXT,
    equipment_list TEXT[],
    operating_hours JSONB,
    online BOOLEAN DEFAULT false,
    last_seen TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- 2. Migrate data
-- from users
INSERT INTO public.profiles (id, email, name, role, specialty, short_id, online, last_seen, created_at, updated_at)
SELECT u.id, u.email, u.name, u.role, u.specialty, u.short_id, u.online, u.last_seen, u.created_at, u.updated_at
FROM public.users u
JOIN auth.users a ON u.id = a.id
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email, name = EXCLUDED.name, role = EXCLUDED.role, specialty = EXCLUDED.specialty, short_id = EXCLUDED.short_id;

-- from doctors
UPDATE public.profiles p
SET license_number = d.license_number, address = d.address, specialty = COALESCE(p.specialty, d.specialty)
FROM public.doctors d
WHERE p.id = d.user_id;

-- from patients
UPDATE public.profiles p
SET date_of_birth = pat.date_of_birth, gender = pat.gender, blood_type = pat.blood_type, height_cm = pat.height_cm, weight_kg = pat.weight_kg, emergency_contact = pat.emergency_contact, chronic_conditions = pat.chronic_conditions, current_medications = pat.current_medications, allergies = pat.allergies, insurance_provider = pat.insurance_provider, insurance_number = pat.insurance_number, address = COALESCE(p.address, pat.address)
FROM public.patients pat
WHERE p.id = pat.user_id;

-- from patient_profiles
UPDATE public.profiles p
SET current_medications = COALESCE(p.current_medications, array_to_string(pp.medications, ', '))
FROM public.patient_profiles pp
WHERE p.id = pp.user_id;

-- from labs
UPDATE public.profiles p
SET lab_name = l.lab_name, certification = l.certification, lab_type = l.lab_type, equipment_list = l.equipment_list, operating_hours = l.operating_hours, address = COALESCE(p.address, l.address)
FROM public.labs l
WHERE p.id = l.user_id;

-- 3. Update helper functions
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_auth_short_id()
RETURNS TEXT AS $$
  SELECT short_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 4. Drop foreign keys pointing to users
ALTER TABLE public.video_call_logs DROP CONSTRAINT IF EXISTS video_call_logs_user_id_fkey;
ALTER TABLE public.video_call_messages DROP CONSTRAINT IF EXISTS video_call_messages_sender_id_fkey;
ALTER TABLE public.video_call_sessions DROP CONSTRAINT IF EXISTS video_call_sessions_doctor_id_fkey;
ALTER TABLE public.video_call_sessions DROP CONSTRAINT IF EXISTS video_call_sessions_patient_id_fkey;

-- 5. Drop old tables
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.doctors CASCADE;
DROP TABLE IF EXISTS public.patients CASCADE;
DROP TABLE IF EXISTS public.patient_profiles CASCADE;
DROP TABLE IF EXISTS public.labs CASCADE;
DROP TABLE IF EXISTS public.user_short_ids CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;

-- 6. Add new foreign keys
ALTER TABLE public.video_call_logs ADD CONSTRAINT video_call_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);
ALTER TABLE public.video_call_messages ADD CONSTRAINT video_call_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id);
ALTER TABLE public.video_call_sessions ADD CONSTRAINT video_call_sessions_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.profiles(id);
ALTER TABLE public.video_call_sessions ADD CONSTRAINT video_call_sessions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.profiles(id);
