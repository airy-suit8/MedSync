-- ========================================
-- SIMPLE DATABASE SETUP
-- ========================================
-- This script creates a simple working database structure
-- Run this in your Supabase SQL Editor

-- 1. Create reports table if it doesn't exist
CREATE TABLE IF NOT EXISTS reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id TEXT NOT NULL,
    test_type TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_name TEXT NOT NULL,
    priority TEXT DEFAULT 'normal',
    notes TEXT DEFAULT '',
    uploaded_by UUID NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'uploaded',
    patient_info JSONB DEFAULT '{}'::jsonb
);

-- 2. Create ml_suggestions table if it doesn't exist
CREATE TABLE IF NOT EXISTS ml_suggestions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id TEXT NOT NULL,
    test_type TEXT NOT NULL,
    findings TEXT,
    confidence DECIMAL(3,2),
    recommendations TEXT,
    severity TEXT DEFAULT 'normal',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create notifications table if it doesn't exist
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    target_role TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE
);

-- 4. Disable RLS on all tables
ALTER TABLE reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE ml_suggestions DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- 5. Grant basic permissions
GRANT ALL ON reports TO anon, authenticated, service_role;
GRANT ALL ON ml_suggestions TO anon, authenticated, service_role;
GRANT ALL ON notifications TO anon, authenticated, service_role;

-- 6. Create storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT 
    'reports',
    'reports',
    true,
    10485760, -- 10MB
    ARRAY['image/jpeg', 'image/png', 'image/jpg', 'application/pdf', 'application/dicom']
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'reports');

-- 7. Success message
SELECT '🎉 SIMPLE DATABASE SETUP COMPLETE!' as message;
SELECT '✅ All tables created' as status1;
SELECT '✅ RLS disabled' as status2;
SELECT '✅ Basic permissions granted' as status3;
SELECT '✅ Storage bucket ready' as status4;
SELECT '✅ File uploads should now work!' as status5;
