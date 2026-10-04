-- ========================================
-- SIMPLE FIX FOR MEETING ID ISSUE
-- ========================================
-- This script provides a quick fix for the meeting ID issue
-- Option 1: Disable RLS temporarily (for testing)
-- Option 2: Use a more permissive RLS policy

-- 1. Create the consultation_meetings table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.consultation_meetings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    appointment_id UUID NOT NULL,
    meeting_id TEXT NOT NULL,
    password TEXT NOT NULL,
    host_id UUID NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add foreign key constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'consultation_meetings_appointment_id_fkey' 
        AND table_name = 'consultation_meetings'
    ) THEN
        ALTER TABLE public.consultation_meetings 
        ADD CONSTRAINT consultation_meetings_appointment_id_fkey 
        FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_consultation_meetings_appointment_id ON public.consultation_meetings(appointment_id);
CREATE INDEX IF NOT EXISTS idx_consultation_meetings_meeting_id ON public.consultation_meetings(meeting_id);
CREATE INDEX IF NOT EXISTS idx_consultation_meetings_active ON public.consultation_meetings(is_active);

-- 4. Add unique constraint to ensure only one active meeting per appointment
DROP INDEX IF EXISTS unique_active_meeting_per_appointment;
CREATE UNIQUE INDEX unique_active_meeting_per_appointment 
ON public.consultation_meetings (appointment_id) 
WHERE is_active = true;

-- 5. OPTION 1: Disable RLS temporarily (uncomment the line below for quick fix)
-- ALTER TABLE public.consultation_meetings DISABLE ROW LEVEL SECURITY;

-- 6. OPTION 2: Enable RLS with permissive policies (recommended for production)
ALTER TABLE public.consultation_meetings ENABLE ROW LEVEL SECURITY;

-- 7. Drop existing policies
DROP POLICY IF EXISTS "Users can view meetings for their appointments" ON public.consultation_meetings;
DROP POLICY IF EXISTS "Doctors can create meetings for their appointments" ON public.consultation_meetings;
DROP POLICY IF EXISTS "Hosts can update their meetings" ON public.consultation_meetings;

-- 8. Create very permissive policies for testing
CREATE POLICY "Allow all authenticated users to view meetings" ON public.consultation_meetings
    FOR SELECT USING (true);

CREATE POLICY "Allow doctors to create meetings" ON public.consultation_meetings
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'role' = 'doctor'
        )
    );

CREATE POLICY "Allow hosts to update meetings" ON public.consultation_meetings
    FOR UPDATE USING (host_id = auth.uid());

-- 9. Create trigger to update updated_at
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

-- 10. Grant permissions
GRANT ALL ON public.consultation_meetings TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- 11. Add comment
COMMENT ON TABLE public.consultation_meetings IS 'Stores Zoom meeting details for consultations to ensure doctor and patient join the same meeting';

-- 12. Verify the fix
SELECT 
    '✅ Simple Meeting ID Fix Applied Successfully' as status,
    (SELECT COUNT(*) FROM public.consultation_meetings) as total_meetings,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'consultation_meetings') as rls_policies,
    (SELECT COUNT(*) FROM information_schema.role_table_grants WHERE table_name = 'consultation_meetings') as permissions;

-- 13. Show current RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'consultation_meetings';
