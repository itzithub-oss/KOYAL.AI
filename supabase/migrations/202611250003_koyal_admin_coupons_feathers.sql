-- KOYAL AI Admin Coupons + Feather Adjustments
-- Run this migration in Supabase SQL Editor before using these admin modules.

create table if not exists public.koyal_admin_coupons (
  code text primary key,
  plan_name text not null check (plan_name in ('Let It', 'Care', 'Elite', 'Supreme')),
  max_redemptions integer null check (max_redemptions is null or max_redemptions > 0),
  redemption_count integer not null default 0 check (redemption_count >= 0),
  expires_at timestamptz null,
  is_active boolean not null default true,
  created_by text not null,
  created_at timestamptz not null default now()
);

alter table public.koyal_admin_coupons enable row level security;

create table if not exists public.koyal_admin_feather_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  quantity integer not null check (quantity <> 0),
  balance_before integer not null check (balance_before >= 0),
  balance_after integer not null check (balance_after >= 0),
  reason text not null,
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  admin_email text not null,
  created_at timestamptz not null default now()
);

create index if not exists koyal_admin_feather_adjustments_user_created_idx
  on public.koyal_admin_feather_adjustments (user_id, created_at desc);

alter table public.koyal_admin_feather_adjustments enable row level security;

create or replace function public.admin_adjust_koyal_feathers(
  p_user_id uuid,
  p_quantity integer,
  p_reason text,
  p_admin_user_id uuid,
  p_admin_email text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before integer;
  v_after integer;
begin
  if p_quantity = 0 or abs(p_quantity) > 100000 then
    raise exception 'Adjustment quantity must be between -100000 and 100000 and cannot be zero.';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 or length(p_reason) > 300 then
    raise exception 'A reason between 3 and 300 characters is required.';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'User account was not found.';
  end if;

  insert into public.koyal_feather_wallets (user_id, balance)
  values (p_user_id, 150)
  on conflict (user_id) do nothing;

  select balance into v_before
  from public.koyal_feather_wallets
  where user_id = p_user_id
  for update;

  v_after := v_before + p_quantity;
  if v_after < 0 then
    raise exception 'This deduction would make the Feather balance negative.';
  end if;

  update public.koyal_feather_wallets
  set balance = v_after
  where user_id = p_user_id;

  insert into public.koyal_admin_feather_adjustments
    (user_id, quantity, balance_before, balance_after, reason, admin_user_id, admin_email)
  values
    (p_user_id, p_quantity, v_before, v_after, trim(p_reason), p_admin_user_id, p_admin_email);

  return jsonb_build_object('balanceBefore', v_before, 'balanceAfter', v_after);
end;
$$;

create or replace function public.redeem_koyal_admin_subscription_coupon(
  p_user_id uuid,
  p_code text,
  p_redeemed_at timestamptz,
  p_expires_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coupon public.koyal_admin_coupons%rowtype;
begin
  select * into v_coupon
  from public.koyal_admin_coupons
  where code = lower(trim(p_code))
  for update;

  if not found or not v_coupon.is_active then
    raise exception 'That coupon code is not valid.';
  end if;
  if v_coupon.expires_at is not null and v_coupon.expires_at <= p_redeemed_at then
    raise exception 'This coupon has expired.';
  end if;
  if v_coupon.max_redemptions is not null and v_coupon.redemption_count >= v_coupon.max_redemptions then
    raise exception 'This coupon has reached its redemption limit.';
  end if;
  if exists (
    select 1 from public.koyal_coupon_redemptions
    where user_id = p_user_id and coupon_code = lower(trim(p_code))
  ) then
    raise exception 'This coupon has already been redeemed by your account.';
  end if;

  insert into public.koyal_coupon_redemptions
    (user_id, coupon_code, plan_name, redeemed_at, expires_at)
  values
    (p_user_id, lower(trim(p_code)), v_coupon.plan_name, p_redeemed_at, p_expires_at);

  update public.koyal_admin_coupons
  set redemption_count = redemption_count + 1
  where code = v_coupon.code;

  return jsonb_build_object('plan', v_coupon.plan_name, 'expiresAt', p_expires_at);
end;
$$;

revoke all on function public.admin_adjust_koyal_feathers(uuid, integer, text, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_adjust_koyal_feathers(uuid, integer, text, uuid, text) to service_role;

revoke all on function public.redeem_koyal_admin_subscription_coupon(uuid, text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.redeem_koyal_admin_subscription_coupon(uuid, text, timestamptz, timestamptz) to service_role;

-- Server-side admin routes use the Supabase service_role key.
grant all privileges on table public.koyal_admin_coupons to service_role;
grant all privileges on table public.koyal_admin_feather_adjustments to service_role;
