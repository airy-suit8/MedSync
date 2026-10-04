-- ========================================
-- FIX ALL PATIENT PROFILES NOT NULL CONSTRAINTS
-- ========================================
-- This script removes all problematic NOT NULL constraints from patient_profiles

-- 1. First, let's see what we're working with
SELECT 'Current patient_profiles structure:' as info;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'patient_profiles' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Remove NOT NULL constraints from all columns except essential ones
DO $$
DECLARE
    col_record RECORD;
BEGIN
    -- Loop through all columns with NOT NULL constraints (except essential ones)
    FOR col_record IN 
        SELECT column_name
        FROM information_schema.columns 
        WHERE table_name = 'patient_profiles' 
          AND table_schema = 'public'
          AND is_nullable = 'NO'
          AND column_name NOT IN ('id', 'created_at', 'updated_at') -- Keep these as NOT NULL
    LOOP
        BEGIN
            EXECUTE 'ALTER TABLE public.patient_profiles ALTER COLUMN ' || col_record.column_name || ' DROP NOT NULL';
            RAISE NOTICE 'Removed NOT NULL constraint from column: %', col_record.column_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not remove NOT NULL from %: %', col_record.column_name, SQLERRM;
        END;
    END LOOP;
END $$;

-- 3. Add missing columns if they don't exist (all nullable)
ALTER TABLE public.patient_profiles ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.patient_profiles ADD COLUMN IF NOT EXISTS short_id TEXT;
ALTER TABLE public.patient_profiles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.patient_profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.patient_profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.patient_profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.patient_profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE public.patient_profiles ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE public.patient_profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.patient_profiles ADD COLUMN IF NOT EXISTS emergency_contact TEXT;
ALTER TABLE public.patient_profiles ADD COLUMN IF NOT EXISTS medical_history JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.patient_profiles ADD COLUMN IF NOT EXISTS allergies TEXT[];
ALTER TABLE public.patient_profiles ADD COLUMN IF NOT EXISTS medications TEXT[];

-- 4. Clean up orphaned records and add user_id foreign key safely
DO $$
BEGIN
    -- First, remove any existing foreign key constraint that might be wrong
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'patient_profiles_user_id_fkey' 
        AND table_name = 'patient_profiles'
    ) THEN
        ALTER TABLE public.patient_profiles DROP CONSTRAINT patient_profiles_user_id_fkey;
        RAISE NOTICE 'Dropped existing foreign key constraint';
    END IF;
    
    -- Clean up orphaned records (user_id not in auth.users)
    DELETE FROM public.patient_profiles 
    WHERE user_id IS NOT NULL 
    AND NOT EXISTS (
        SELECT 1 FROM auth.users au WHERE au.id = patient_profiles.user_id
    );
    
    RAISE NOTICE 'Cleaned up orphaned patient profile records';
    
    -- Now add the foreign key constraint safely
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'patient_profiles_user_id_fkey' 
        AND table_name = 'patient_profiles'
    ) THEN
        ALTER TABLE public.patient_profiles 
        ADD CONSTRAINT patient_profiles_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added foreign key constraint to auth.users';
    END IF;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add foreign key constraint: %', SQLERRM;
    -- Continue without the foreign key if it fails
END $$;

-- 5. Create unique constraint on user_id safely
DO $$
BEGIN
    -- Remove duplicates first if any
    DELETE FROM public.patient_profiles pp1
    WHERE EXISTS (
        SELECT 1 FROM public.patient_profiles pp2
        WHERE pp2.user_id = pp1.user_id
        AND pp2.id < pp1.id
    );
    
    -- Add unique constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'patient_profiles_user_id_unique' 
        AND table_name = 'patient_profiles'
    ) THEN
        ALTER TABLE public.patient_profiles 
        ADD CONSTRAINT patient_profiles_user_id_unique UNIQUE (user_id);
    END IF;
END $$;

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS patient_profiles_user_id_idx ON public.patient_profiles(user_id);
CREATE INDEX IF NOT EXISTS patient_profiles_short_id_idx ON public.patient_profiles(short_id);

-- 7. Show the updated structure
SELECT 'Updated patient_profiles structure:' as info;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'patient_profiles' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 8. Show remaining NOT NULL constraints (should only be id, created_at, updated_at)
SELECT 'Remaining NOT NULL constraints:' as info;
SELECT 
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'patient_profiles' 
  AND table_schema = 'public'
  AND is_nullable = 'NO'
ORDER BY column_name;

SELECT 'Patient profiles constraints fix completed!' as status;
