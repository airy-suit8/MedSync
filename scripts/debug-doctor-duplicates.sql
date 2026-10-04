-- ========================================
-- DEBUG DOCTOR DUPLICATES
-- ========================================
-- This script helps debug and fix duplicate doctor records

-- 1. Check for duplicate user_ids in doctors table
SELECT 
    'Duplicate user_ids in doctors table:' as info,
    user_id,
    COUNT(*) as duplicate_count
FROM public.doctors
WHERE user_id IS NOT NULL
GROUP BY user_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 2. Show all doctor records with the problematic user_id
SELECT 
    'All doctor records for user_id 841cb350-3be2-499f-a49a-f3d83251f344:' as info,
    id,
    user_id,
    name,
    specialty,
    created_at,
    updated_at
FROM public.doctors
WHERE user_id = '841cb350-3be2-499f-a49a-f3d83251f344'
ORDER BY created_at;

-- 3. Check if this user_id exists in auth.users
SELECT 
    'Auth user check for 841cb350-3be2-499f-a49a-f3d83251f344:' as info,
    id,
    email,
    raw_user_meta_data,
    created_at
FROM auth.users
WHERE id = '841cb350-3be2-499f-a49a-f3d83251f344';

-- 4. Check if this user_id exists in user_short_ids
SELECT 
    'Short ID mapping for 841cb350-3be2-499f-a49a-f3d83251f344:' as info,
    user_id,
    short_id,
    role,
    created_at
FROM public.user_short_ids
WHERE user_id = '841cb350-3be2-499f-a49a-f3d83251f344';

-- 5. Check if this user_id exists in users table
SELECT 
    'Users table check for 841cb350-3be2-499f-a49a-f3d83251f344:' as info,
    id,
    auth_id,
    name,
    email,
    role,
    created_at
FROM public.users
WHERE auth_id = '841cb350-3be2-499f-a49a-f3d83251f344'
   OR id = '841cb350-3be2-499f-a49a-f3d83251f344';

-- 6. Summary of all duplicate user_ids
SELECT 
    'Summary of all duplicate user_ids:' as info,
    COUNT(DISTINCT user_id) as unique_duplicate_user_ids,
    SUM(duplicate_count) as total_duplicate_records
FROM (
    SELECT 
        user_id,
        COUNT(*) as duplicate_count
    FROM public.doctors
    WHERE user_id IS NOT NULL
    GROUP BY user_id
    HAVING COUNT(*) > 1
) duplicates;
