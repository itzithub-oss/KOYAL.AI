-- KOYAL AI admin system settings
create table if not exists public.koyal_admin_system_settings (
  id boolean primary key default true check (id = true),
  maintenance_mode boolean not null default false,
  maintenance_message text not null default 'KOYAL AI is temporarily under maintenance. Please try again soon.',
  feature_flags jsonb not null default '{"find_up":true,"tours_travels":true,"voice":true,"precise_mode":true,"image_creation":true}'::jsonb,
  updated_by text not null,
  updated_at timestamptz not null default now()
);
alter table public.koyal_admin_system_settings enable row level security;

-- Server-side admin routes use the Supabase service_role key.
grant all privileges on table public.koyal_admin_system_settings to service_role;
