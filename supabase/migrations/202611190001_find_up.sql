-- FIND UP business directory and partnership applications
-- Apply once in the Supabase SQL Editor. Public clients must use the KOYAL API,
-- never a service-role key. The API exposes only APPROVED listings.
create extension if not exists pgcrypto;

create table if not exists public.find_up_businesses (
  id uuid primary key default gen_random_uuid(),
  business_id text not null unique default ('FU-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  business_name text not null,
  display_name text not null,
  category text not null,
  subcategory text,
  description text not null,
  category_details jsonb not null default '{}'::jsonb,
  establishment_year integer,
  operating_status text not null default 'Operating',
  services jsonb not null default '[]'::jsonb,
  keywords text[] not null default '{}',
  specialisations text[] not null default '{}',
  search_synonyms text[] not null default '{}',
  location jsonb not null default '{}'::jsonb,
  pricing jsonb not null default '{}'::jsonb,
  operations jsonb not null default '{}'::jsonb,
  professionals jsonb not null default '[]'::jsonb,
  online_presence jsonb not null default '{}'::jsonb,
  owner_information jsonb not null default '{}'::jsonb,
  private_documents jsonb not null default '[]'::jsonb,
  status text not null default 'PENDING'
    check (status in ('PENDING','UNDER REVIEW','APPROVED','REJECTED','NEEDS CORRECTION','SUSPENDED')),
  verification_status text not null default 'UNVERIFIED'
    check (verification_status in ('UNVERIFIED','VERIFIED')),
  verification_notes text,
  submitted_at timestamptz not null default now(),
  approved_at timestamptz,
  verified_at timestamptz,
  reviewed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists find_up_businesses_status_idx on public.find_up_businesses(status);
create index if not exists find_up_businesses_category_idx on public.find_up_businesses(category);
create index if not exists find_up_businesses_submitted_idx on public.find_up_businesses(submitted_at desc);
create index if not exists find_up_businesses_keywords_idx on public.find_up_businesses using gin(keywords);
create index if not exists find_up_businesses_services_idx on public.find_up_businesses using gin(services);
create index if not exists find_up_businesses_location_idx on public.find_up_businesses using gin(location);

create table if not exists public.find_up_audit_logs (
  id bigint generated always as identity primary key,
  business_row_id uuid references public.find_up_businesses(id) on delete set null,
  actor_email text not null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists find_up_audit_logs_business_idx on public.find_up_audit_logs(business_row_id, created_at desc);

alter table public.find_up_businesses enable row level security;
alter table public.find_up_audit_logs enable row level security;

-- All reads and writes go through server routes. Service-role access is server-only.
revoke all on public.find_up_businesses from anon, authenticated;
revoke all on public.find_up_audit_logs from anon, authenticated;
grant select on public.find_up_businesses to service_role;
grant insert, update, delete on public.find_up_businesses to service_role;
grant select, insert on public.find_up_audit_logs to service_role;

comment on table public.find_up_businesses is 'KOYAL FIND UP partnership listings. Only APPROVED rows are eligible for public search.';
comment on column public.find_up_businesses.owner_information is 'Private owner contact and email; never return from public API.';
comment on column public.find_up_businesses.private_documents is 'Private verification document metadata/storage references; never return from public API.';
comment on column public.find_up_businesses.verification_status is 'Separate from listing approval; VERIFIED only after admin credential review.';
