-- KOYAL AI API rate limits and atomic admin lockout.
create table if not exists public.koyal_api_rate_limits (
  bucket_key text primary key,
  window_start bigint not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);
alter table public.koyal_api_rate_limits enable row level security;
revoke all on public.koyal_api_rate_limits from anon, authenticated;
grant select, insert, update, delete on public.koyal_api_rate_limits to service_role;

create or replace function public.consume_koyal_rate_limit(
  p_bucket_key text, p_limit integer, p_window_seconds integer
) returns boolean language plpgsql security definer set search_path = public as $$
declare v_window bigint; v_count integer;
begin
  if p_bucket_key is null or length(p_bucket_key) < 1 or length(p_bucket_key) > 200
     or p_limit < 1 or p_limit > 10000 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid rate limit parameters';
  end if;
  v_window := floor(extract(epoch from clock_timestamp()) / p_window_seconds)::bigint;
  insert into public.koyal_api_rate_limits(bucket_key, window_start, request_count, updated_at)
  values (p_bucket_key, v_window, 1, now())
  on conflict (bucket_key) do update
    set window_start = excluded.window_start,
        request_count = case when public.koyal_api_rate_limits.window_start = excluded.window_start
          then public.koyal_api_rate_limits.request_count + 1 else 1 end,
        updated_at = now()
  returning request_count into v_count;
  return v_count <= p_limit;
end;
$$;

create or replace function public.record_koyal_admin_failure(p_user_id uuid)
returns table(failed_attempts integer, locked_until timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  return query
  update public.koyal_admin_security s
     set failed_attempts = case when s.locked_until is not null and s.locked_until <= now() then 1 else s.failed_attempts + 1 end,
         locked_until = case
           when (case when s.locked_until is not null and s.locked_until <= now() then 1 else s.failed_attempts + 1 end) >= 5
           then now() + interval '15 minutes' else null end,
         updated_at = now()
   where s.user_id = p_user_id
  returning s.failed_attempts, s.locked_until;
end;
$$;

create or replace function public.reset_koyal_admin_failures(p_user_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.koyal_admin_security set failed_attempts = 0, locked_until = null, updated_at = now()
  where user_id = p_user_id;
$$;

revoke all on function public.consume_koyal_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.record_koyal_admin_failure(uuid) from public, anon, authenticated;
revoke all on function public.reset_koyal_admin_failures(uuid) from public, anon, authenticated;
grant execute on function public.consume_koyal_rate_limit(text, integer, integer) to service_role;
grant execute on function public.record_koyal_admin_failure(uuid) to service_role;
grant execute on function public.reset_koyal_admin_failures(uuid) to service_role;

delete from public.koyal_api_rate_limits where updated_at < now() - interval '2 days';
