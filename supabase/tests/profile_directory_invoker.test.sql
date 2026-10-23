BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

-- Tests for 20261023130000_profile_directory_invoker.sql. Who sees which directory rows is
-- covered by rls_policies, security_fixes, lab_verification and account_closure.
SELECT plan(3);

SELECT ok((SELECT 'security_invoker=true' = ANY (c.reloptions) FROM pg_class c
           WHERE c.oid = 'public.profile_directory'::regclass),
  'profile_directory runs as the querying user (advisor lint 0010)');
SELECT ok(NOT has_function_privilege('anon', 'public.directory_profiles()', 'EXECUTE'),
  'anon cannot call directory_profiles');
SELECT ok(NOT has_table_privilege('anon', 'public.profile_directory', 'SELECT'),
  'anon cannot read profile_directory');

SELECT * FROM finish();
ROLLBACK;
