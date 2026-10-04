-- Fix appointments table - add missing consultation-related columns
-- This resolves PGRST204 errors for missing columns in consultations

-- Add the missing completed_at column
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- Add missing consultation fields (if they don't exist)
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS diagnosis TEXT;

ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS prescription TEXT;

-- Check if notes column exists, if not add it (some might already have it)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'appointments' 
        AND column_name = 'notes'
    ) THEN
        ALTER TABLE public.appointments ADD COLUMN notes TEXT;
    END IF;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS appointments_completed_at_idx 
ON public.appointments(completed_at);

CREATE INDEX IF NOT EXISTS appointments_status_idx 
ON public.appointments(status);

-- Add helpful comments
COMMENT ON COLUMN public.appointments.completed_at 
IS 'Timestamp when consultation/appointment was completed';

COMMENT ON COLUMN public.appointments.diagnosis 
IS 'Medical diagnosis from consultation';

COMMENT ON COLUMN public.appointments.prescription 
IS 'Prescribed medication/treatment';

COMMENT ON COLUMN public.appointments.notes 
IS 'Additional consultation notes';

-- Show the updated table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'appointments'
ORDER BY ordinal_position;

-- Verify the column exists
SELECT 'completed_at column added successfully' as status;
