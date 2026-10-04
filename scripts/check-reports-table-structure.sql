-- ========================================
-- CHECK REPORTS TABLE STRUCTURE
-- ========================================
-- This script helps identify UUID constraint issues in the reports table

-- 1. Check reports table structure
SELECT 
    'Reports Table Structure:' as info,
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'reports' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check constraints on reports table
SELECT 
    'Reports Table Constraints:' as info,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    tc.is_deferrable,
    tc.initially_deferred
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.table_name = 'reports'
  AND tc.table_schema = 'public'
ORDER BY tc.constraint_type, kcu.column_name;

-- 3. Check foreign key constraints specifically
SELECT 
    'Foreign Key Constraints:' as info,
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

-- 4. Check sample data in reports table
SELECT 
    'Sample Reports Data:' as info,
    id,
    patient_id,
    doctor_id,
    test_type,
    uploaded_at,
    CASE 
        WHEN doctor_id IS NULL THEN 'NULL'
        WHEN pg_typeof(doctor_id) = 'uuid'::regtype THEN 'UUID Type'
        WHEN doctor_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN 'Valid UUID Format'
        WHEN doctor_id::text ~ '^[a-zA-Z0-9]{10}$' THEN 'Short ID Format'
        ELSE 'Invalid Format'
    END as doctor_id_format,
    CASE 
        WHEN patient_id IS NULL THEN 'NULL'
        WHEN pg_typeof(patient_id) = 'uuid'::regtype THEN 'UUID Type'
        WHEN patient_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN 'Valid UUID Format'
        WHEN patient_id::text ~ '^[a-zA-Z0-9]{10}$' THEN 'Short ID Format'
        ELSE 'Invalid Format'
    END as patient_id_format
FROM public.reports 
ORDER BY uploaded_at DESC 
LIMIT 10;

-- 5. Check for any reports with invalid doctor_id format
SELECT 
    'Reports with Invalid Doctor ID Format:' as info,
    id,
    doctor_id,
    test_type,
    uploaded_at
FROM public.reports 
WHERE doctor_id IS NOT NULL 
  AND doctor_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND doctor_id::text !~ '^[a-zA-Z0-9]{10}$'
ORDER BY uploaded_at DESC;

-- 6. Check user_short_ids table for the specific Short ID mentioned in the error
SELECT 
    'User Short IDs for "00ab6d0311":' as info,
    user_id,
    short_id,
    role,
    created_at
FROM public.user_short_ids 
WHERE short_id = '00ab6d0311';

-- 7. Check if there are any UUID validation triggers or functions
SELECT 
    'UUID Validation Functions:' as info,
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public'
  AND routine_name ILIKE '%uuid%'
  OR routine_name ILIKE '%validate%';

-- 8. Check table permissions
SELECT 
    'Reports Table Permissions:' as info,
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.role_table_grants 
WHERE table_name = 'reports' 
  AND table_schema = 'public'
ORDER BY grantee, privilege_type;
