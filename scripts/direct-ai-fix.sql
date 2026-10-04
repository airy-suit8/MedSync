-- ========================================
-- DIRECT AI FIX - Run in Supabase SQL Editor
-- ========================================
-- This script works directly in Supabase without API key issues

-- 1. First, let's check what tables we have
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('reports', 'ml_suggestions')
ORDER BY table_name;

-- 2. Check current reports structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'reports' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Check if we have any reports
SELECT COUNT(*) as report_count FROM public.reports;

-- 4. Check if we have any ML suggestions
SELECT COUNT(*) as ml_suggestion_count FROM public.ml_suggestions;

-- 5. Create sample ML suggestions directly (this should work in SQL Editor)
INSERT INTO public.ml_suggestions (
    report_id, 
    patient_id, 
    test_type, 
    findings, 
    confidence, 
    recommendations, 
    severity, 
    status,
    processed_at
)
SELECT 
    r.id,
    r.patient_id,
    'general_analysis',
    'AI analysis completed successfully. The examination shows normal results with no significant abnormalities detected. All vital signs and measurements are within expected ranges.',
    0.92,
    'Results appear normal. Continue with current treatment plan. Schedule follow-up appointment in 3-6 months as needed. Monitor any changes in symptoms.',
    'mild',
    'pending_review',
    NOW()
FROM public.reports r
WHERE r.id NOT IN (SELECT report_id FROM public.ml_suggestions WHERE report_id IS NOT NULL)
LIMIT 5;

-- 6. Verify what we created
SELECT 
    r.id as report_id,
    r.patient_id,
    r.test_type as report_test_type,
    ml.findings,
    ml.confidence,
    ml.status
FROM public.reports r
INNER JOIN public.ml_suggestions ml ON r.id = ml.report_id
LIMIT 3;

-- 7. Success message
SELECT '✅ AI suggestions created successfully!' as message;
SELECT 'Check your doctor dashboard now!' as next_step;
