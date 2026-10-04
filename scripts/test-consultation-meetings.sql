-- Test script for consultation meetings functionality
-- This script helps verify that the shared meeting system is working correctly

-- 1. Check if the table exists
SELECT 
    table_name,
    table_schema,
    table_type
FROM information_schema.tables 
WHERE table_name = 'consultation_meetings' 
AND table_schema = 'public';

-- 2. Check table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'consultation_meetings' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Check if there are any existing meetings
SELECT 
    COUNT(*) as total_meetings,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_meetings
FROM public.consultation_meetings;

-- 4. Show sample meetings (if any exist)
SELECT 
    cm.id,
    cm.appointment_id,
    cm.meeting_id,
    cm.password,
    cm.host_id,
    cm.is_active,
    cm.created_at,
    a.doctor_name,
    a.patient_name,
    a.appointment_date,
    a.start_time
FROM public.consultation_meetings cm
LEFT JOIN public.appointments a ON cm.appointment_id = a.id
ORDER BY cm.created_at DESC
LIMIT 5;

-- 5. Check RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'consultation_meetings'
AND schemaname = 'public';

-- 6. Test creating a sample meeting (if you have appointments)
-- Uncomment and modify the appointment_id if you want to test
/*
INSERT INTO public.consultation_meetings (
    appointment_id,
    meeting_id,
    password,
    host_id,
    is_active
) VALUES (
    'your-appointment-id-here',  -- Replace with actual appointment ID
    '12345678901',
    'test123',
    'your-doctor-id-here',       -- Replace with actual doctor ID
    true
) ON CONFLICT (appointment_id) DO NOTHING;
*/

-- 7. Check permissions
SELECT 
    grantee,
    privilege_type,
    table_name
FROM information_schema.role_table_grants 
WHERE table_name = 'consultation_meetings'
AND table_schema = 'public';

-- 8. Summary
SELECT 
    '✅ Consultation Meetings Table Test Complete' as status,
    (SELECT COUNT(*) FROM public.consultation_meetings) as total_meetings,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'consultation_meetings') as rls_policies,
    (SELECT COUNT(*) FROM information_schema.role_table_grants WHERE table_name = 'consultation_meetings') as permissions;
