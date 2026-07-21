-- Enforce the 30-day outbound-payload ceiling at the point of use, not only
-- when the daily cleanup job happens to run.
create or replace function public.claim_external_sync_events(p_limit int default 20)
returns setof public.external_sync_events
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.external_sync_events
  set
    payload_json = payload_json
      - 'email'
      - 'name'
      - 'birth_date'
      - 'birth_time'
      - 'place_name'
      - 'birthplace'
      - 'timezone'
      - 'lat'
      - 'lng'
      - 'notes',
    payload_redacted_at = coalesce(payload_redacted_at, now()),
    status = 'failed_final',
    next_retry_at = null,
    last_error = 'SYNC_PAYLOAD_EXPIRED',
    updated_at = now()
  where payload_expires_at <= now()
    and payload_redacted_at is null
    and status in ('pending', 'retry_pending', 'processing', 'failed_final');

  with stale_claims as (
    select
      event.event_id,
      exists (
        select 1
        from public.account_deletion_requests request
        where request.user_id = event.user_id
      ) as deletion_requested
    from public.external_sync_events event
    where event.status = 'processing'
      and event.last_attempt_at < now() - interval '15 minutes'
    for update
  )
  update public.external_sync_events event
  set
    status = case
      when stale.deletion_requested then 'cancelled_due_to_deletion'
      when attempt_count >= 3 then 'failed_final'
      else 'retry_pending'
    end,
    next_retry_at = case
      when stale.deletion_requested or attempt_count >= 3 then null
      else now()
    end,
    last_error = case
      when stale.deletion_requested then 'DELETION_STALE_CLAIM_CANCELLED'
      else 'DELIVERY_CLAIM_TIMEOUT'
    end,
    resolved_by = case
      when stale.deletion_requested then 'system:account-deletion-lease'
      else resolved_by
    end,
    resolved_at = case
      when stale.deletion_requested then now()
      else resolved_at
    end,
    updated_at = now()
  from stale_claims stale
  where event.event_id = stale.event_id;

  return query
  with candidates as (
    select event_id
    from public.external_sync_events
    where status in ('pending', 'retry_pending')
      and next_retry_at <= now()
      and attempt_count < 3
      and payload_redacted_at is null
      and payload_expires_at > now()
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

create or replace function public.replay_external_sync_event(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.external_sync_events%rowtype;
begin
  select * into v_event
  from public.external_sync_events
  where event_id = p_event_id
  for update;

  if not found or v_event.status not in ('failed_final', 'manually_resolved') then
    return jsonb_build_object('ok', false, 'error_code', 'SYNC_EVENT_NOT_REPLAYABLE');
  end if;

  if v_event.payload_redacted_at is not null or v_event.payload_expires_at <= now() then
    update public.external_sync_events
    set
      payload_json = payload_json
        - 'email'
        - 'name'
        - 'birth_date'
        - 'birth_time'
        - 'place_name'
        - 'birthplace'
        - 'timezone'
        - 'lat'
        - 'lng'
        - 'notes',
      payload_redacted_at = coalesce(payload_redacted_at, now()),
      status = 'failed_final',
      next_retry_at = null,
      last_error = 'SYNC_PAYLOAD_EXPIRED',
      updated_at = now()
    where event_id = p_event_id;

    return jsonb_build_object('ok', false, 'error_code', 'SYNC_PAYLOAD_EXPIRED');
  end if;

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
  where event_id = p_event_id;

  return jsonb_build_object('ok', true, 'event_id', p_event_id, 'status', 'retry_pending');
end;
$$;

revoke all on function public.claim_external_sync_events(integer) from public, anon, authenticated;
grant execute on function public.claim_external_sync_events(integer) to service_role;
revoke all on function public.replay_external_sync_event(uuid) from public, anon, authenticated;
grant execute on function public.replay_external_sync_event(uuid) to service_role;

-- A request ledger describes the latest request state. Separate immutable
-- attempt rows make time-window metrics count attempts in their observed window.
create table if not exists public.chart_provider_call_attempt_events (
  id bigint generated always as identity primary key,
  request_id text not null references public.chart_provider_call_events(request_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (request_id, attempt_number)
);

alter table public.chart_provider_call_attempt_events enable row level security;
revoke all on table public.chart_provider_call_attempt_events from public, anon, authenticated;
grant select, insert on table public.chart_provider_call_attempt_events to service_role;
revoke all on sequence public.chart_provider_call_attempt_events_id_seq from public, anon, authenticated;
grant usage, select on sequence public.chart_provider_call_attempt_events_id_seq to service_role;

create index if not exists chart_provider_call_attempt_events_observed_idx
  on public.chart_provider_call_attempt_events (observed_at desc);

insert into public.chart_provider_call_attempt_events (
  request_id, user_id, attempt_number, observed_at
)
select
  event.request_id,
  event.user_id,
  attempt.attempt_number,
  event.provider_called_at
from public.chart_provider_call_events event
cross join lateral generate_series(
  1,
  greatest(coalesce(event.provider_call_count, 0), 0)
) as attempt(attempt_number)
on conflict (request_id, attempt_number) do nothing;

create or replace function public.record_chart_provider_call_event(
  p_request_id text,
  p_user_id uuid,
  p_status text,
  p_error_code text default null,
  p_worker_disposition text default null,
  p_provider_call_count integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.chart_provider_call_events%rowtype;
  v_previous_count integer := 0;
  v_effective_count integer;
begin
  if nullif(trim(p_request_id), '') is null
    or p_user_id is null
    or p_status not in ('generated', 'committed', 'persistence_failed')
    or (p_worker_disposition is not null and p_worker_disposition not in ('generated', 'already_generated'))
    or (p_provider_call_count is not null and p_provider_call_count < 1)
  then
    return jsonb_build_object('ok', false, 'error_code', 'PROVIDER_EVENT_INVALID_INPUT');
  end if;

  select * into v_existing
  from public.chart_provider_call_events
  where request_id = p_request_id
  for update;

  if found then
    if v_existing.user_id <> p_user_id then
      return jsonb_build_object('ok', false, 'error_code', 'PROVIDER_EVENT_IDENTITY_CONFLICT');
    end if;
    v_previous_count := coalesce(v_existing.provider_call_count, 0);
  end if;

  v_effective_count := greatest(v_previous_count, coalesce(p_provider_call_count, v_previous_count));

  insert into public.chart_provider_call_events (
    request_id,
    user_id,
    worker_disposition,
    provider_call_count,
    status,
    compensation_status,
    provider_called_at,
    persistence_completed_at,
    last_error_code,
    updated_at
  ) values (
    p_request_id,
    p_user_id,
    p_worker_disposition,
    nullif(v_effective_count, 0),
    p_status,
    case when p_status = 'persistence_failed' then 'review_pending' else 'not_required' end,
    now(),
    case when p_status = 'committed' then now() else null end,
    p_error_code,
    now()
  )
  on conflict (request_id) do update
  set
    worker_disposition = coalesce(excluded.worker_disposition, public.chart_provider_call_events.worker_disposition),
    provider_call_count = nullif(v_effective_count, 0),
    status = excluded.status,
    compensation_status = excluded.compensation_status,
    provider_called_at = case
      when v_effective_count > v_previous_count then now()
      else public.chart_provider_call_events.provider_called_at
    end,
    persistence_completed_at = case
      when excluded.status = 'committed' then now()
      else public.chart_provider_call_events.persistence_completed_at
    end,
    last_error_code = excluded.last_error_code,
    updated_at = now();

  if v_effective_count > v_previous_count then
    insert into public.chart_provider_call_attempt_events (
      request_id, user_id, attempt_number, observed_at
    )
    select p_request_id, p_user_id, attempt_number, now()
    from generate_series(v_previous_count + 1, v_effective_count) as attempt_number
    on conflict (request_id, attempt_number) do nothing;
  end if;

  return jsonb_build_object(
    'ok', true,
    'request_id', p_request_id,
    'provider_call_count', nullif(v_effective_count, 0),
    'new_attempts_recorded', greatest(v_effective_count - v_previous_count, 0)
  );
end;
$$;

revoke all on function public.record_chart_provider_call_event(
  text, uuid, text, text, text, integer
) from public, anon, authenticated;
grant execute on function public.record_chart_provider_call_event(
  text, uuid, text, text, text, integer
) to service_role;

create or replace function public.runtime_health_snapshot()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'generated_at', now(),
    'request_failures_24h', (
      select count(*) from public.runtime_request_events
      where created_at >= now() - interval '24 hours' and outcome = 'failed'
    ),
    'rate_limit_rejections_24h', (
      select count(*) from public.runtime_request_events
      where created_at >= now() - interval '24 hours'
        and error_code in ('CHAT_RATE_LIMITED', 'PROFILE_RATE_LIMITED')
    ),
    'provider_calls_pending_review', (
      select count(*) from public.chart_provider_call_events
      where status = 'persistence_failed' and compensation_status = 'review_pending'
    ),
    'provider_calls_24h', (
      select count(*) from public.chart_provider_call_attempt_events
      where observed_at >= now() - interval '24 hours'
    ),
    'external_sync_failed_final', (
      select count(*) from public.external_sync_events where status = 'failed_final'
    ),
    'open_alerts', (
      select count(*) from public.runtime_alerts where status = 'open'
    )
  );
$$;

revoke all on function public.runtime_health_snapshot() from public, anon, authenticated;
grant execute on function public.runtime_health_snapshot() to service_role;

comment on table public.chart_provider_call_attempt_events is
  'Append-only provider call attempts used for accurate time-window metrics; payloads and birth data are never stored here.';
comment on function public.replay_external_sync_event(uuid) is
  'Manual replay fails closed and redacts immediately once the payload retention deadline has passed.';
