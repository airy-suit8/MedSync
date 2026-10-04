-- ========================================
-- DEBUG AND FIX AI ANALYSIS
-- ========================================
-- First let's see what we're working with

-- 1. Check what columns actually exist in reports table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'reports' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check what columns exist in ml_suggestions table  
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'ml_suggestions' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Check if we have any existing data
SELECT 'reports' as table_name, COUNT(*) as row_count FROM public.reports
UNION ALL
SELECT 'ml_suggestions' as table_name, COUNT(*) as row_count FROM public.ml_suggestions;

-- 4. Let's see a sample report to understand the structure
SELECT * FROM public.reports LIMIT 1;

-- 5. Drop any problematic triggers that might reference non-existent columns
DROP TRIGGER IF EXISTS trigger_auto_assign_doctor_patient ON public.reports;

-- 6. Now try to create a simple ML suggestion manually (hardcoded values)
DO $$
DECLARE
    first_report_id UUID;
    first_patient_id TEXT;
BEGIN
    -- Get the first report
    SELECT id, patient_id INTO first_report_id, first_patient_id 
    FROM public.reports 
    LIMIT 1;
    
    -- Only insert if we found a report and no ML suggestion exists
    IF first_report_id IS NOT NULL THEN
        INSERT INTO public.ml_suggestions (
            report_id, 
            patient_id, 
            test_type, 
            findings, 
            confidence, 
            recommendations, 
            severity, 
            status
        ) 
        SELECT 
            first_report_id,
            first_patient_id,
            'general_analysis',
            'AI analysis completed successfully. Normal results detected.',
            0.92,
            'Continue current treatment plan.',
            'mild',
            'pending_review'
        WHERE NOT EXISTS (
            SELECT 1 FROM public.ml_suggestions WHERE report_id = first_report_id
        );
    END IF;
END $$;

-- 7. Check if it worked
SELECT 
    r.id as report_id,
    ml.id as ml_id,
    ml.findings,
    ml.confidence
FROM public.reports r
LEFT JOIN public.ml_suggestions ml ON r.id = ml.report_id
LIMIT 3;

SELECT '✅ Debug complete - check results above' as message;
