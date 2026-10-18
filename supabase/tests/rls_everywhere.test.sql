BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

-- Every table in public has row-level security (20261022130000_rls_on_every_table.sql).
-- A new table without it fails here, naming the table.
SELECT plan(1);

SELECT is(
  (SELECT array_agg(c.relname::text ORDER BY c.relname)
   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity),
  NULL,
  'every table in public has row-level security');

SELECT * FROM finish();
ROLLBACK;
