-- ========================================
-- FIX APPOINTMENTS TABLE SCHEMA
-- ========================================
-- This script checks and fixes the appointments table to handle UUIDs properly

-- 1. Check if appointments table exists and its current schema
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'appointments') THEN
        -- Create appointments table if it doesn't exist
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
    ELSE
        -- Check if doctor_id and patient_id are UUID type
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'appointments' 
            AND column_name = 'doctor_id' 
            AND data_type != 'uuid'
        ) THEN
            -- Convert doctor_id to UUID if it's not already
            ALTER TABLE public.appointments ALTER COLUMN doctor_id TYPE UUID USING doctor_id::UUID;
            RAISE NOTICE 'Converted doctor_id to UUID type';
        END IF;
        
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'appointments' 
            AND column_name = 'patient_id' 
            AND data_type != 'uuid'
        ) THEN
            -- Convert patient_id to UUID if it's not already
            ALTER TABLE public.appointments ALTER COLUMN patient_id TYPE UUID USING patient_id::UUID;
            RAISE NOTICE 'Converted patient_id to UUID type';
        END IF;
        
        -- Ensure required columns exist
        ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS patient_name TEXT NOT NULL DEFAULT 'Unknown Patient';
        ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS doctor_name TEXT;
        ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 30;
        ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS appointment_type TEXT DEFAULT 'consultation';
        ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS notes TEXT;
        ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        
        -- Create indexes if they don't exist
        CREATE INDEX IF NOT EXISTS appointments_doctor_id_idx ON public.appointments(doctor_id);
        CREATE INDEX IF NOT EXISTS appointments_patient_id_idx ON public.appointments(patient_id);
        CREATE INDEX IF NOT EXISTS appointments_date_idx ON public.appointments(appointment_date);
        CREATE INDEX IF NOT EXISTS appointments_status_idx ON public.appointments(status);
        
        RAISE NOTICE 'Updated existing appointments table schema';
    END IF;
END $$;

-- 2. Create doctor_availability table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.doctor_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique availability per doctor per day
    UNIQUE(doctor_id, day_of_week)
);

-- Create indexes for doctor_availability
CREATE INDEX IF NOT EXISTS doctor_availability_doctor_id_idx ON public.doctor_availability(doctor_id);
CREATE INDEX IF NOT EXISTS doctor_availability_day_idx ON public.doctor_availability(day_of_week);

-- Disable RLS and grant permissions
ALTER TABLE public.doctor_availability DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.doctor_availability TO authenticated;

-- 3. Show current appointments table schema
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'appointments' 
ORDER BY ordinal_position;

-- 4. Show sample appointments data (if any)
SELECT 
    'Current appointments count:' as info,
    COUNT(*) as count
FROM public.appointments;

-- 5. Show any appointments with potential UUID issues
SELECT 
    'Appointments with potential UUID issues:' as info,
    id,
    doctor_id,
    patient_id,
    appointment_date,
    status
FROM public.appointments
WHERE doctor_id IS NULL OR patient_id IS NULL
LIMIT 10;
