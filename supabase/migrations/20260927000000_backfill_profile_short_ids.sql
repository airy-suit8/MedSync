-- Ensure existing Auth users have profiles, then assign stable short IDs to
-- profiles created before the current auth trigger populated profiles.short_id.
DO $$
DECLARE
  auth_user RECORD;
  profile_row RECORD;
  candidate TEXT;
BEGIN
  FOR auth_user IN
    SELECT u.id, u.email, u.raw_user_meta_data
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE p.id IS NULL
  LOOP
    LOOP
      candidate := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE short_id = candidate
      );
    END LOOP;

    INSERT INTO public.profiles (id, email, name, role, short_id)
    VALUES (
      auth_user.id,
      auth_user.email,
      coalesce(auth_user.raw_user_meta_data->>'name', 'Unknown User'),
      CASE
        WHEN auth_user.raw_user_meta_data->>'role' IN ('patient', 'doctor', 'lab', 'admin')
          THEN auth_user.raw_user_meta_data->>'role'
        ELSE 'patient'
      END,
      candidate
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  FOR profile_row IN
    SELECT id
    FROM public.profiles
    WHERE short_id IS NULL
  LOOP
    LOOP
      candidate := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE short_id = candidate
      );
    END LOOP;

    UPDATE public.profiles
    SET short_id = candidate,
        updated_at = now()
    WHERE id = profile_row.id
      AND short_id IS NULL;
  END LOOP;
END;
$$;
