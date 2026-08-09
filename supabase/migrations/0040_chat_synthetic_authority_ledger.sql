-- Source-only S2-T260 authority boundary. 0039 is reserved for T257 Dice.
-- This migration is not deployed here.

create table if not exists public.chat_synthetic_authority_ledger (
  authority_sha256 text primary key check (authority_sha256 ~ '^[a-f0-9]{64}$'),
  review_package_sha256 text not null check (review_package_sha256 ~ '^[a-f0-9]{64}$'),
  run_id text not null check (run_id ~ '^chat-syn-[a-z0-9]{12,32}$'),
  dice_evidence_sha256 text not null check (dice_evidence_sha256 ~ '^[a-f0-9]{64}$'),
  gateway_source_sha256 text not null check (gateway_source_sha256 ~ '^[a-f0-9]{64}$'),
  fixture_registry_sha256 text not null check (fixture_registry_sha256 ~ '^[a-f0-9]{64}$'),
  valid_until timestamptz not null,
  consumed_at timestamptz not null,
  closed_at timestamptz,
  retention_until timestamptz not null,
  unique (review_package_sha256, run_id),
  check (valid_until > consumed_at),
  check (retention_until = consumed_at + interval '30 days')
);

create table if not exists public.chat_synthetic_fixture_claims (
  authority_sha256 text not null references public.chat_synthetic_authority_ledger(authority_sha256) on delete cascade,
  review_package_sha256 text not null check (review_package_sha256 ~ '^[a-f0-9]{64}$'),
  run_id text not null check (run_id ~ '^chat-syn-[a-z0-9]{12,32}$'),
  fixture_id text not null check (fixture_id ~ '^chat_(en|zh_hant)_[a-z0-9_]+_v1$'),
  idempotency_sha256 text not null check (idempotency_sha256 ~ '^[a-f0-9]{64}$'),
  claimed_at timestamptz not null,
  retention_until timestamptz not null,
  primary key (authority_sha256, fixture_id),
  check (retention_until = claimed_at + interval '30 days')
);

alter table public.chat_synthetic_authority_ledger enable row level security;
alter table public.chat_synthetic_fixture_claims enable row level security;
revoke all on table public.chat_synthetic_authority_ledger from public, anon, authenticated, service_role;
revoke all on table public.chat_synthetic_fixture_claims from public, anon, authenticated, service_role;

create or replace function public.consume_chat_synthetic_authority_v1(
  p_authority_sha256 text,
  p_review_package_sha256 text,
  p_run_id text,
  p_dice_evidence_sha256 text,
  p_gateway_source_sha256 text,
  p_fixture_registry_sha256 text,
  p_valid_until timestamptz
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_rows integer;
  v_existing public.chat_synthetic_authority_ledger%rowtype;
begin
  if auth.role() <> 'service_role' or auth.uid() is not null then
    raise exception 'CHAT_SYNTHETIC_SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  if p_authority_sha256 !~ '^[a-f0-9]{64}$'
    or p_review_package_sha256 !~ '^[a-f0-9]{64}$'
    or p_run_id !~ '^chat-syn-[a-z0-9]{12,32}$'
    or p_dice_evidence_sha256 !~ '^[a-f0-9]{64}$'
    or p_gateway_source_sha256 !~ '^[a-f0-9]{64}$'
    or p_fixture_registry_sha256 !~ '^[a-f0-9]{64}$'
    or p_valid_until is null
  then
    return 'conflict';
  end if;
  if p_valid_until <= v_now then return 'expired'; end if;

  insert into public.chat_synthetic_authority_ledger (
    authority_sha256, review_package_sha256, run_id, dice_evidence_sha256,
    gateway_source_sha256, fixture_registry_sha256, valid_until,
    consumed_at, retention_until
  ) values (
    p_authority_sha256, p_review_package_sha256, p_run_id, p_dice_evidence_sha256,
    p_gateway_source_sha256, p_fixture_registry_sha256, p_valid_until,
    v_now, v_now + interval '30 days'
  ) on conflict do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 1 then return 'consumed'; end if;

  select * into v_existing
  from public.chat_synthetic_authority_ledger
  where authority_sha256 = p_authority_sha256
     or (review_package_sha256 = p_review_package_sha256 and run_id = p_run_id)
  order by (authority_sha256 = p_authority_sha256) desc
  limit 1;
  if v_existing.authority_sha256 is null then return 'conflict'; end if;
  if v_existing.valid_until <= v_now then return 'expired'; end if;
  if v_existing.authority_sha256 = p_authority_sha256
    and v_existing.review_package_sha256 = p_review_package_sha256
    and v_existing.run_id = p_run_id
    and v_existing.dice_evidence_sha256 = p_dice_evidence_sha256
    and v_existing.gateway_source_sha256 = p_gateway_source_sha256
    and v_existing.fixture_registry_sha256 = p_fixture_registry_sha256
    and v_existing.valid_until = p_valid_until
  then
    return 'replayed';
  end if;
  return 'conflict';
end;
$$;

create or replace function public.consume_chat_synthetic_fixture_v1(
  p_authority_sha256 text,
  p_review_package_sha256 text,
  p_run_id text,
  p_fixture_id text,
  p_idempotency_sha256 text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_rows integer;
  v_authority public.chat_synthetic_authority_ledger%rowtype;
  v_claim public.chat_synthetic_fixture_claims%rowtype;
begin
  if auth.role() <> 'service_role' or auth.uid() is not null then
    raise exception 'CHAT_SYNTHETIC_SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  if p_authority_sha256 !~ '^[a-f0-9]{64}$'
    or p_review_package_sha256 !~ '^[a-f0-9]{64}$'
    or p_run_id !~ '^chat-syn-[a-z0-9]{12,32}$'
    or p_fixture_id !~ '^chat_(en|zh_hant)_[a-z0-9_]+_v1$'
    or p_idempotency_sha256 !~ '^[a-f0-9]{64}$'
  then
    return 'conflict';
  end if;

  select * into v_authority
  from public.chat_synthetic_authority_ledger
  where authority_sha256 = p_authority_sha256
  for share;
  if v_authority.authority_sha256 is null then return 'authority_missing'; end if;
  if v_authority.review_package_sha256 <> p_review_package_sha256 or v_authority.run_id <> p_run_id or v_authority.closed_at is not null then return 'conflict'; end if;
  if v_authority.valid_until <= v_now then return 'expired'; end if;

  insert into public.chat_synthetic_fixture_claims (
    authority_sha256, review_package_sha256, run_id, fixture_id,
    idempotency_sha256, claimed_at, retention_until
  ) values (
    p_authority_sha256, p_review_package_sha256, p_run_id, p_fixture_id,
    p_idempotency_sha256, v_now, v_now + interval '30 days'
  ) on conflict do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 1 then return 'consumed'; end if;

  select * into v_claim
  from public.chat_synthetic_fixture_claims
  where authority_sha256 = p_authority_sha256 and fixture_id = p_fixture_id;
  if v_claim.idempotency_sha256 = p_idempotency_sha256
    and v_claim.review_package_sha256 = p_review_package_sha256
    and v_claim.run_id = p_run_id
  then
    return 'replayed';
  end if;
  return 'conflict';
end;
$$;

create or replace function public.close_chat_synthetic_authority_v1(
  p_authority_sha256 text,
  p_review_package_sha256 text,
  p_run_id text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_rows integer;
  v_existing public.chat_synthetic_authority_ledger%rowtype;
begin
  if auth.role() <> 'service_role' or auth.uid() is not null then
    raise exception 'CHAT_SYNTHETIC_SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  update public.chat_synthetic_authority_ledger
  set closed_at = clock_timestamp()
  where authority_sha256 = p_authority_sha256
    and review_package_sha256 = p_review_package_sha256
    and run_id = p_run_id
    and closed_at is null;
  get diagnostics v_rows = row_count;
  if v_rows = 1 then return 'closed'; end if;
  select * into v_existing from public.chat_synthetic_authority_ledger where authority_sha256 = p_authority_sha256;
  if v_existing.authority_sha256 is null then return 'authority_missing'; end if;
  if v_existing.review_package_sha256 = p_review_package_sha256 and v_existing.run_id = p_run_id and v_existing.closed_at is not null then return 'already_closed'; end if;
  return 'conflict';
end;
$$;

create or replace function public.purge_chat_synthetic_authority_ledger_v1()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_rows bigint;
begin
  if auth.role() <> 'service_role' or auth.uid() is not null then
    raise exception 'CHAT_SYNTHETIC_SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  delete from public.chat_synthetic_authority_ledger where retention_until <= clock_timestamp();
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

revoke all on function public.consume_chat_synthetic_authority_v1(text, text, text, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.consume_chat_synthetic_fixture_v1(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.close_chat_synthetic_authority_v1(text, text, text) from public, anon, authenticated;
revoke all on function public.purge_chat_synthetic_authority_ledger_v1() from public, anon, authenticated;
grant execute on function public.consume_chat_synthetic_authority_v1(text, text, text, text, text, text, timestamptz) to service_role;
grant execute on function public.consume_chat_synthetic_fixture_v1(text, text, text, text, text) to service_role;
grant execute on function public.close_chat_synthetic_authority_v1(text, text, text) to service_role;
grant execute on function public.purge_chat_synthetic_authority_ledger_v1() to service_role;

comment on table public.chat_synthetic_authority_ledger is
  'Metadata-only, 30-day S2-T260 synthetic authority consumption ledger. No member, prompt, response, or unit data.';
comment on table public.chat_synthetic_fixture_claims is
  'Metadata-only fixture claims. Idempotency keys are retained only as SHA-256 digests.';
