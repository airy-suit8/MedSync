-- ========================================
-- USER SHORT ID SETUP
-- ========================================
-- Purpose: Assign a short, unique ID to every auth.user for privacy-friendly references
-- Run in Supabase SQL Editor once. Safe to re-run.

-- 0. Prereqs (gen_random_uuid is available in Supabase by default)

-- 1. Table to store short IDs mapped to auth.users
create table if not exists public.user_short_ids (
    user_id uuid primary key references auth.users(id) on delete cascade,
    short_id text not null unique,
    role text,
    created_at timestamptz default now()
);

-- 2. Function to generate a collision-resistant short ID (hex, length configurable)
create or replace function public.gen_short_id(len int default 10)
returns text
language plpgsql
volatile
as $$
declare
  candidate text;
begin
  loop
    candidate := substr(replace(gen_random_uuid()::text, '-', ''), 1, len);
    exit when not exists (
      select 1 from public.user_short_ids where short_id = candidate
    );
  end loop;
  return candidate;
end;
$$;

-- 3. Trigger to assign short_id on new auth.users rows
create or replace function public.handle_new_user_short_id()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.user_short_ids (user_id, short_id, role)
  values (new.id, public.gen_short_id(10), coalesce(new.raw_user_meta_data->>'role', 'unknown'))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_short_id on auth.users;
create trigger on_auth_user_created_short_id
  after insert on auth.users
  for each row execute function public.handle_new_user_short_id();

-- 4. Backfill for existing users
insert into public.user_short_ids (user_id, short_id, role)
select u.id, public.gen_short_id(10), coalesce(u.raw_user_meta_data->>'role', 'unknown')
from auth.users u
where not exists (
  select 1 from public.user_short_ids s where s.user_id = u.id
);

-- 5. Optional: expose short_id on patient_profiles if present
alter table if exists public.patient_profiles add column if not exists short_id text unique;
update public.patient_profiles p
set short_id = s.short_id
from public.user_short_ids s
where s.user_id = p.id and p.short_id is null;

-- 6. Permissions
grant select on public.user_short_ids to anon, authenticated;

-- 7. Success messages
select '🎉 USER SHORT ID SETUP COMPLETE!' as message;
select '✅ user_short_ids table ready' as status1;
select '✅ trigger to assign short_id on new users installed' as status2;
select '✅ existing users backfilled' as status3;
select '✅ patient_profiles.short_id populated (if table exists)' as status4;

