-- ========================================
-- ESSENTIAL DATABASE SETUP FOR MEDSYNC
-- ========================================
-- This script contains all necessary database setup and fixes

-- 1. Create essential tables if they don't exist
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id TEXT NOT NULL,
    doctor_id UUID,
    test_type TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_name TEXT NOT NULL,
    original_image_url TEXT,
    overlayed_image_url TEXT,
    masked_image_url TEXT,
    result JSONB,
    patient_info JSONB,
    notes TEXT,
    priority TEXT DEFAULT 'normal',
    uploaded_by UUID,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Ensure doctor_id exists when upgrading existing databases
ALTER TABLE reports ADD COLUMN IF NOT EXISTS doctor_id UUID;
CREATE INDEX IF NOT EXISTS reports_doctor_id_idx ON reports(doctor_id);

-- Ensure user_short_ids exists for privacy-friendly identifiers
CREATE TABLE IF NOT EXISTS public.user_short_ids (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    short_id TEXT NOT NULL UNIQUE,
    role TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS ml_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES reports(id),
    patient_id TEXT NOT NULL,
    test_type TEXT NOT NULL,
    findings TEXT NOT NULL,
    confidence NUMERIC NOT NULL,
    recommendations TEXT,
    severity TEXT,
    status TEXT DEFAULT 'pending_review',
    reviewed_by UUID,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    doctor_notes TEXT,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    notification_type TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    is_urgent BOOLEAN DEFAULT FALSE,
    related_id UUID,
    related_type TEXT,
    action_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Disable RLS on essential tables
ALTER TABLE reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE ml_suggestions DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- 3. Grant permissions
GRANT ALL ON reports TO authenticated;
GRANT ALL ON ml_suggestions TO authenticated;
GRANT ALL ON notifications TO authenticated;

-- 4. Fix notification type constraints
ALTER TABLE notifications 
DROP CONSTRAINT IF EXISTS notifications_notification_type_check;

ALTER TABLE notifications 
ADD CONSTRAINT notifications_notification_type_check 
CHECK (notification_type IN (
    'appointment_reminder',
    'test_result',
    'prescription_update',
    'emergency_alert',
    'system_notification',
    'ml_suggestion',
    'report_upload',
    'consultation_request',
    'payment_reminder',
    'general'
));

-- 5. Create storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('reports', 'reports', true, 52428800, ARRAY['image/*', 'application/pdf', 'text/plain'])
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY['image/*', 'application/pdf', 'text/plain'];

-- 6. Create storage policies
CREATE POLICY IF NOT EXISTS "Authenticated users can upload files" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'reports'
    AND auth.role() = 'authenticated'
);

CREATE POLICY IF NOT EXISTS "Authenticated users can read files" ON storage.objects
FOR SELECT USING (
    bucket_id = 'reports'
    AND auth.role() = 'authenticated'
);

CREATE POLICY IF NOT EXISTS "File owners can update files" ON storage.objects
FOR UPDATE USING (
    bucket_id = 'reports'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY IF NOT EXISTS "File owners can delete files" ON storage.objects
FOR DELETE USING (
    bucket_id = 'reports'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 7. Success message
SELECT '🎉 ESSENTIAL DATABASE SETUP COMPLETE!' as message;
SELECT '✅ All tables created/updated' as status1;
SELECT '✅ RLS disabled on essential tables' as status2;
SELECT '✅ Permissions granted' as status3;
SELECT '✅ Storage bucket configured' as status4;
SELECT '✅ Storage policies created' as status5;
SELECT '✅ Lab uploads should now work!' as status6;
