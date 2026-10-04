-- Enable Realtime for chat and ML features
BEGIN;

-- Create the publication if it doesn't exist (Supabase creates it by default, but just in case)
-- DO $$
-- BEGIN
--   IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
--     CREATE PUBLICATION supabase_realtime;
--   END IF;
-- END
-- $$;

-- Add the necessary tables to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ml_suggestions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_call_sessions;

COMMIT;
