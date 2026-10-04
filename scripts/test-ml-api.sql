-- ========================================
-- TEST ML API ENDPOINT
-- ========================================
-- This script helps verify that the ML processing API is working correctly

-- 1. Check if ml_suggestions table exists and has proper structure
SELECT 
    'ML Suggestions Table Structure:' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'ml_suggestions' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check if reports table has the required columns
SELECT 
    'Reports Table Structure (ML-related columns):' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'reports' 
  AND table_schema = 'public'
  AND column_name IN ('id', 'patient_id', 'doctor_id', 'result', 'updated_at')
ORDER BY column_name;

-- 3. Check if there are any existing reports that can be used for testing
SELECT 
    'Sample Reports for ML Testing:' as info,
    id,
    patient_id,
    doctor_id,
    test_type,
    uploaded_at,
    CASE 
        WHEN result IS NULL THEN 'No ML result yet'
        ELSE 'Has ML result'
    END as ml_status
FROM public.reports 
ORDER BY uploaded_at DESC 
LIMIT 5;

-- 4. Check if there are any existing ML suggestions
SELECT 
    'Existing ML Suggestions:' as info,
    id,
    report_id,
    patient_id,
    test_type,
    status,
    processed_at
FROM public.ml_suggestions 
ORDER BY processed_at DESC 
LIMIT 5;

-- 5. Check permissions for ml_suggestions table
SELECT 
    'ML Suggestions Table Permissions:' as info,
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.role_table_grants 
WHERE table_name = 'ml_suggestions' 
  AND table_schema = 'public'
ORDER BY grantee, privilege_type;

-- 6. Check if notifications table exists (for ML notifications)
SELECT 
    'Notifications Table Structure:' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'notifications' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 7. Show any recent ML processing errors or issues
SELECT 
    'Recent ML Processing Status:' as info,
    'Check server logs for any ML processing errors' as note,
    'Verify FastAPI service is running on localhost:8000' as fastapi_check,
    'Verify file uploads are working correctly' as upload_check;

-- 8. Test data for ML processing (if needed)
SELECT 
    'Test Data Summary:' as info,
    COUNT(*) as total_reports,
    COUNT(CASE WHEN result IS NULL THEN 1 END) as reports_without_ml,
    COUNT(CASE WHEN result IS NOT NULL THEN 1 END) as reports_with_ml
FROM public.reports;
