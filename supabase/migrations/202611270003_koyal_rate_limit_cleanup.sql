-- Periodically prune inactive rate-limit buckets without requiring pg_cron.
-- The cleanup index keeps the occasional maintenance delete bounded.
create index if not exists koyal_api_rate_limits_updated_at_idx
  on public.koyal_api_rate_limits (updated_at);

create or replace function public.consume_koyal_rate_limit(
  p_bucket_key text, p_limit integer, p_window_seconds integer
) returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_window bigint;
  v_count integer;
begin
  if p_bucket_key is null or length(p_bucket_key) < 1 or length(p_bucket_key) > 200
     or p_limit < 1 or p_limit > 10000 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid rate limit parameters';
  end if;

  -- A deterministic 1% sample triggers cleanup, avoiding a table scan on every request.
  if mod(abs(hashtext(p_bucket_key)::bigint), 100) = 0 then
    delete from public.koyal_api_rate_limits
    where updated_at < now() - interval '2 days';
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

revoke all on function public.consume_koyal_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_koyal_rate_limit(text, integer, integer) to service_role;
