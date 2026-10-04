-- ========================================================
-- PHASE 0: SECURITY LOCKDOWN
-- ========================================================
-- Run this in Supabase SQL Editor IMMEDIATELY.
-- This script:
--   1. Revokes dangerous anon grants
--   2. Enables RLS on all core tables
--   3. Creates basic access policies
--   4. Makes the reports storage bucket private
-- ========================================================

-- --------------------------------------------------------
-- 1. REVOKE DANGEROUS GRANTS
-- --------------------------------------------------------
-- Remove ALL privileges from the anon (unauthenticated) role.
-- Only authenticated users should touch medical data.

REVOKE ALL ON public.reports FROM anon;
REVOKE ALL ON public.ml_suggestions FROM anon;
REVOKE ALL ON public.notifications FROM anon;

-- Also revoke on any other tables that may have been granted too broadly
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'appointments' AND table_schema = 'public') THEN
    REVOKE ALL ON public.appointments FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') THEN
    REVOKE ALL ON public.users FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'doctors' AND table_schema = 'public') THEN
    REVOKE ALL ON public.doctors FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'patients' AND table_schema = 'public') THEN
    REVOKE ALL ON public.patients FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'doctor_patient_assignments' AND table_schema = 'public') THEN
    REVOKE ALL ON public.doctor_patient_assignments FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages' AND table_schema = 'public') THEN
    REVOKE ALL ON public.messages FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'typing_status' AND table_schema = 'public') THEN
    REVOKE ALL ON public.typing_status FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_notifications' AND table_schema = 'public') THEN
    REVOKE ALL ON public.chat_notifications FROM anon;
  END IF;
END $$;

-- Keep SELECT on user_short_ids for authenticated users (needed for ID resolution)
REVOKE ALL ON public.user_short_ids FROM anon;
GRANT SELECT ON public.user_short_ids TO authenticated;

-- --------------------------------------------------------
-- 2. ENABLE RLS ON ALL CORE TABLES
-- --------------------------------------------------------

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ml_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'appointments' AND table_schema = 'public') THEN
    ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') THEN
    ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages' AND table_schema = 'public') THEN
    ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'doctor_patient_assignments' AND table_schema = 'public') THEN
    ALTER TABLE public.doctor_patient_assignments ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- --------------------------------------------------------
-- 3. CREATE BASIC RLS POLICIES
-- --------------------------------------------------------
-- These are Phase 0 "minimum viable" policies.
-- Phase 1 will add fine-grained per-role policies.
-- For now: authenticated users can read their own rows;
-- service_role (used by API routes) bypasses RLS automatically.

-- --- reports ---
-- Drop any existing policies first to avoid conflicts
DROP POLICY IF EXISTS "authenticated_read_reports" ON public.reports;
DROP POLICY IF EXISTS "authenticated_insert_reports" ON public.reports;
DROP POLICY IF EXISTS "authenticated_update_reports" ON public.reports;

-- Patients can read reports where they are the patient
-- Doctors/labs handled via service_role in API routes for now
CREATE POLICY "authenticated_read_reports" ON public.reports
  FOR SELECT TO authenticated
  USING (
    -- Patient can see their own reports (patient_id matches auth UUID or short_id)
    patient_id = auth.uid()::text
    OR patient_id IN (
      SELECT short_id FROM public.user_short_ids WHERE user_id = auth.uid()
    )
    -- Doctor who is assigned to the report
    OR doctor_id = auth.uid()
    -- Uploader can see what they uploaded
    OR uploaded_by = auth.uid()
  );

CREATE POLICY "authenticated_insert_reports" ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (true);  -- Inserts go through API routes with service_role; this is a fallback

CREATE POLICY "authenticated_update_reports" ON public.reports
  FOR UPDATE TO authenticated
  USING (
    doctor_id = auth.uid()
    OR uploaded_by = auth.uid()
  );

-- --- ml_suggestions ---
DROP POLICY IF EXISTS "authenticated_read_ml_suggestions" ON public.ml_suggestions;
CREATE POLICY "authenticated_read_ml_suggestions" ON public.ml_suggestions
  FOR SELECT TO authenticated
  USING (
    patient_id = auth.uid()::text
    OR patient_id IN (
      SELECT short_id FROM public.user_short_ids WHERE user_id = auth.uid()
    )
    OR reviewed_by = auth.uid()
    OR report_id IN (
      SELECT id FROM public.reports WHERE doctor_id = auth.uid()
    )
  );

-- --- notifications ---
DROP POLICY IF EXISTS "authenticated_read_notifications" ON public.notifications;
DROP POLICY IF EXISTS "authenticated_insert_notifications" ON public.notifications;

CREATE POLICY "authenticated_read_notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "authenticated_insert_notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);  -- Inserts go through service_role API routes

-- --- appointments (if exists) ---
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'appointments' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "authenticated_read_appointments" ON public.appointments;
    CREATE POLICY "authenticated_read_appointments" ON public.appointments
      FOR SELECT TO authenticated
      USING (
        doctor_id = auth.uid()
        OR patient_id = auth.uid()
      );

    DROP POLICY IF EXISTS "authenticated_insert_appointments" ON public.appointments;
    CREATE POLICY "authenticated_insert_appointments" ON public.appointments
      FOR INSERT TO authenticated
      WITH CHECK (
        doctor_id = auth.uid()
        OR patient_id = auth.uid()
      );

    DROP POLICY IF EXISTS "authenticated_update_appointments" ON public.appointments;
    CREATE POLICY "authenticated_update_appointments" ON public.appointments
      FOR UPDATE TO authenticated
      USING (
        doctor_id = auth.uid()
        OR patient_id = auth.uid()
      );
  END IF;
END $$;

-- --- users (if exists) ---
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "users_read_own" ON public.users;
    CREATE POLICY "users_read_own" ON public.users
      FOR SELECT TO authenticated
      USING (auth_id = auth.uid());

    -- Allow doctors/labs to read basic info of other users (for patient lookup)
    DROP POLICY IF EXISTS "users_read_all_authenticated" ON public.users;
    CREATE POLICY "users_read_all_authenticated" ON public.users
      FOR SELECT TO authenticated
      USING (true);  -- TODO Phase 1: restrict to assigned relationships only
  END IF;
END $$;

-- --- messages (if exists) ---
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "messages_own" ON public.messages;
    CREATE POLICY "messages_own" ON public.messages
      FOR ALL TO authenticated
      USING (
        sender_id = auth.uid()::text
        OR receiver_id = auth.uid()::text
      );
  END IF;
END $$;

-- --- doctor_patient_assignments (if exists) ---
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'doctor_patient_assignments' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "dpa_read" ON public.doctor_patient_assignments;
    CREATE POLICY "dpa_read" ON public.doctor_patient_assignments
      FOR SELECT TO authenticated
      USING (
        doctor_id = auth.uid()
        OR patient_id = auth.uid()
      );
  END IF;
END $$;

-- --------------------------------------------------------
-- 4. LOCK DOWN STORAGE BUCKET
-- --------------------------------------------------------
-- Make the reports bucket private (no public URL access)
UPDATE storage.buckets
SET public = false
WHERE id = 'reports';

-- Drop overly permissive storage policies and recreate secure ones
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read files" ON storage.objects;
DROP POLICY IF EXISTS "File owners can update files" ON storage.objects;
DROP POLICY IF EXISTS "File owners can delete files" ON storage.objects;

-- Only authenticated users can upload to the reports bucket
CREATE POLICY "auth_upload_reports" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'reports');

-- Only authenticated users can read from the reports bucket
-- (further access control happens in the API route that generates signed URLs)
CREATE POLICY "auth_read_reports" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'reports');

-- Only the uploader can update or delete their files
CREATE POLICY "owner_update_reports" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'reports'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "owner_delete_reports" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'reports'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- --------------------------------------------------------
-- 5. VERIFICATION QUERIES
-- --------------------------------------------------------
SELECT 'Phase 0 Security Lockdown Applied' AS status;

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('reports', 'ml_suggestions', 'notifications', 'appointments', 'users', 'messages', 'doctor_patient_assignments')
ORDER BY tablename;

-- Check anon grants are revoked
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'anon'
AND table_schema = 'public'
ORDER BY table_name;

-- Check bucket is private
SELECT id, name, public FROM storage.buckets WHERE id = 'reports';
