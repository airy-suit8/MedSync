BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

-- Tests for 20261023120000_lock_down_open_grants.sql.
SELECT plan(8);

SELECT is((SELECT count(*)::int FROM pg_policies
           WHERE schemaname = 'public' AND tablename IN ('chat_notifications', 'message_threads')
             AND cmd <> 'SELECT'),
  0, 'the legacy chat tables have no write policies');

SELECT ok(NOT has_table_privilege('authenticated', 'public.chat_notifications', 'INSERT,UPDATE,DELETE'),
  'signed-in users cannot write chat_notifications');
SELECT ok(NOT has_table_privilege('authenticated', 'public.message_threads', 'INSERT,UPDATE,DELETE'),
  'signed-in users cannot write message_threads');
SELECT ok(has_table_privilege('authenticated', 'public.message_threads', 'SELECT'),
  'signed-in users can still read their own threads (through the SELECT policy)');

SELECT is((SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
             AND (has_table_privilege('anon', c.oid, 'TRUNCATE') OR has_table_privilege('authenticated', c.oid, 'TRUNCATE'))),
  0, 'no API role can TRUNCATE a public table (TRUNCATE skips row-level security)');

SELECT ok(NOT has_table_privilege('anon', 'public.lab_samples', 'SELECT,INSERT,UPDATE,DELETE'),
  'anon has nothing on lab_samples');
SELECT ok(NOT has_table_privilege('anon', 'public.imaging_studies', 'SELECT,INSERT,UPDATE,DELETE'),
  'anon has nothing on imaging_studies');

-- A table created later starts with no anon grants.
CREATE TABLE public.zz_default_grant_probe (id int);
SELECT ok(NOT has_table_privilege('anon', 'public.zz_default_grant_probe', 'SELECT'),
  'new tables do not start with anon grants');

SELECT * FROM finish();
ROLLBACK;
