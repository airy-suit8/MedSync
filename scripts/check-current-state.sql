-- ========================================
-- QUICK DIAGNOSTIC - CHECK CURRENT STATE
-- ========================================
-- Run this to see what's currently in your database

-- 1. Check if tables exist
SELECT 
    'Table existence check:' as info,
    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'appointments') as appointments_exists,
    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'doctors') as doctors_exists,
    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'patients') as patients_exists,
    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') as users_exists;

-- 2. Check current data counts
SELECT 
    'Current data counts:' as info,
    (SELECT COUNT(*) FROM public.appointments) as appointments_count,
    (SELECT COUNT(*) FROM public.doctors) as doctors_count,
    (SELECT COUNT(*) FROM public.patients) as patients_count,
    (SELECT COUNT(*) FROM public.users) as users_count;

-- 3. Check today's appointments
SELECT 
    'Today''s appointments:' as info,
    id,
    patient_name,
    doctor_name,
    appointment_date,
    start_time,
    end_time,
    status
FROM public.appointments
WHERE appointment_date = CURRENT_DATE
ORDER BY start_time;

-- 4. Check all doctors
SELECT 
    'All doctors:' as info,
    id,
    user_id,
    name,
    specialty
FROM public.doctors
LIMIT 10;

-- 5. Check RLS status
SELECT 
    'RLS status:' as info,
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename IN ('appointments', 'doctors', 'patients', 'users')
AND schemaname = 'public';

-- 6. Check permissions
SELECT 
    'Permissions check:' as info,
    table_name,
    privilege_type
FROM information_schema.table_privileges 
WHERE table_name IN ('appointments', 'doctors', 'patients', 'users')
AND grantee = 'authenticated';
