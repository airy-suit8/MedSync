-- Grants and policies flagged by the 2026-10-20 audit (Supabase security advisor + an
-- anonymous probe of the live API).
--
-- 1. chat_notifications and message_threads each kept a FOR ALL USING (true) WITH CHECK (true)
--    policy from 20260926133000, and the base schema granted every privilege on them to
--    authenticated. Together that let any signed-in user read, rewrite or delete everyone's
--    rows. The app doesn't use either table; the "read own" SELECT policies stay, and no
--    one can write through the API.
-- 2. TRUNCATE ignores row-level security, and the base schema granted it (plus TRIGGER and
--    REFERENCES) on every table to anon and authenticated. The app never needs
--    them, so they go from every public table.
-- 3. lab_samples and imaging_studies picked up Supabase's default anon grants when
--    20260927120000 created them (every other table had anon revoked in 20260926070000).
--    Their policies are TO authenticated so nothing leaked, but anon gets nothing now, and
--    tables created later don't start with anon grants.

-- 1.
DROP POLICY IF EXISTS "Users can insert chat notifications" ON public.chat_notifications;
DROP POLICY IF EXISTS "Users can insert message threads" ON public.message_threads;
REVOKE ALL ON public.chat_notifications FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.message_threads FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.chat_notifications TO authenticated;
GRANT SELECT ON public.message_threads TO authenticated;

-- 2.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.%I FROM PUBLIC, anon, authenticated', t.relname);
  END LOOP;
END $$;

-- 3.
REVOKE ALL ON public.lab_samples FROM anon;
REVOKE ALL ON public.imaging_studies FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM authenticated;
