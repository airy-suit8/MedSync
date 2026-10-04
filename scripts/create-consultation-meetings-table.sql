-- Create consultation_meetings table to store meeting details
-- This ensures doctor and patient join the same meeting

CREATE TABLE IF NOT EXISTS public.consultation_meetings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
    meeting_id TEXT NOT NULL,
    password TEXT NOT NULL,
    host_id UUID NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_consultation_meetings_appointment_id ON public.consultation_meetings(appointment_id);
CREATE INDEX IF NOT EXISTS idx_consultation_meetings_meeting_id ON public.consultation_meetings(meeting_id);
CREATE INDEX IF NOT EXISTS idx_consultation_meetings_active ON public.consultation_meetings(is_active);

-- Add unique constraint to ensure only one active meeting per appointment
-- Using a partial index instead of WHERE clause in unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_meeting_per_appointment 
ON public.consultation_meetings (appointment_id) 
WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.consultation_meetings ENABLE ROW LEVEL SECURITY;

-- Create policies with IF NOT EXISTS checks
DO $$ 
BEGIN
    -- Policy for viewing meetings
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'consultation_meetings' 
        AND policyname = 'Users can view meetings for their appointments'
    ) THEN
        CREATE POLICY "Users can view meetings for their appointments" ON public.consultation_meetings
            FOR SELECT USING (
                appointment_id IN (
                    SELECT id FROM public.appointments 
                    WHERE doctor_id = auth.uid() OR patient_id = auth.uid()
                )
            );
    END IF;

    -- Policy for creating meetings
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'consultation_meetings' 
        AND policyname = 'Doctors can create meetings for their appointments'
    ) THEN
        CREATE POLICY "Doctors can create meetings for their appointments" ON public.consultation_meetings
            FOR INSERT WITH CHECK (
                host_id = auth.uid() AND
                appointment_id IN (
                    SELECT id FROM public.appointments 
                    WHERE doctor_id = auth.uid()
                )
            );
    END IF;

    -- Policy for updating meetings
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'consultation_meetings' 
        AND policyname = 'Hosts can update their meetings'
    ) THEN
        CREATE POLICY "Hosts can update their meetings" ON public.consultation_meetings
            FOR UPDATE USING (host_id = auth.uid());
    END IF;
END $$;

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_consultation_meetings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_consultation_meetings_updated_at ON public.consultation_meetings;
CREATE TRIGGER trigger_update_consultation_meetings_updated_at
    BEFORE UPDATE ON public.consultation_meetings
    FOR EACH ROW
    EXECUTE FUNCTION update_consultation_meetings_updated_at();

-- Grant permissions
GRANT ALL ON public.consultation_meetings TO authenticated;

-- Add comment
COMMENT ON TABLE public.consultation_meetings IS 'Stores Zoom meeting details for consultations to ensure doctor and patient join the same meeting';
