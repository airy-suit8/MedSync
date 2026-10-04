-- ========================================
-- TEST MEETING ID FIX
-- ========================================
-- This script tests that the meeting ID fix is working correctly

-- 1. Check if the table exists and has correct structure
SELECT 
    'Table Check' as test,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'consultation_meetings' 
            AND table_schema = 'public'
        ) THEN '✅ Table exists'
        ELSE '❌ Table missing'
    END as result;

-- 2. Check table structure
SELECT 
    'Table Structure' as test,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'consultation_meetings' 
            AND column_name = 'appointment_id'
            AND data_type = 'uuid'
        ) AND EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'consultation_meetings' 
            AND column_name = 'meeting_id'
            AND data_type = 'text'
        ) THEN '✅ Structure correct'
        ELSE '❌ Structure incorrect'
    END as result;

-- 3. Check RLS policies
SELECT 
    'RLS Policies' as test,
    CASE 
        WHEN (
            SELECT COUNT(*) FROM pg_policies 
            WHERE tablename = 'consultation_meetings'
        ) >= 3 THEN '✅ Policies exist'
        ELSE '❌ Missing policies'
    END as result;

-- 4. Check permissions
SELECT 
    'Permissions' as test,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.role_table_grants 
            WHERE table_name = 'consultation_meetings'
            AND privilege_type = 'ALL'
        ) THEN '✅ Permissions granted'
        ELSE '❌ Missing permissions'
    END as result;

-- 5. Check unique constraint
SELECT 
    'Unique Constraint' as test,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'consultation_meetings'
            AND indexname = 'unique_active_meeting_per_appointment'
        ) THEN '✅ Unique constraint exists'
        ELSE '❌ Missing unique constraint'
    END as result;

-- 6. Show current meetings (if any)
SELECT 
    'Current Meetings' as test,
    CASE 
        WHEN (SELECT COUNT(*) FROM public.consultation_meetings) > 0 
        THEN '📊 ' || (SELECT COUNT(*) FROM public.consultation_meetings) || ' meetings found'
        ELSE '📝 No meetings found'
    END as result;

-- 7. Show sample meeting data (if exists)
SELECT 
    cm.id,
    cm.appointment_id,
    cm.meeting_id,
    cm.password,
    cm.host_id,
    cm.is_active,
    cm.created_at,
    a.doctor_name,
    a.patient_name
FROM public.consultation_meetings cm
LEFT JOIN public.appointments a ON cm.appointment_id = a.id
ORDER BY cm.created_at DESC
LIMIT 3;

-- 8. Test summary
SELECT 
    '🎯 Meeting ID Fix Test Summary' as summary,
    (SELECT COUNT(*) FROM public.consultation_meetings) as total_meetings,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'consultation_meetings') as rls_policies,
    (SELECT COUNT(*) FROM information_schema.role_table_grants WHERE table_name = 'consultation_meetings') as permissions,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'consultation_meetings' 
            AND table_schema = 'public'
        ) THEN '✅ READY'
        ELSE '❌ NOT READY'
    END as status;
