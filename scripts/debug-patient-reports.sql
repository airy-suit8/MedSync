-- ========================================
-- DEBUG PATIENT REPORTS
-- ========================================
-- This script helps debug why patient reports aren't showing up

-- 1. Check recent reports in the system
SELECT 
    'Recent Reports:' as info,
    id,
    patient_id,
    doctor_id,
    test_type,
    uploaded_at,
    pg_typeof(patient_id) as patient_id_type,
    pg_typeof(doctor_id) as doctor_id_type,
    CASE 
        WHEN patient_id IS NULL THEN 'NULL'
        WHEN patient_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN 'Valid UUID Format'
        WHEN patient_id::text ~ '^[a-zA-Z0-9]{10}$' THEN 'Short ID Format'
        ELSE 'Invalid Format'
    END as patient_id_format
FROM public.reports
ORDER BY uploaded_at DESC
LIMIT 10;

-- 2. Check user_short_ids table for patients
SELECT 
    'Patient Short IDs:' as info,
    user_id,
    short_id,
    role,
    created_at
FROM public.user_short_ids
WHERE role = 'patient'
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check auth.users for patient accounts
SELECT 
    'Patient Auth Users:' as info,
    id,
    email,
    raw_user_meta_data
FROM auth.users
WHERE raw_user_meta_data->>'role' = 'patient'
ORDER BY created_at DESC
LIMIT 10;

-- 4. Check if there are any reports with Short ID patient_ids
SELECT 
    'Reports with Short ID patient_id:' as info,
    COUNT(*) as count
FROM public.reports
WHERE patient_id IS NOT NULL
  AND patient_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

-- 5. Show sample reports with Short ID patient_ids
SELECT 
    'Sample Reports with Short ID patient_id:' as info,
    id,
    patient_id,
    doctor_id,
    test_type,
    uploaded_at
FROM public.reports
WHERE patient_id IS NOT NULL
  AND patient_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
ORDER BY uploaded_at DESC
LIMIT 5;

-- 6. Check for orphaned reports (patient_id not in user_short_ids)
SELECT 
    'Orphaned Reports (patient_id not found):' as info,
    r.id,
    r.patient_id,
    r.test_type,
    r.uploaded_at
FROM public.reports r
LEFT JOIN public.user_short_ids usi ON r.patient_id = usi.short_id
WHERE r.patient_id IS NOT NULL
  AND r.patient_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND usi.short_id IS NULL
ORDER BY r.uploaded_at DESC
LIMIT 10;

-- 7. Check for reports with UUID patient_ids that don't exist in auth.users
SELECT 
    'Reports with UUID patient_id not in auth.users:' as info,
    r.id,
    r.patient_id,
    r.test_type,
    r.uploaded_at
FROM public.reports r
LEFT JOIN auth.users au ON r.patient_id::uuid = au.id
WHERE r.patient_id IS NOT NULL
  AND r.patient_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND au.id IS NULL
ORDER BY r.uploaded_at DESC
LIMIT 10;

-- 8. Summary of report distribution
SELECT 
    'Report Distribution Summary:' as info,
    COUNT(*) as total_reports,
    COUNT(CASE WHEN patient_id IS NOT NULL THEN 1 END) as reports_with_patient_id,
    COUNT(CASE WHEN patient_id IS NULL THEN 1 END) as reports_without_patient_id,
    COUNT(CASE WHEN patient_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN 1 END) as reports_with_uuid_patient_id,
    COUNT(CASE WHEN patient_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN 1 END) as reports_with_non_uuid_patient_id
FROM public.reports;
