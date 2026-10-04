-- Comprehensive Fix for Duplicate Doctor Records
-- This script will clean up all duplicate doctor records and ensure data integrity

-- Step 1: Check current state
DO $$
BEGIN
    RAISE NOTICE '=== CHECKING CURRENT STATE ===';
    RAISE NOTICE 'Total doctors: %', (SELECT COUNT(*) FROM public.doctors);
    RAISE NOTICE 'Unique user_ids: %', (SELECT COUNT(DISTINCT user_id) FROM public.doctors);
    RAISE NOTICE 'Duplicate user_ids: %', (SELECT COUNT(*) - COUNT(DISTINCT user_id) FROM public.doctors);
END $$;

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
DO $$
BEGIN
    RAISE NOTICE '=== DOCTORS TO KEEP ===';
    RAISE NOTICE 'Records to keep: %', (SELECT COUNT(*) FROM temp_unique_doctors);
END $$;

-- Step 4: Delete all existing doctor records
DELETE FROM public.doctors;

-- Step 5: Re-insert only the unique, most recent records
INSERT INTO public.doctors (id, user_id, name, specialty, license_number, email, created_at, updated_at)
SELECT id, user_id, name, specialty, license_number, email, created_at, updated_at
FROM temp_unique_doctors;

-- Step 6: Verify the fix
DO $$
BEGIN
    RAISE NOTICE '=== VERIFICATION ===';
    RAISE NOTICE 'Total doctors after cleanup: %', (SELECT COUNT(*) FROM public.doctors);
    RAISE NOTICE 'Unique user_ids after cleanup: %', (SELECT COUNT(DISTINCT user_id) FROM public.doctors);
    RAISE NOTICE 'Duplicate user_ids after cleanup: %', (SELECT COUNT(*) - COUNT(DISTINCT user_id) FROM public.doctors);
    
    IF (SELECT COUNT(*) - COUNT(DISTINCT user_id) FROM public.doctors) = 0 THEN
        RAISE NOTICE '✅ SUCCESS: No duplicate user_ids found!';
    ELSE
        RAISE NOTICE '❌ WARNING: Duplicate user_ids still exist!';
    END IF;
END $$;

-- Step 7: Add constraints to prevent future duplicates
DO $$
BEGIN
    -- Add unique constraint on user_id if it doesn't exist
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
DO $$
BEGIN
    RAISE NOTICE '=== FINAL VERIFICATION ===';
    RAISE NOTICE 'Total doctors: %', (SELECT COUNT(*) FROM public.doctors);
    RAISE NOTICE 'Unique user_ids: %', (SELECT COUNT(DISTINCT user_id) FROM public.doctors);
    RAISE NOTICE 'Doctors with null user_id: %', (SELECT COUNT(*) FROM public.doctors WHERE user_id IS NULL);
    
    -- Show sample of remaining doctors
    RAISE NOTICE 'Sample of remaining doctors:';
    FOR rec IN 
        SELECT user_id, name, created_at 
        FROM public.doctors 
        ORDER BY created_at DESC 
        LIMIT 5
    LOOP
        RAISE NOTICE '  User ID: %, Name: %, Created: %', rec.user_id, rec.name, rec.created_at;
    END LOOP;
END $$;

-- Clean up temporary table
DROP TABLE temp_unique_doctors;
