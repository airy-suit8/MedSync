-- Supabase's security advisor flags public.profile_directory as a SECURITY DEFINER view
-- (lint 0010). Running as its owner is deliberate: profiles RLS only shows a user their
-- own row, and the view hands out a few safe columns of the rows each role may list.
-- That rule now lives in a SECURITY DEFINER function, and the view is a security_invoker
-- wrapper around it, so the app keeps querying profile_directory and gets the same rows
-- and columns as the 20261021120000 view.

CREATE OR REPLACE FUNCTION public.directory_profiles()
RETURNS TABLE (
  id public.profiles.id%TYPE,
  name public.profiles.name%TYPE,
  role public.profiles.role%TYPE,
  short_id public.profiles.short_id%TYPE,
  specialty public.profiles.specialty%TYPE,
  lab_name public.profiles.lab_name%TYPE,
  online public.profiles.online%TYPE,
  last_seen public.profiles.last_seen%TYPE,
  expertise public.profiles.expertise%TYPE,
  share_before public.profiles.share_before%TYPE,
  license_number public.profiles.license_number%TYPE,
  medical_council public.profiles.medical_council%TYPE,
  qualification public.profiles.qualification%TYPE
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT p.id, p.name, p.role, p.short_id, p.specialty, p.lab_name, p.online, p.last_seen,
         p.expertise, p.share_before,
         CASE WHEN p.role IN ('doctor', 'lab') THEN p.license_number END,
         CASE WHEN p.role = 'doctor' THEN p.medical_council END,
         CASE WHEN p.role = 'doctor' THEN p.qualification END
  FROM public.profiles p
  WHERE p.id = auth.uid()
     OR (p.closed_at IS NULL AND (
           (p.role IN ('doctor', 'lab') AND p.verified)
           OR (SELECT public.is_verified_lab())
           OR (SELECT public.is_verified_doctor())));
$function$;
REVOKE EXECUTE ON FUNCTION public.directory_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.directory_profiles() TO authenticated;

CREATE OR REPLACE VIEW public.profile_directory
WITH (security_barrier = true, security_invoker = true)
AS
SELECT d.id, d.name, d.role, d.short_id, d.specialty, d.lab_name, d.online, d.last_seen,
       d.expertise, d.share_before, d.license_number, d.medical_council, d.qualification
FROM public.directory_profiles() d;

REVOKE ALL ON public.profile_directory FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.profile_directory TO authenticated;
