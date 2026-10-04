-- ========================================
-- FIX PATIENT REPORTS
-- ========================================
-- This script fixes reports that have Short ID patient_ids by converting them to UUIDs

-- 1. First, let's see what we're working with
SELECT 
    'Current Reports with Short ID patient_id:' as info,
    COUNT(*) as count
FROM public.reports
WHERE patient_id IS NOT NULL
  AND patient_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

-- 2. Show sample reports that need fixing
SELECT 
    'Sample Reports to Fix:' as info,
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

-- 3. Create a function to resolve Short ID to UUID
CREATE OR REPLACE FUNCTION resolve_patient_short_id_to_uuid(input_short_id TEXT)
RETURNS UUID AS $$
DECLARE
    resolved_uuid UUID;
BEGIN
    SELECT user_id INTO resolved_uuid
    FROM public.user_short_ids
    WHERE short_id = input_short_id
      AND role = 'patient';
    
    RETURN resolved_uuid;
END;
$$ LANGUAGE plpgsql;

-- 4. Update reports table to convert Short ID patient_ids to UUIDs
DO $$
DECLARE
    report_record RECORD;
    resolved_uuid UUID;
    updated_count INTEGER := 0;
BEGIN
    -- Loop through all reports with Short ID patient_ids
    FOR report_record IN 
        SELECT id, patient_id
        FROM public.reports 
        WHERE patient_id IS NOT NULL 
          AND patient_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    LOOP
        -- Resolve the Short ID to UUID
        resolved_uuid := resolve_patient_short_id_to_uuid(report_record.patient_id);
        
        IF resolved_uuid IS NOT NULL THEN
            -- Update the report with the resolved UUID
            UPDATE public.reports 
            SET patient_id = resolved_uuid
            WHERE id = report_record.id;
            
            updated_count := updated_count + 1;
            RAISE NOTICE 'Updated report %: % -> %', report_record.id, report_record.patient_id, resolved_uuid;
        ELSE
            RAISE NOTICE 'Could not resolve Short ID % for report %', report_record.patient_id, report_record.id;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Updated % reports with resolved UUIDs', updated_count;
END $$;

-- 5. Clean up the temporary function
DROP FUNCTION IF EXISTS resolve_patient_short_id_to_uuid(TEXT);

-- 6. Verify the fixes
SELECT 
    'Verification - Reports with Short ID patient_id (should be 0):' as info,
    COUNT(*) as remaining_count
FROM public.reports
WHERE patient_id IS NOT NULL
  AND patient_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

-- 7. Show updated sample data
SELECT 
    'Updated Sample Reports:' as info,
    id,
    patient_id,
    doctor_id,
    test_type,
    uploaded_at,
    CASE 
        WHEN patient_id IS NULL THEN 'NULL'
        WHEN patient_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN 'Valid UUID Format'
        ELSE 'Invalid Format'
    END as patient_id_format
FROM public.reports
ORDER BY uploaded_at DESC
LIMIT 5;

-- 8. Check if there are any orphaned reports (patient_id not in auth.users)
SELECT 
    'Orphaned Reports (patient_id not in auth.users):' as info,
    COUNT(*) as count
FROM public.reports r
LEFT JOIN auth.users au ON r.patient_id::uuid = au.id
WHERE r.patient_id IS NOT NULL
  AND au.id IS NULL;

SELECT 'Patient reports fix completed!' as status;
