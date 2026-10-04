-- ========================================
-- DEBUG PATIENT PROFILES TABLE STRUCTURE
-- ========================================
-- This script helps understand the current database structure

-- 1. Show the complete structure of patient_profiles table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'patient_profiles' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Show all constraints on patient_profiles table
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    tc.is_deferrable,
    tc.initially_deferred
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.table_name = 'patient_profiles'
  AND tc.table_schema = 'public'
ORDER BY tc.constraint_type, kcu.column_name;

-- 3. Show current data in patient_profiles table (first 5 rows)
SELECT 
    id,
    user_id,
    short_id,
    name,
    full_name,
    email,
    date_of_birth,
    gender,
    created_at
FROM public.patient_profiles 
LIMIT 5;

-- 4. Count current records
SELECT 
    'Total patient profiles: ' || COUNT(*) as record_count
FROM public.patient_profiles;

-- 5. Show user_short_ids for patients
SELECT 
    usi.user_id,
    usi.short_id,
    usi.role,
    au.email,
    au.raw_user_meta_data->>'name' as user_name
FROM public.user_short_ids usi
LEFT JOIN auth.users au ON usi.user_id = au.id
WHERE usi.role = 'patient'
LIMIT 5;

-- 6. Check if there are any NOT NULL constraints that need to be removed
SELECT 
    'Columns with NOT NULL constraints:' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'patient_profiles' 
  AND table_schema = 'public'
  AND is_nullable = 'NO'
  AND column_name NOT IN ('id', 'created_at', 'updated_at') -- Exclude expected NOT NULL columns
ORDER BY column_name;

-- 7. Show any existing patient profiles that might conflict
SELECT 
    'Existing profiles that might need updating:' as info,
    pp.id,
    pp.user_id,
    pp.short_id,
    pp.name,
    pp.full_name,
    pp.date_of_birth,
    CASE 
        WHEN pp.date_of_birth IS NULL THEN 'NULL date_of_birth'
        WHEN pp.full_name IS NULL THEN 'NULL full_name'  
        WHEN pp.name IS NULL THEN 'NULL name'
        ELSE 'OK'
    END as status
FROM public.patient_profiles pp
LIMIT 10;
