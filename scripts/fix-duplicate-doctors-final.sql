-- Final Fix for Duplicate Doctor Records
-- This script will clean up all duplicate doctor records and ensure data integrity

-- Step 1: Check current state
SELECT '=== CHECKING CURRENT STATE ===' as status;
SELECT 
    COUNT(*) as total_doctors,
    COUNT(DISTINCT user_id) as unique_user_ids,
    COUNT(*) - COUNT(DISTINCT user_id) as duplicate_user_ids
FROM public.doctors;

-- Step 2: Create a temporary table with the most recent doctor record for each user_id
CREATE TEMP TABLE temp_unique_doctors AS
SELECT DISTINCT ON (user_id) 
    id,
    user_id,
    name,
    specialty,
    license_number,
    email,
    created_at,
    updated_at
FROM public.doctors
ORDER BY user_id, created_at DESC;

-- Step 3: Show what we're keeping
SELECT '=== DOCTORS TO KEEP ===' as status;
SELECT COUNT(*) as records_to_keep FROM temp_unique_doctors;

-- Step 4: Delete all existing doctor records
DELETE FROM public.doctors;

-- Step 5: Re-insert only the unique, most recent records
INSERT INTO public.doctors (id, user_id, name, specialty, license_number, email, created_at, updated_at)
SELECT id, user_id, name, specialty, license_number, email, created_at, updated_at
FROM temp_unique_doctors;

-- Step 6: Verify the fix
SELECT '=== VERIFICATION ===' as status;
SELECT 
    COUNT(*) as total_doctors_after_cleanup,
    COUNT(DISTINCT user_id) as unique_user_ids_after_cleanup,
    COUNT(*) - COUNT(DISTINCT user_id) as duplicate_user_ids_after_cleanup
FROM public.doctors;

-- Step 7: Add constraints to prevent future duplicates
-- Add unique constraint on user_id if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'doctors_user_id_unique' 
        AND table_name = 'doctors'
    ) THEN
        ALTER TABLE public.doctors ADD CONSTRAINT doctors_user_id_unique UNIQUE (user_id);
        RAISE NOTICE '✅ Added unique constraint on user_id';
    ELSE
        RAISE NOTICE 'ℹ️ Unique constraint on user_id already exists';
    END IF;
    
    -- Add not null constraint on user_id if it doesn't exist
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'doctors' 
        AND column_name = 'user_id' 
        AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE public.doctors ALTER COLUMN user_id SET NOT NULL;
        RAISE NOTICE '✅ Added NOT NULL constraint on user_id';
    ELSE
        RAISE NOTICE 'ℹ️ NOT NULL constraint on user_id already exists';
    END IF;
END $$;

-- Step 8: Final verification
SELECT '=== FINAL VERIFICATION ===' as status;
SELECT 
    COUNT(*) as total_doctors,
    COUNT(DISTINCT user_id) as unique_user_ids,
    COUNT(*) FILTER (WHERE user_id IS NULL) as doctors_with_null_user_id
FROM public.doctors;

-- Show sample of remaining doctors
SELECT '=== SAMPLE OF REMAINING DOCTORS ===' as status;
SELECT user_id, name, created_at 
FROM public.doctors 
ORDER BY created_at DESC 
LIMIT 5;

-- Clean up temporary table
DROP TABLE temp_unique_doctors;

-- Final success message
SELECT '✅ SUCCESS: Duplicate doctor records have been cleaned up!' as result;
