-- Simple fix for consultation_meetings table
-- This removes the problematic unique constraint and uses a simpler approach

-- Drop the problematic unique index
DROP INDEX IF EXISTS unique_active_meeting_per_appointment;

-- Drop existing unique constraint if it exists
ALTER TABLE public.consultation_meetings 
DROP CONSTRAINT IF EXISTS unique_meeting_per_appointment;

-- Create a simple unique constraint on appointment_id only
-- This ensures only one meeting per appointment (regardless of active status)
ALTER TABLE public.consultation_meetings 
ADD CONSTRAINT unique_meeting_per_appointment 
UNIQUE (appointment_id);

-- Update the table to ensure all existing meetings are active
UPDATE public.consultation_meetings 
SET is_active = true 
WHERE is_active IS NULL;

-- Grant permissions
GRANT ALL ON public.consultation_meetings TO authenticated;

-- Add comment
COMMENT ON TABLE public.consultation_meetings IS 'Stores Zoom meeting details for consultations - simplified version';
