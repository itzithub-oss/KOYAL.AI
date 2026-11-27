-- Restore KOYAL AI's original five-question, one-random-question administrator login.
-- Legacy installations stored three complete answer sets. Preserve the first saved set
-- as the canonical five answers, then remove the obsolete passkey/combination schema.
update public.koyal_admin_security
set answer_hashes = case
  when jsonb_typeof(answer_hashes) = 'array'
   and jsonb_array_length(answer_hashes) = 3
   and jsonb_typeof(answer_hashes -> 0) = 'array'
   and jsonb_array_length(answer_hashes -> 0) = 5
  then answer_hashes -> 0
  else answer_hashes
end;

delete from public.koyal_admin_challenges;

alter table public.koyal_admin_security
  drop column if exists passkey_hashes;

alter table public.koyal_admin_challenges
  drop column if exists combination_index;

alter table public.koyal_admin_security
  drop constraint if exists koyal_admin_security_five_answers_check;

alter table public.koyal_admin_security
  add constraint koyal_admin_security_five_answers_check
  check (
    jsonb_typeof(answer_hashes) = 'array'
    and jsonb_array_length(answer_hashes) = 5
  );
