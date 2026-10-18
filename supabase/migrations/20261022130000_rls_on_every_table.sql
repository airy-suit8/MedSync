-- Row-level security on every table (found in the 2026-10-18 audit). The live project has
-- it on these tables (Supabase's security advisor raised nothing in the first audit), but
-- no migration turns it on, so a database built from the migrations (local Supabase, or a
-- new project) would let any signed-in user read every appointment. Turning it on again
-- changes nothing where it is already on.
--   appointments, consultation_meetings: their policies already exist.
--   The rest are legacy tables the app doesn't use; with no policies, the API can't reach
--   them, and the server and SQL editor still can.
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_call_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_call_sessions ENABLE ROW LEVEL SECURITY;
