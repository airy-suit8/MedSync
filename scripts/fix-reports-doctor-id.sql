-- ========================================
-- FIX REPORTS TABLE DOCTOR_ID COLUMN
-- ========================================
-- This script fixes the doctor_id column to use UUIDs instead of Short IDs

-- 1. First, let's see what we're working with
SELECT 
    'Current Reports with Short ID doctor_id:' as info,
    COUNT(*) as count
FROM public.reports 
WHERE doctor_id IS NOT NULL 
  AND doctor_id::text ~ '^[a-zA-Z0-9]{10}$';

-- 2. Show sample reports that need fixing
SELECT 
    'Sample Reports to Fix:' as info,
    id,
    doctor_id,
    test_type,
    uploaded_at
FROM public.reports 
WHERE doctor_id IS NOT NULL 
  AND doctor_id::text ~ '^[a-zA-Z0-9]{10}$'
ORDER BY uploaded_at DESC 
LIMIT 5;

-- 3. Create a temporary function to resolve Short IDs to UUIDs
CREATE OR REPLACE FUNCTION resolve_short_id_to_uuid(short_id TEXT)
RETURNS UUID AS $$
DECLARE
    resolved_uuid UUID;
BEGIN
    SELECT user_id INTO resolved_uuid
    FROM public.user_short_ids
    WHERE short_id = $1;
    
    RETURN resolved_uuid;
END;
$$ LANGUAGE plpgsql;

-- 4. Update reports table to convert Short ID doctor_ids to UUIDs
DO $$
DECLARE
    report_record RECORD;
    resolved_uuid UUID;
    updated_count INTEGER := 0;
BEGIN
    -- Loop through all reports with Short ID doctor_ids
    FOR report_record IN 
        SELECT id, doctor_id
        FROM public.reports 
        WHERE doctor_id IS NOT NULL 
          AND doctor_id::text ~ '^[a-zA-Z0-9]{10}$'
    LOOP
        -- Resolve the Short ID to UUID
        resolved_uuid := resolve_short_id_to_uuid(report_record.doctor_id);
        
        IF resolved_uuid IS NOT NULL THEN
            -- Update the report with the resolved UUID
            UPDATE public.reports 
            SET doctor_id = resolved_uuid::TEXT
            WHERE id = report_record.id;
            
            updated_count := updated_count + 1;
            RAISE NOTICE 'Updated report %: % -> %', report_record.id, report_record.doctor_id, resolved_uuid;
        ELSE
            RAISE NOTICE 'Could not resolve Short ID % for report %', report_record.doctor_id, report_record.id;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Updated % reports with resolved UUIDs', updated_count;
END $$;

-- 5. Clean up the temporary function
DROP FUNCTION IF EXISTS resolve_short_id_to_uuid(TEXT);

-- 6. Verify the fixes
SELECT 
    'Verification - Reports with Short ID doctor_id (should be 0):' as info,
    COUNT(*) as remaining_count
FROM public.reports 
WHERE doctor_id IS NOT NULL 
  AND doctor_id::text ~ '^[a-zA-Z0-9]{10}$';

-- 7. Show updated sample data
SELECT 
    'Updated Sample Reports:' as info,
    id,
    doctor_id,
    test_type,
    uploaded_at,
    CASE 
        WHEN doctor_id IS NULL THEN 'NULL'
        WHEN pg_typeof(doctor_id) = 'uuid'::regtype THEN 'UUID Type'
        WHEN doctor_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN 'Valid UUID Format'
        ELSE 'Invalid Format'
    END as doctor_id_format
FROM public.reports 
ORDER BY uploaded_at DESC 
LIMIT 5;

-- 8. Check if there are any foreign key constraints that might need updating
SELECT 
    'Foreign Key Constraints on reports.doctor_id:' as info,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'reports'
  AND kcu.column_name = 'doctor_id';

SELECT 'Reports table doctor_id column fix completed!' as status;
