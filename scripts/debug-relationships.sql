-- ========================================
-- DEBUG RELATIONSHIPS AND FORCE REFRESH
-- ========================================
-- This script debugs why the relationship isn't working

-- 1. Check if the foreign key constraint actually exists
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_schema = 'public'
AND (tc.table_name = 'ml_suggestions' OR tc.table_name = 'reports')
ORDER BY tc.table_name, tc.constraint_name;

-- 2. Check if both tables exist and have the right columns
SELECT 'reports table structure:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'reports' AND table_schema = 'public'
AND column_name IN ('id', 'report_id')
ORDER BY column_name;

SELECT 'ml_suggestions table structure:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'ml_suggestions' AND table_schema = 'public'
AND column_name IN ('id', 'report_id')
ORDER BY column_name;

-- 3. Drop any existing constraint and recreate it with explicit naming
ALTER TABLE public.ml_suggestions DROP CONSTRAINT IF EXISTS ml_suggestions_report_id_fkey;
ALTER TABLE public.ml_suggestions DROP CONSTRAINT IF EXISTS fk_ml_suggestions_report_id;

-- 4. Recreate the constraint with explicit CASCADE options
ALTER TABLE public.ml_suggestions 
ADD CONSTRAINT fk_ml_suggestions_report_id 
FOREIGN KEY (report_id) REFERENCES public.reports(id) 
ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Create additional index for performance
DROP INDEX IF EXISTS idx_ml_suggestions_report_id;
CREATE INDEX idx_ml_suggestions_report_id ON public.ml_suggestions(report_id);

-- 6. Force PostgREST schema cache refresh by updating table comment
COMMENT ON TABLE public.ml_suggestions IS 'ML suggestions table - relationship updated';
COMMENT ON TABLE public.reports IS 'Reports table - relationship updated';

-- 7. Verify the constraint exists now
SELECT 'Foreign key constraints after recreation:' as info;
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name = 'ml_suggestions'
AND tc.table_schema = 'public';

-- 8. Success message
SELECT '✅ Relationship debugging complete!' as status;
SELECT 'Foreign key constraint should now be properly defined' as result;
SELECT 'Wait 30-60 seconds for PostgREST schema cache to refresh' as important_note;
