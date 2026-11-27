-- Restore the original three answer-combination + three matching passkey admin gate.
-- Existing single-question installations no longer contain the old passkey hashes;
-- the admin will be asked to configure all three combinations and passkeys again.
alter table public.koyal_admin_security
  add column if not exists passkey_hashes jsonb;

alter table public.koyal_admin_challenges
  add column if not exists combination_index integer null;

alter table public.koyal_admin_security
  drop constraint if exists koyal_admin_security_five_answers_check,
  drop constraint if exists koyal_admin_security_three_combinations_check;

alter table public.koyal_admin_security
  add constraint koyal_admin_security_three_combinations_check
  check (
    -- Keep the current single five-answer row valid until the admin reconfigures
    -- three combinations; never discard or block the existing row during migration.
    (jsonb_typeof(answer_hashes) = 'array' and jsonb_array_length(answer_hashes) = 5)
    or
    (
      jsonb_typeof(answer_hashes) = 'array'
      and jsonb_array_length(answer_hashes) = 3
      and jsonb_typeof(answer_hashes -> 0) = 'array' and jsonb_array_length(answer_hashes -> 0) = 5
      and jsonb_typeof(answer_hashes -> 1) = 'array' and jsonb_array_length(answer_hashes -> 1) = 5
      and jsonb_typeof(answer_hashes -> 2) = 'array' and jsonb_array_length(answer_hashes -> 2) = 5
    )
  );

alter table public.koyal_admin_challenges
  drop constraint if exists koyal_admin_challenges_combination_index_check,
  add constraint koyal_admin_challenges_combination_index_check
  check (combination_index is null or combination_index between 0 and 2);
