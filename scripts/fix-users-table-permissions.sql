-- ========================================
-- FIX USERS TABLE PERMISSIONS
-- ========================================
-- This script fixes the permission denied error for the users table
-- Run this in your Supabase SQL Editor

-- 1. First, let's check if the users table exists in public schema
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
    ) THEN
        -- Create the users table if it doesn't exist
        CREATE TABLE public.users (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('doctor', 'patient', 'lab', 'admin')),
            specialty TEXT,
            online BOOLEAN DEFAULT false,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        RAISE NOTICE 'Created users table in public schema';
    ELSE
        RAISE NOTICE 'Users table already exists in public schema';
    END IF;
END $$;

-- 2. Disable RLS on the users table to allow all authenticated users to access it
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- 3. Grant all permissions to authenticated users
GRANT ALL ON public.users TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- 4. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_online ON public.users(online);

-- 5. Create a trigger to automatically create user records when auth.users are created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (auth_id, name, email, role, specialty)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'role', 'patient'),
        NEW.raw_user_meta_data->>'specialty'
    )
    ON CONFLICT (auth_id) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        specialty = EXCLUDED.specialty,
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create the trigger if it doesn't exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Backfill existing auth.users into the public.users table
INSERT INTO public.users (auth_id, name, email, role, specialty)
SELECT 
    id,
    COALESCE(raw_user_meta_data->>'name', email),
    email,
    COALESCE(raw_user_meta_data->>'role', 'patient'),
    raw_user_meta_data->>'specialty'
FROM auth.users
WHERE NOT EXISTS (
    SELECT 1 FROM public.users WHERE auth_id = auth.users.id
);

-- 8. Create a function to get user by auth ID
CREATE OR REPLACE FUNCTION public.get_user_by_auth_id(auth_uuid UUID)
RETURNS TABLE (
    id UUID,
    auth_id UUID,
    name TEXT,
    email TEXT,
    role TEXT,
    specialty TEXT,
    online BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.auth_id,
        u.name,
        u.email,
        u.role,
        u.specialty,
        u.online,
        u.created_at,
        u.updated_at
    FROM public.users u
    WHERE u.auth_id = auth_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Create a function to update user online status
CREATE OR REPLACE FUNCTION public.update_user_online_status(auth_uuid UUID, is_online BOOLEAN)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.users 
    SET online = is_online, updated_at = NOW()
    WHERE auth_id = auth_uuid;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Create a function to get users by role
CREATE OR REPLACE FUNCTION public.get_users_by_role(user_role TEXT)
RETURNS TABLE (
    id UUID,
    auth_id UUID,
    name TEXT,
    email TEXT,
    role TEXT,
    specialty TEXT,
    online BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.auth_id,
        u.name,
        u.email,
        u.role,
        u.specialty,
        u.online,
        u.created_at,
        u.updated_at
    FROM public.users u
    WHERE u.role = user_role
    ORDER BY u.online DESC, u.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.get_user_by_auth_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_online_status(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_users_by_role(TEXT) TO authenticated;

-- 12. Create some demo users if the table is empty
DO $$
BEGIN
    IF (SELECT COUNT(*) FROM public.users) = 0 THEN
        -- Insert demo users
        INSERT INTO public.users (auth_id, name, email, role, specialty, online) VALUES
        ('11111111-1111-1111-1111-111111111111', 'Dr. Sarah Smith', 'dr.sarah@example.com', 'doctor', 'Cardiologist', true),
        ('22222222-2222-2222-2222-222222222222', 'Dr. Michael Johnson', 'dr.michael@example.com', 'doctor', 'General Physician', true),
        ('33333333-3333-3333-3333-333333333333', 'Dr. Emily Chen', 'dr.emily@example.com', 'doctor', 'Dermatologist', false),
        ('44444444-4444-4444-4444-444444444444', 'Lab Tech Alex Chen', 'alex.lab@example.com', 'lab', 'Clinical Laboratory', true),
        ('55555555-5555-5555-5555-555555555555', 'Lab Tech Maria Garcia', 'maria.lab@example.com', 'lab', 'Radiology', true),
        ('66666666-6666-6666-6666-666666666666', 'John Patient', 'john.patient@example.com', 'patient', 'General', true),
        ('77777777-7777-7777-7777-777777777777', 'Mary Wilson', 'mary.patient@example.com', 'patient', 'General', false);
        
        RAISE NOTICE 'Inserted demo users';
    ELSE
        RAISE NOTICE 'Users table already has data, skipping demo insert';
    END IF;
END $$;

-- 13. Verify the fix
SELECT 
    '✅ Users Table Permissions Fixed Successfully' as status,
    (SELECT COUNT(*) FROM public.users) as total_users,
    (SELECT COUNT(*) FROM public.users WHERE role = 'doctor') as doctors,
    (SELECT COUNT(*) FROM public.users WHERE role = 'patient') as patients,
    (SELECT COUNT(*) FROM public.users WHERE role = 'lab') as lab_techs,
    (SELECT COUNT(*) FROM public.users WHERE online = true) as online_users;

-- 14. Show table permissions
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'users' AND schemaname = 'public';

-- 15. Show function permissions
SELECT 
    routine_name,
    routine_type,
    security_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%user%';
