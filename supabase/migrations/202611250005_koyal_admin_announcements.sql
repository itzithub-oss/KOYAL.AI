-- KOYAL AI admin announcements
create table if not exists public.koyal_admin_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 3 and 100),
  message text not null check (length(trim(message)) between 3 and 2000),
  priority text not null default 'normal' check (priority in ('normal','urgent')),
  audience_type text not null default 'all' check (audience_type in ('all','plan')),
  audience_value text null,
  scheduled_at timestamptz null,
  is_active boolean not null default true,
  created_by text not null,
  created_at timestamptz not null default now()
);
create index if not exists koyal_admin_announcements_schedule_idx
  on public.koyal_admin_announcements (is_active, scheduled_at desc, created_at desc);
alter table public.koyal_admin_announcements enable row level security;
