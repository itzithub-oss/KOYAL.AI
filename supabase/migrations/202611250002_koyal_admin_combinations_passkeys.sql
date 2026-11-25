-- Extend KOYAL admin security for three complete answer combinations and matching passkeys.
alter table public.koyal_admin_security
  add column if not exists passkey_hashes jsonb;

alter table public.koyal_admin_challenges
  add column if not exists combination_index smallint;

create index if not exists koyal_admin_challenges_pending_idx
  on public.koyal_admin_challenges(user_id, expires_at desc)
  where used_at is null;
