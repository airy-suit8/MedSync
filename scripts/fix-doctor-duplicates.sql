-- ========================================
-- FIX DOCTOR DUPLICATES
-- ========================================
-- This script fixes duplicate doctor records by keeping the most recent one

-- 1. First, let's see what we're working with
SELECT 
    'Current duplicate user_ids in doctors table:' as info,
    user_id,
    COUNT(*) as duplicate_count
FROM public.doctors
WHERE user_id IS NOT NULL
GROUP BY user_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 2. Create a temporary table to identify which records to keep
CREATE TEMP TABLE doctors_to_keep AS
SELECT DISTINCT ON (user_id) 
    id,
    user_id,
    name,
    email,
    specialty,
    created_at,
    updated_at
FROM public.doctors
WHERE user_id IS NOT NULL
ORDER BY user_id, created_at DESC, id DESC;

-- 3. Show which records will be kept
SELECT 
    'Records to keep (most recent per user_id):' as info,
    id,
    user_id,
    name,
    email,
    specialty,
    created_at
FROM doctors_to_keep
ORDER BY user_id;

-- 4. Delete duplicate records (keeping only the most recent one per user_id)
DELETE FROM public.doctors
WHERE id NOT IN (
    SELECT id FROM doctors_to_keep
)
AND user_id IN (
    SELECT user_id 
    FROM public.doctors 
    WHERE user_id IS NOT NULL 
    GROUP BY user_id 
    HAVING COUNT(*) > 1
);

-- 5. Verify the fix
SELECT 
    'Verification - Duplicate user_ids remaining (should be 0):' as info,
    COUNT(*) as remaining_duplicates
FROM (
    SELECT user_id
    FROM public.doctors
    WHERE user_id IS NOT NULL
    GROUP BY user_id
    HAVING COUNT(*) > 1
) duplicates;

-- 6. Show final state of doctors table
SELECT 
    'Final doctors table state:' as info,
    COUNT(*) as total_doctors,
    COUNT(DISTINCT user_id) as unique_user_ids,
    COUNT(*) - COUNT(DISTINCT user_id) as duplicate_count
FROM public.doctors
WHERE user_id IS NOT NULL;

-- 7. Show sample of remaining doctors
SELECT 
    'Sample remaining doctors:' as info,
    id,
    user_id,
    name,
    email,
    specialty,
    created_at
FROM public.doctors
WHERE user_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- 8. Clean up temporary table
DROP TABLE IF EXISTS doctors_to_keep;

SELECT 'Doctor duplicates fix completed!' as status;
