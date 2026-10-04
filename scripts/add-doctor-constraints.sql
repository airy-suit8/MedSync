-- ========================================
-- ADD DOCTOR CONSTRAINTS
-- ========================================
-- This script adds constraints to prevent duplicate doctor records

-- 1. Add unique constraint on user_id to prevent duplicates
-- Note: This will fail if duplicates already exist, so run the fix script first
ALTER TABLE public.doctors 
ADD CONSTRAINT doctors_user_id_unique UNIQUE (user_id);

-- 2. Add not null constraint on user_id if it doesn't exist
ALTER TABLE public.doctors 
ALTER COLUMN user_id SET NOT NULL;

-- 3. Add foreign key constraint to auth.users if it doesn't exist
-- This ensures referential integrity
ALTER TABLE public.doctors 
ADD CONSTRAINT doctors_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 4. Verify constraints
SELECT 
    'Doctor table constraints:' as info,
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.doctors'::regclass
ORDER BY conname;

-- 5. Test constraint by trying to insert a duplicate (should fail)
-- Uncomment the lines below to test the constraint
/*
INSERT INTO public.doctors (user_id, name, email, specialty)
VALUES ('841cb350-3be2-499f-a49a-f3d83251f344', 'Test Doctor', 'test@example.com', 'General');
*/

SELECT 'Doctor constraints added successfully!' as status;
