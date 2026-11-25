-- KOYAL AI administrator security foundation.
-- Run this migration in the Supabase SQL Editor before using /admin.
create table if not exists public.koyal_admin_security (
  user_id uuid primary key references auth.users(id) on delete cascade,
  answer_hashes jsonb not null,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  configured_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.koyal_admin_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_indexes smallint[] not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists koyal_admin_challenges_user_expiry_idx
  on public.koyal_admin_challenges(user_id, expires_at desc);

create table if not exists public.koyal_admin_sessions (
  token_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists koyal_admin_sessions_user_expiry_idx
  on public.koyal_admin_sessions(user_id, expires_at desc);

create table if not exists public.koyal_admin_activity_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  admin_email text not null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists koyal_admin_activity_logs_created_idx
  on public.koyal_admin_activity_logs(created_at desc);

alter table public.koyal_admin_security enable row level security;
alter table public.koyal_admin_challenges enable row level security;
alter table public.koyal_admin_sessions enable row level security;
alter table public.koyal_admin_activity_logs enable row level security;

-- Only server-side service-role requests can access these tables.
grant select, insert, update, delete on public.koyal_admin_security to service_role;
grant select, insert, update, delete on public.koyal_admin_challenges to service_role;
grant select, insert, update, delete on public.koyal_admin_sessions to service_role;
grant select, insert on public.koyal_admin_activity_logs to service_role;
revoke update, delete on public.koyal_admin_activity_logs from service_role;

create or replace function public.prevent_koyal_admin_log_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'KOYAL admin activity logs are immutable';
end;
$$;

drop trigger if exists koyal_admin_activity_logs_immutable on public.koyal_admin_activity_logs;
create trigger koyal_admin_activity_logs_immutable
before update or delete on public.koyal_admin_activity_logs
for each row execute function public.prevent_koyal_admin_log_mutation();
