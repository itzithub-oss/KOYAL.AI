-- KOYAL AI coupon redemption ledger.
-- Run this once in Supabase SQL Editor before redeeming the new plan coupons.
create table if not exists public.koyal_coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  coupon_code text not null,
  plan_name text not null check (plan_name in ('Let It', 'Care', 'Elite', 'Supreme')),
  redeemed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint koyal_coupon_redemptions_user_coupon_unique unique (user_id, coupon_code)
);

create index if not exists koyal_coupon_redemptions_user_expiry_idx
  on public.koyal_coupon_redemptions (user_id, expires_at desc);

alter table public.koyal_coupon_redemptions enable row level security;
-- No client policies: reads and writes are performed only by the server service-role key.
