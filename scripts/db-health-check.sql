-- ============================================================
-- MedSync Database Health Check
-- ============================================================
-- Run in Supabase SQL editor to validate core data integrity.
-- This script is read-only (no writes).

-- 1) Users without auth linkage (critical)
SELECT
  'users_missing_auth_id' AS check_name,
  COUNT(*) AS issue_count
FROM public.users
WHERE auth_id IS NULL;

-- 2) Auth users missing public.users row
SELECT
  'auth_users_missing_public_users' AS check_name,
  COUNT(*) AS issue_count
FROM auth.users a
LEFT JOIN public.users u ON u.auth_id = a.id
WHERE u.auth_id IS NULL;

-- 3) Patients role users missing patients table row
SELECT
  'patient_role_missing_patients_row' AS check_name,
  COUNT(*) AS issue_count
FROM public.users u
LEFT JOIN public.patients p ON p.user_id = u.auth_id
WHERE u.role = 'patient'
  AND u.auth_id IS NOT NULL
  AND p.user_id IS NULL;

-- 4) Doctors role users missing doctors table row
SELECT
  'doctor_role_missing_doctors_row' AS check_name,
  COUNT(*) AS issue_count
FROM public.users u
LEFT JOIN public.doctors d ON d.user_id = u.auth_id
WHERE u.role = 'doctor'
  AND u.auth_id IS NOT NULL
  AND d.user_id IS NULL;

-- 5) Labs role users missing labs table row
SELECT
  'lab_role_missing_labs_row' AS check_name,
  COUNT(*) AS issue_count
FROM public.users u
LEFT JOIN public.labs l ON l.user_id = u.auth_id
WHERE u.role = 'lab'
  AND u.auth_id IS NOT NULL
  AND l.user_id IS NULL;

-- 6) Auth users missing short IDs
SELECT
  'auth_users_missing_short_id' AS check_name,
  COUNT(*) AS issue_count
FROM auth.users a
LEFT JOIN public.user_short_ids s ON s.user_id = a.id
WHERE s.user_id IS NULL;

-- 7) Patients missing from patient_profiles_unified (what broke schedule lookups)
SELECT
  'patient_role_missing_patient_profiles_unified' AS check_name,
  COUNT(*) AS issue_count
FROM public.users u
LEFT JOIN public.patient_profiles_unified ppu ON ppu.user_id = u.auth_id
WHERE u.role = 'patient'
  AND u.auth_id IS NOT NULL
  AND ppu.user_id IS NULL;

-- 8) Appointments with patient_id that cannot map to any known user identity
-- (This catches mixed UUID types and stale references.)
SELECT
  'appointments_orphan_patient_reference' AS check_name,
  COUNT(*) AS issue_count
FROM public.appointments a
LEFT JOIN auth.users au ON au.id::text = a.patient_id::text
LEFT JOIN public.users pu ON pu.id::text = a.patient_id::text OR pu.auth_id::text = a.patient_id::text
LEFT JOIN public.user_short_ids usi ON usi.short_id = a.patient_id::text
WHERE au.id IS NULL
  AND pu.id IS NULL
  AND usi.user_id IS NULL;

-- 9) Trigger presence check on auth.users
SELECT
  'auth_users_triggers_present' AS check_name,
  COUNT(*) AS trigger_count
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass
  AND NOT tgisinternal;

-- 10) Quick detail samples for debugging (top 20)
SELECT
  u.id,
  u.auth_id,
  u.email,
  u.role,
  u.created_at
FROM public.users u
WHERE u.auth_id IS NULL
ORDER BY u.created_at DESC
LIMIT 20;
