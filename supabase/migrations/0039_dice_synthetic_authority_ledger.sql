create table if not exists public.lumis_dice_synthetic_authority_ledger (
  run_id text primary key check (run_id ~ '^dice-tech80-[a-z0-9]{16,40}$'),
  gateway_package_sha256 text not null check (gateway_package_sha256 ~ '^[a-f0-9]{64}$'),
  fixture_registry_sha256 text not null check (fixture_registry_sha256 ~ '^[a-f0-9]{64}$'),
  authorization_hmac_sha256 text not null check (authorization_hmac_sha256 ~ '^[a-f0-9]{64}$'),
  issued_at timestamptz not null,
  valid_until timestamptz not null,
  consumed_at timestamptz not null,
  retain_until timestamptz not null,
  check (issued_at < valid_until),
  check (retain_until = consumed_at + interval '30 days')
);

alter table public.lumis_dice_synthetic_authority_ledger enable row level security;
alter table public.lumis_dice_synthetic_authority_ledger force row level security;

revoke all on table public.lumis_dice_synthetic_authority_ledger from public, anon, authenticated, service_role;

create or replace function public.consume_lumis_dice_synthetic_authority_v1(
  p_run_id text,
  p_gateway_package_sha256 text,
  p_fixture_registry_sha256 text,
  p_authorization_hmac_sha256 text,
  p_issued_at timestamptz,
  p_valid_until timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_consumed_at timestamptz;
  v_retain_until timestamptz;
begin
  if auth.role() is distinct from 'service_role' or auth.uid() is not null then
    raise exception 'DICE_AUTHORITY_ACCESS_DENIED' using errcode = '42501';
  end if;

  if p_run_id !~ '^dice-tech80-[a-z0-9]{16,40}$'
    or p_gateway_package_sha256 !~ '^[a-f0-9]{64}$'
    or p_fixture_registry_sha256 !~ '^[a-f0-9]{64}$'
    or p_authorization_hmac_sha256 !~ '^[a-f0-9]{64}$'
    or p_issued_at is null
    or p_valid_until is null
    or p_issued_at > v_now
    or p_valid_until <= v_now
    or p_valid_until > p_issued_at + interval '15 minutes' then
    return jsonb_build_object(
      'consumed', false,
      'code', 'authority_invalid',
      'run_id', p_run_id,
      'consumed_at', null,
      'retain_until', null
    );
  end if;

  v_consumed_at := v_now;
  v_retain_until := v_now + interval '30 days';

  insert into public.lumis_dice_synthetic_authority_ledger (
    run_id,
    gateway_package_sha256,
    fixture_registry_sha256,
    authorization_hmac_sha256,
    issued_at,
    valid_until,
    consumed_at,
    retain_until
  ) values (
    p_run_id,
    p_gateway_package_sha256,
    p_fixture_registry_sha256,
    p_authorization_hmac_sha256,
    p_issued_at,
    p_valid_until,
    v_consumed_at,
    v_retain_until
  )
  on conflict (run_id) do nothing
  returning consumed_at, retain_until into v_consumed_at, v_retain_until;

  if not found then
    return jsonb_build_object(
      'consumed', false,
      'code', 'replayed',
      'run_id', p_run_id,
      'consumed_at', null,
      'retain_until', null
    );
  end if;

  return jsonb_build_object(
    'consumed', true,
    'code', 'consumed',
    'run_id', p_run_id,
    'consumed_at', v_consumed_at,
    'retain_until', v_retain_until
  );
end;
$$;

create or replace function public.purge_lumis_dice_synthetic_authority_ledger_v1()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  if session_user <> 'postgres'
    and (auth.role() is distinct from 'service_role' or auth.uid() is not null) then
    raise exception 'DICE_AUTHORITY_ACCESS_DENIED' using errcode = '42501';
  end if;

  delete from public.lumis_dice_synthetic_authority_ledger
  where retain_until <= statement_timestamp();
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.consume_lumis_dice_synthetic_authority_v1(text, text, text, text, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.purge_lumis_dice_synthetic_authority_ledger_v1() from public, anon, authenticated;
grant execute on function public.consume_lumis_dice_synthetic_authority_v1(text, text, text, text, timestamptz, timestamptz) to service_role;
grant execute on function public.purge_lumis_dice_synthetic_authority_ledger_v1() to service_role;

create extension if not exists pg_cron with schema pg_catalog;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'lumis-dice-authority-retention';

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'lumis-dice-authority-retention',
    '*/15 * * * *',
    'select public.purge_lumis_dice_synthetic_authority_ledger_v1()'
  );
end;
$$;

comment on table public.lumis_dice_synthetic_authority_ledger is
  'Metadata-only, 30-day, single-use Dice synthetic authority ledger. Never stores prompts, responses, questions, member identifiers, or provider payloads.';
