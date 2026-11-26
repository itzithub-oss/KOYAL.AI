create table if not exists public.koyal_partner_directory (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  description text not null default '',
  location text not null,
  starting_price text,
  contact_name text,
  operator_name text,
  phone text,
  email text,
  website text,
  professional_name text,
  qualifications text[] not null default '{}',
  experience text,
  services text[] not null default '{}',
  service_hours text,
  status text not null default 'active' check (status in ('active','inactive','pending','rejected')),
  source text not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists koyal_partner_directory_status_idx
  on public.koyal_partner_directory (status, created_at desc);

alter table public.koyal_partner_directory enable row level security;

-- Server routes use the service-role key; no client-side table access is granted.
grant all privileges on table public.koyal_partner_directory to service_role;

-- Seed the existing verified directory listing without duplicating it on reruns.
insert into public.koyal_partner_directory
  (name, category, description, location, starting_price, operator_name, phone, website,
   professional_name, qualifications, experience, services, service_hours, status, source)
select
  'The Body Mechanics',
  'Physiotherapy & Rehabilitation',
  'Physiotherapy and rehabilitation services, including home-care visits in Jalpaiguri town.',
  'Jalpaiguri town, West Bengal, India',
  '₹250',
  'Dr Prahelika Acharjee',
  '+91 9679004664',
  'https://the-bodymechanics.com',
  'Dr Prahelika Acharjee',
  array['BPT', 'MPT (Musculoskeletal & Sports)'],
  '17+ years',
  array['Physiotherapy', 'Musculoskeletal care', 'Sports physiotherapy', 'Home care'],
  '3:30 pm–7:00 pm',
  'active',
  'seed'
where not exists (
  select 1 from public.koyal_partner_directory
  where lower(name) = lower('The Body Mechanics')
);
