-- Percentage discount coupons for subscription and Feather checkout.
-- Run once in Supabase SQL Editor after the existing KOYAL coupon migrations.

alter table public.koyal_admin_coupons
  add column if not exists coupon_type text not null default 'subscription_access',
  add column if not exists target_type text not null default 'subscription',
  add column if not exists discount_percent integer null;

alter table public.koyal_admin_coupons
  drop constraint if exists koyal_admin_coupons_coupon_type_check,
  add constraint koyal_admin_coupons_coupon_type_check
    check (coupon_type in ('subscription_access', 'discount')),
  drop constraint if exists koyal_admin_coupons_target_type_check,
  add constraint koyal_admin_coupons_target_type_check
    check (target_type in ('subscription', 'feathers', 'both')),
  drop constraint if exists koyal_admin_coupons_discount_percent_check,
  add constraint koyal_admin_coupons_discount_percent_check
    check (
      (coupon_type = 'subscription_access' and discount_percent is null)
      or (coupon_type = 'discount' and discount_percent between 1 and 99)
    );

create table if not exists public.koyal_discount_coupon_reservations (
  id uuid primary key default gen_random_uuid(),
  coupon_code text not null references public.koyal_admin_coupons(code) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id text not null unique,
  purchase_type text not null check (purchase_type in ('subscription', 'feathers')),
  discount_percent integer not null check (discount_percent between 1 and 99),
  original_amount_paise integer not null check (original_amount_paise > 0),
  discounted_amount_paise integer not null check (discounted_amount_paise >= 100),
  status text not null default 'reserved' check (status in ('reserved', 'redeemed')),
  created_at timestamptz not null default now(),
  redeemed_at timestamptz,
  constraint koyal_discount_coupon_user_once unique (user_id, coupon_code)
);

create index if not exists koyal_discount_coupon_reservations_code_status_idx
  on public.koyal_discount_coupon_reservations (coupon_code, status, created_at);

alter table public.koyal_discount_coupon_reservations enable row level security;
grant all privileges on table public.koyal_discount_coupon_reservations to service_role;

create or replace function public.reserve_koyal_discount_coupon(
  p_user_id uuid,
  p_code text,
  p_order_id text,
  p_purchase_type text,
  p_original_amount_paise integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coupon public.koyal_admin_coupons%rowtype;
  v_percent integer;
  v_discounted integer;
  v_expired_reservations integer;
begin
  if p_purchase_type not in ('subscription', 'feathers') or p_original_amount_paise < 100 then
    raise exception 'Invalid discounted purchase.';
  end if;

  select * into v_coupon
  from public.koyal_admin_coupons
  where code = lower(trim(p_code))
  for update;

  if not found or v_coupon.coupon_type <> 'discount' or not v_coupon.is_active then
    raise exception 'That discount coupon is not valid.';
  end if;
  if v_coupon.expires_at is not null and v_coupon.expires_at <= now() then
    raise exception 'This coupon has expired.';
  end if;
  if v_coupon.target_type not in (p_purchase_type, 'both') then
    raise exception 'This coupon does not apply to this purchase.';
  end if;

  -- Abandoned Cashfree sessions release their reservation after two hours.
  select count(*) into v_expired_reservations
  from public.koyal_discount_coupon_reservations
  where coupon_code = v_coupon.code
    and status = 'reserved'
    and created_at < now() - interval '2 hours';

  if v_expired_reservations > 0 then
    delete from public.koyal_discount_coupon_reservations
    where coupon_code = v_coupon.code
      and status = 'reserved'
      and created_at < now() - interval '2 hours';
    update public.koyal_admin_coupons
      set redemption_count = greatest(0, redemption_count - v_expired_reservations)
      where code = v_coupon.code
    returning * into v_coupon;
  end if;

  if exists (
    select 1 from public.koyal_discount_coupon_reservations
    where user_id = p_user_id and coupon_code = v_coupon.code
  ) then
    raise exception 'This discount coupon has already been used by your account.';
  end if;
  if v_coupon.max_redemptions is not null and v_coupon.redemption_count >= v_coupon.max_redemptions then
    raise exception 'This coupon has reached its redemption limit.';
  end if;

  v_percent := v_coupon.discount_percent;
  v_discounted := round(p_original_amount_paise * (100 - v_percent) / 100.0)::integer;
  if v_discounted < 100 then
    raise exception 'Discounted total must be at least ₹1. Increase the purchase amount or use a lower discount.';
  end if;

  insert into public.koyal_discount_coupon_reservations
    (coupon_code, user_id, order_id, purchase_type, discount_percent,
     original_amount_paise, discounted_amount_paise)
  values
    (v_coupon.code, p_user_id, p_order_id, p_purchase_type, v_percent,
     p_original_amount_paise, v_discounted);

  update public.koyal_admin_coupons
    set redemption_count = redemption_count + 1
    where code = v_coupon.code;

  return jsonb_build_object(
    'discountPercent', v_percent,
    'originalAmountPaise', p_original_amount_paise,
    'amountPaise', v_discounted,
    'discountPaise', p_original_amount_paise - v_discounted
  );
end;
$$;

create or replace function public.release_koyal_discount_coupon(p_order_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  delete from public.koyal_discount_coupon_reservations
  where order_id = p_order_id and status = 'reserved'
  returning coupon_code into v_code;

  if v_code is null then return false; end if;
  update public.koyal_admin_coupons
    set redemption_count = greatest(0, redemption_count - 1)
    where code = v_code;
  return true;
end;
$$;

create or replace function public.confirm_koyal_discount_coupon(p_order_id text, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.koyal_discount_coupon_reservations
    set status = 'redeemed', redeemed_at = coalesce(redeemed_at, now())
    where order_id = p_order_id and user_id = p_user_id and status = 'reserved';
  get diagnostics v_updated = row_count;
  if v_updated > 0 then return true; end if;

  return exists (
    select 1 from public.koyal_discount_coupon_reservations
    where order_id = p_order_id and user_id = p_user_id and status = 'redeemed'
  );
end;
$$;

revoke all on function public.reserve_koyal_discount_coupon(uuid, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.release_koyal_discount_coupon(text) from public, anon, authenticated;
revoke all on function public.confirm_koyal_discount_coupon(text, uuid) from public, anon, authenticated;
grant execute on function public.reserve_koyal_discount_coupon(uuid, text, text, text, integer) to service_role;
grant execute on function public.release_koyal_discount_coupon(text) to service_role;
grant execute on function public.confirm_koyal_discount_coupon(text, uuid) to service_role;
