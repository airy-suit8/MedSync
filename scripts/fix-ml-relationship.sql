-- ========================================
-- FIX ML_SUGGESTIONS RELATIONSHIP
-- ========================================
-- This script recreates the essential foreign key relationship for PostgREST

-- 1. Check current structure of both tables
SELECT 'reports columns:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'reports' AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'ml_suggestions columns:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'ml_suggestions' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Recreate the essential foreign key relationship between reports and ml_suggestions
-- This is needed for PostgREST to understand the relationship
ALTER TABLE public.ml_suggestions ADD CONSTRAINT ml_suggestions_report_id_fkey 
    FOREIGN KEY (report_id) REFERENCES public.reports(id) ON DELETE CASCADE;

-- 3. Ensure both tables have proper permissions
ALTER TABLE public.reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ml_suggestions DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.reports TO authenticated, anon;
GRANT ALL ON public.ml_suggestions TO authenticated, anon;

-- 4. Create index for better performance
CREATE INDEX IF NOT EXISTS ml_suggestions_report_id_idx ON public.ml_suggestions(report_id);

-- 5. Verify the relationship was created
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

-- 6. Success message
SELECT '✅ ML suggestions relationship restored!' as status;
SELECT 'PostgREST should now be able to join reports and ml_suggestions' as result;
