-- Durable, backend-only delivery ledger for optional Salesforce and Google Sheets sync.

create table if not exists public.external_sync_events (
  event_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  chart_session_id bigint references public.birth_data_history(id) on delete set null,
  destination varchar(32) not null
    check (destination in ('salesforce_case', 'google_sheet')),
  idempotency_key text not null unique,
  status varchar(32) not null default 'pending'
    check (status in (
      'pending',
      'processing',
      'delivered',
      'retry_pending',
      'failed_final',
      'manually_resolved',
      'cancelled_due_to_deletion'
    )),
  payload_json jsonb not null,
  attempt_count int not null default 0 check (attempt_count >= 0),
  manual_replay_count int not null default 0 check (manual_replay_count >= 0),
  last_attempt_at timestamptz,
  next_retry_at timestamptz default now(),
  last_error text,
  external_record_id text,
  delivered_at timestamptz,
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.external_sync_events enable row level security;
revoke all on table public.external_sync_events from anon, authenticated;
grant select, insert, update on table public.external_sync_events to service_role;

create index if not exists external_sync_events_retry_idx
  on public.external_sync_events (status, next_retry_at, created_at)
  where status in ('pending', 'retry_pending', 'processing');

create index if not exists external_sync_events_user_idx
  on public.external_sync_events (user_id, created_at desc);

create table if not exists public.external_sync_daily_reports (
  report_id bigint generated always as identity primary key,
  report_date date not null unique,
  report_json jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.external_sync_daily_reports enable row level security;
revoke all on table public.external_sync_daily_reports from anon, authenticated;
revoke all on sequence public.external_sync_daily_reports_report_id_seq from anon, authenticated;
grant select, insert, update on table public.external_sync_daily_reports to service_role;
grant usage, select on sequence public.external_sync_daily_reports_report_id_seq to service_role;

create or replace function public.enqueue_chart_external_sync_events()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_name text;
  v_email text;
  v_flow text;
  v_destination text;
  v_payload jsonb;
begin
  if new.status <> 'active' then
    return new;
  end if;

  select display_name into v_name
  from public.users
  where id = new.user_id;

  select email into v_email
  from auth.users
  where id = new.user_id;

  v_flow := case
    when new.chart_version <= 1 then 'onboarding_chart_generation'
    else 'birth_details_regeneration'
  end;

  v_payload := jsonb_build_object(
    'timestamp', coalesce(new.activated_at, now()),
    'request_id', 'chart-' || new.id::text,
    'user_id', new.user_id,
    'chart_session_id', new.id,
    'email', coalesce(v_email, ''),
    'name', coalesce(v_name, 'Lumis user'),
    'birth_date', new.birth_date,
    'birth_time', case when new.unknown_time_flag then 'unknown' else new.birth_time::text end,
    'place_name', new.birth_place_text,
    'timezone', new.timezone,
    'plan', 'starter',
    'paid_amount', null,
    'marketing_consent', false,
    'product', 'Lumis',
    'source', 'mobile_app',
    'flow', v_flow,
    'chart_status', 'generated',
    'time_unknown', new.unknown_time_flag,
    'chart_type', 'mobile_onboarding',
    'precision', case when new.unknown_time_flag then 'no_birth_time' else 'full' end,
    'chart_url', null,
    'notes', null
  );

  foreach v_destination in array array['salesforce_case', 'google_sheet'] loop
    insert into public.external_sync_events (
      user_id,
      chart_session_id,
      destination,
      idempotency_key,
      payload_json
    )
    values (
      new.user_id,
      new.id,
      v_destination,
      'lumis:chart:' || new.id::text || ':' || v_destination,
      v_payload
    )
    on conflict (idempotency_key) do nothing;
  end loop;

  return new;
end;
$$;

drop trigger if exists enqueue_chart_external_sync_events_trigger
  on public.birth_data_history;

create trigger enqueue_chart_external_sync_events_trigger
after insert on public.birth_data_history
for each row execute function public.enqueue_chart_external_sync_events();

create or replace function public.claim_external_sync_events(p_limit int default 20)
returns setof public.external_sync_events
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.external_sync_events
  set
    status = case when attempt_count >= 3 then 'failed_final' else 'retry_pending' end,
    next_retry_at = case when attempt_count >= 3 then null else now() end,
    last_error = 'DELIVERY_CLAIM_TIMEOUT',
    updated_at = now()
  where status = 'processing'
    and last_attempt_at < now() - interval '15 minutes';

  return query
  with candidates as (
    select event_id
    from public.external_sync_events
    where status in ('pending', 'retry_pending')
      and next_retry_at <= now()
      and attempt_count < 3
    order by next_retry_at, created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 20), 100))
  )
  update public.external_sync_events event
  set
    status = 'processing',
    attempt_count = event.attempt_count + 1,
    last_attempt_at = now(),
    updated_at = now()
  from candidates
  where event.event_id = candidates.event_id
  returning event.*;
end;
$$;

create or replace function public.complete_external_sync_event(
  p_event_id uuid,
  p_delivered boolean,
  p_external_record_id text default null,
  p_error_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt_count int;
  v_status text;
  v_next_retry_at timestamptz;
begin
  select attempt_count into v_attempt_count
  from public.external_sync_events
  where event_id = p_event_id
    and status = 'processing'
  for update;

  if v_attempt_count is null then
    return jsonb_build_object('ok', false, 'error_code', 'SYNC_EVENT_NOT_PROCESSING');
  end if;

  if p_delivered then
    v_status := 'delivered';
    v_next_retry_at := null;
  elsif v_attempt_count >= 3 then
    v_status := 'failed_final';
    v_next_retry_at := null;
  else
    v_status := 'retry_pending';
    v_next_retry_at := now() + case
      when v_attempt_count = 1 then interval '1 hour'
      else interval '3 hours'
    end;
  end if;

  update public.external_sync_events
  set
    status = v_status,
    next_retry_at = v_next_retry_at,
    last_error = case when p_delivered then null else left(coalesce(p_error_code, 'SYNC_DELIVERY_FAILED'), 200) end,
    external_record_id = case when p_delivered then nullif(p_external_record_id, '') else external_record_id end,
    delivered_at = case when p_delivered then now() else delivered_at end,
    resolved_by = case when p_delivered then 'system:external-sync-retry' else resolved_by end,
    resolved_at = case when p_delivered then now() else resolved_at end,
    updated_at = now()
  where event_id = p_event_id;

  return jsonb_build_object(
    'ok', true,
    'event_id', p_event_id,
    'status', v_status,
    'attempt_count', v_attempt_count,
    'next_retry_at', v_next_retry_at
  );
end;
$$;

create or replace function public.replay_external_sync_event(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.external_sync_events
  set
    status = 'retry_pending',
    attempt_count = 0,
    manual_replay_count = manual_replay_count + 1,
    next_retry_at = now(),
    last_error = null,
    resolved_by = null,
    resolved_at = null,
    updated_at = now()
  where event_id = p_event_id
    and status in ('failed_final', 'manually_resolved');

  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'SYNC_EVENT_NOT_REPLAYABLE');
  end if;

  return jsonb_build_object('ok', true, 'event_id', p_event_id, 'status', 'retry_pending');
end;
$$;

create or replace function public.resolve_external_sync_event(
  p_event_id uuid,
  p_resolved_by text,
  p_resolution_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(trim(coalesce(p_resolved_by, '')), '') is null then
    return jsonb_build_object('ok', false, 'error_code', 'SYNC_RESOLVER_REQUIRED');
  end if;

  update public.external_sync_events
  set
    status = 'manually_resolved',
    next_retry_at = null,
    last_error = left(coalesce(nullif(trim(p_resolution_note), ''), last_error), 200),
    resolved_by = trim(p_resolved_by),
    resolved_at = now(),
    updated_at = now()
  where event_id = p_event_id
    and status = 'failed_final';

  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'SYNC_EVENT_NOT_RESOLVABLE');
  end if;

  return jsonb_build_object(
    'ok', true,
    'event_id', p_event_id,
    'status', 'manually_resolved',
    'resolved_by', trim(p_resolved_by)
  );
end;
$$;

create or replace function public.create_external_sync_daily_report()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report jsonb;
begin
  select jsonb_build_object(
    'generated_at', now(),
    'failed_final_count', count(*),
    'events', coalesce(jsonb_agg(jsonb_build_object(
      'event_id', event_id,
      'chart_session_id', chart_session_id,
      'destination', destination,
      'idempotency_key', idempotency_key,
      'attempt_count', attempt_count,
      'manual_replay_count', manual_replay_count,
      'last_attempt_at', last_attempt_at,
      'last_error', last_error,
      'created_at', created_at
    ) order by created_at) filter (where event_id is not null), '[]'::jsonb)
  )
  into v_report
  from public.external_sync_events
  where status = 'failed_final';

  insert into public.external_sync_daily_reports (report_date, report_json)
  values ((now() at time zone 'Asia/Hong_Kong')::date, v_report)
  on conflict (report_date) do update set
    report_json = excluded.report_json,
    created_at = now();

  return v_report;
end;
$$;

revoke all on function public.claim_external_sync_events(int) from public;
revoke all on function public.complete_external_sync_event(uuid, boolean, text, text) from public;
revoke all on function public.replay_external_sync_event(uuid) from public;
revoke all on function public.resolve_external_sync_event(uuid, text, text) from public;
revoke all on function public.create_external_sync_daily_report() from public;
grant execute on function public.claim_external_sync_events(int) to service_role;
grant execute on function public.complete_external_sync_event(uuid, boolean, text, text) to service_role;
grant execute on function public.replay_external_sync_event(uuid) to service_role;
grant execute on function public.resolve_external_sync_event(uuid, text, text) to service_role;
grant execute on function public.create_external_sync_daily_report() to service_role;
