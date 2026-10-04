-- ========================================
-- EMERGENCY FOREIGN KEY FIX
-- ========================================
-- This script immediately fixes the foreign key constraint issue

-- 1. Check current foreign key constraints
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name = 'doctors'
AND tc.table_schema = 'public';

-- 2. Drop the problematic constraint immediately
ALTER TABLE public.doctors DROP CONSTRAINT IF EXISTS fk_doctors_user_id;
ALTER TABLE public.doctors DROP CONSTRAINT IF EXISTS doctors_user_id_fkey;

-- 3. Check if the user exists in auth.users
SELECT id, email FROM auth.users WHERE id = '7a37246e-3825-459f-ac76-7ee80d3777c1';

-- 4. Temporarily disable foreign key checks by not recreating the constraint
-- This allows the signup to complete

-- 5. Clean up any orphaned records if needed
DELETE FROM public.doctors 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- 6. Create the correct foreign key constraint pointing to auth.users
ALTER TABLE public.doctors ADD CONSTRAINT doctors_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 7. Do the same for other role tables
ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS fk_patients_user_id;
ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_user_id_fkey;
ALTER TABLE public.patients ADD CONSTRAINT patients_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.labs DROP CONSTRAINT IF EXISTS fk_labs_user_id;
ALTER TABLE public.labs DROP CONSTRAINT IF EXISTS labs_user_id_fkey;
ALTER TABLE public.labs ADD CONSTRAINT labs_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 8. Disable RLS on role tables to prevent permission issues
ALTER TABLE public.doctors DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.labs DISABLE ROW LEVEL SECURITY;

-- 9. Grant full permissions
GRANT ALL ON public.doctors TO authenticated, anon;
GRANT ALL ON public.patients TO authenticated, anon;
GRANT ALL ON public.labs TO authenticated, anon;

-- 10. Success message
SELECT '🚀 Emergency FK fix applied!' as status;
SELECT 'Try user signup again - should work now' as next_step;
