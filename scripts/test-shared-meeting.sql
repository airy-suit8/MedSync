-- Test script for shared meeting functionality
-- This script helps verify that doctor and patient can join the same meeting

-- 1. Check if the consultation_meetings table exists and has the right structure
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

-- 3. Check constraints
SELECT 
    constraint_name,
    constraint_type
FROM information_schema.table_constraints 
WHERE table_name = 'consultation_meetings' 
AND table_schema = 'public';

-- 4. Check if there are any existing meetings
SELECT 
    COUNT(*) as total_meetings,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_meetings
FROM public.consultation_meetings;

-- 5. Show sample meetings if any exist
SELECT 
    id,
    appointment_id,
    meeting_id,
    password,
    host_id,
    is_active,
    created_at
FROM public.consultation_meetings
ORDER BY created_at DESC
LIMIT 5;

-- 6. Test the unique constraint by trying to create a duplicate
-- (This will show an error if the constraint is working)
-- Uncomment the lines below to test:
/*
INSERT INTO public.consultation_meetings (
    appointment_id,
    meeting_id,
    password,
    host_id,
    is_active
) VALUES (
    'test-appointment-id',
    '12345678901',
    'testpass',
    'test-host-id',
    true
);
*/

-- 7. Check permissions
SELECT 
    grantee,
    privilege_type
FROM information_schema.role_table_grants 
WHERE table_name = 'consultation_meetings' 
AND table_schema = 'public';
