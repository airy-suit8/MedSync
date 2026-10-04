-- ========================================
-- SIMPLE REPORTS TABLE CHECK
-- ========================================
-- This script provides a simple check of the reports table without regex issues

-- 1. Check reports table structure
SELECT 
    'Reports Table Structure:' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'reports' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check sample data in reports table
SELECT 
    'Sample Reports Data:' as info,
    id,
    patient_id,
    doctor_id,
    test_type,
    uploaded_at,
    pg_typeof(doctor_id) as doctor_id_type,
    pg_typeof(patient_id) as patient_id_type
FROM public.reports 
ORDER BY uploaded_at DESC 
LIMIT 10;

-- 3. Check if there are any reports with non-UUID doctor_id values
SELECT 
    'Reports with Non-UUID Doctor ID:' as info,
    COUNT(*) as count
FROM public.reports 
WHERE doctor_id IS NOT NULL 
  AND pg_typeof(doctor_id) != 'uuid'::regtype;

-- 4. Check user_short_ids table for the specific Short ID mentioned in the error
SELECT 
    'User Short IDs for "00ab6d0311":' as info,
    user_id,
    short_id,
    role,
    created_at
FROM public.user_short_ids 
WHERE short_id = '00ab6d0311';

-- 5. Check if there are any foreign key constraints
SELECT 
    'Foreign Key Constraints on reports:' as info,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'reports'
  AND tc.table_schema = 'public';

-- 6. Check table permissions
SELECT 
    'Reports Table Permissions:' as info,
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.role_table_grants 
WHERE table_name = 'reports' 
  AND table_schema = 'public'
ORDER BY grantee, privilege_type;

-- 7. Summary
SELECT 
    'Summary:' as info,
    COUNT(*) as total_reports,
    COUNT(CASE WHEN doctor_id IS NOT NULL THEN 1 END) as reports_with_doctor_id,
    COUNT(CASE WHEN doctor_id IS NULL THEN 1 END) as reports_without_doctor_id
FROM public.reports;
