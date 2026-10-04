-- ========================================
-- QUICK DOCTOR CHECK
-- ========================================
-- This script quickly checks the current state of doctor records

-- 1. Check total doctors
SELECT 
    'Total doctors in table:' as info,
    COUNT(*) as total_doctors
FROM public.doctors;

-- 2. Check for duplicates
SELECT 
    'Duplicate user_ids:' as info,
    user_id,
    COUNT(*) as count
FROM public.doctors
WHERE user_id IS NOT NULL
GROUP BY user_id
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- 3. Check for null user_ids
SELECT 
    'Doctors with null user_id:' as info,
    COUNT(*) as count
FROM public.doctors
WHERE user_id IS NULL;

-- 4. Show sample doctors
SELECT 
    'Sample doctors:' as info,
    id,
    user_id,
    name,
    specialty,
    created_at
FROM public.doctors
ORDER BY created_at DESC
LIMIT 5;

-- 5. Check if specific user_id exists
SELECT 
    'Checking for user_id 841cb350-3be2-499f-a49a-f3d83251f344:' as info,
    id,
    user_id,
    name,
    specialty,
    created_at
FROM public.doctors
WHERE user_id = '841cb350-3be2-499f-a49a-f3d83251f344'
ORDER BY created_at DESC;
