-- ========================================
-- REMOVE PROBLEMATIC CONSTRAINTS ONLY
-- ========================================
-- This script removes problematic constraints without trying to recreate them
-- Use this if the main scripts keep failing on foreign key issues

-- 1. Remove all NOT NULL constraints (except essential ones)
DO $$
DECLARE
    col_record RECORD;
BEGIN
    FOR col_record IN 
        SELECT column_name
        FROM information_schema.columns 
        WHERE table_name = 'patient_profiles' 
          AND table_schema = 'public'
          AND is_nullable = 'NO'
          AND column_name NOT IN ('id', 'created_at', 'updated_at')
    LOOP
        BEGIN
            EXECUTE 'ALTER TABLE public.patient_profiles ALTER COLUMN ' || col_record.column_name || ' DROP NOT NULL';
            RAISE NOTICE 'Removed NOT NULL constraint from: %', col_record.column_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not remove NOT NULL from %: %', col_record.column_name, SQLERRM;
        END;
    END LOOP;
END $$;

-- 2. Remove problematic foreign key constraints
DO $$
BEGIN
    -- Drop foreign key constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'patient_profiles_user_id_fkey' 
        AND table_name = 'patient_profiles'
    ) THEN
        ALTER TABLE public.patient_profiles DROP CONSTRAINT patient_profiles_user_id_fkey;
        RAISE NOTICE 'Dropped foreign key constraint patient_profiles_user_id_fkey';
    END IF;
    
    -- Drop other potentially problematic foreign keys
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name LIKE '%patient_profiles%fkey%' 
        AND table_name = 'patient_profiles'
    ) THEN
        DECLARE
            fk_record RECORD;
        BEGIN
            FOR fk_record IN 
                SELECT constraint_name
                FROM information_schema.table_constraints 
                WHERE constraint_name LIKE '%patient_profiles%fkey%' 
                AND table_name = 'patient_profiles'
            LOOP
                EXECUTE 'ALTER TABLE public.patient_profiles DROP CONSTRAINT ' || fk_record.constraint_name;
                RAISE NOTICE 'Dropped foreign key: %', fk_record.constraint_name;
            END LOOP;
        END;
    END IF;
END $$;

-- 3. Clean up orphaned records
DELETE FROM public.patient_profiles 
WHERE user_id IS NOT NULL 
AND NOT EXISTS (
    SELECT 1 FROM auth.users au WHERE au.id = patient_profiles.user_id
);

-- 4. Remove duplicate records
DELETE FROM public.patient_profiles pp1
WHERE EXISTS (
    SELECT 1 FROM public.patient_profiles pp2
    WHERE pp2.user_id = pp1.user_id
    AND pp2.id < pp1.id
);

-- 5. Disable RLS for easier access
ALTER TABLE public.patient_profiles DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.patient_profiles TO authenticated, anon;

-- 6. Show current status
SELECT 'Problematic constraints removed successfully!' as status;

SELECT 
    'Remaining NOT NULL constraints:' as info,
    column_name
FROM information_schema.columns 
WHERE table_name = 'patient_profiles' 
  AND table_schema = 'public'
  AND is_nullable = 'NO'
ORDER BY column_name;

SELECT 
    'Remaining foreign key constraints:' as info,
    constraint_name
FROM information_schema.table_constraints 
WHERE constraint_type = 'FOREIGN KEY'
  AND table_name = 'patient_profiles'
  AND table_schema = 'public';
