-- Fix RLS policies for consultation_meetings table
-- Run this in your Supabase SQL Editor

-- First, enable RLS if not already enabled
ALTER TABLE consultation_meetings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own meetings" ON consultation_meetings;
DROP POLICY IF EXISTS "Users can create their own meetings" ON consultation_meetings;
DROP POLICY IF EXISTS "Users can update their own meetings" ON consultation_meetings;
DROP POLICY IF EXISTS "Allow all authenticated users to read meetings" ON consultation_meetings;
DROP POLICY IF EXISTS "Allow all authenticated users to create meetings" ON consultation_meetings;
DROP POLICY IF EXISTS "Allow all authenticated users to update meetings" ON consultation_meetings;

-- Create permissive policies for authenticated users
-- Policy 1: Allow authenticated users to read all meetings
CREATE POLICY "Allow authenticated users to read meetings"
ON consultation_meetings
FOR SELECT
TO authenticated
USING (true);

-- Policy 2: Allow authenticated users to create meetings
CREATE POLICY "Allow authenticated users to create meetings"
ON consultation_meetings
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy 3: Allow authenticated users to update meetings
CREATE POLICY "Allow authenticated users to update meetings"
ON consultation_meetings
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy 4: Allow authenticated users to delete meetings (optional)
CREATE POLICY "Allow authenticated users to delete meetings"
ON consultation_meetings
FOR DELETE
TO authenticated
USING (true);

-- Verify policies are created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'consultation_meetings';

-- Test the table access
SELECT COUNT(*) FROM consultation_meetings;
