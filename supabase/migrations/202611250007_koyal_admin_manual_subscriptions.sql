-- Admin-issued subscription entitlements are stored separately from paid orders and coupon redemptions.
create table if not exists public.koyal_admin_manual_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_name text not null check (plan_name in ('Let It', 'Care', 'Elite', 'Supreme')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  is_active boolean not null default true,
  reason text not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint koyal_admin_manual_subscriptions_reason_nonempty check (length(trim(reason)) > 0)
);
create index if not exists koyal_admin_manual_subscriptions_user_active_idx
  on public.koyal_admin_manual_subscriptions (user_id, is_active, expires_at desc);
alter table public.koyal_admin_manual_subscriptions enable row level security;
revoke all on public.koyal_admin_manual_subscriptions from anon, authenticated;
grant all on public.koyal_admin_manual_subscriptions to service_role;
