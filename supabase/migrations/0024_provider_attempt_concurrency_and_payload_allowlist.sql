-- Completed and expired outbound records retain only identifiers needed for
-- technical audit/recovery. New payload fields are private by default.
create or replace function public.external_sync_operational_payload(p_payload jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'operation', p_payload->'operation',
    'request_id', p_payload->'request_id',
    'chart_session_id', p_payload->'chart_session_id',
    'session_id', p_payload->'session_id',
    'deletion_request_id', p_payload->'deletion_request_id',
    'source', p_payload->'source'
  ));
$$;

revoke all on function public.external_sync_operational_payload(jsonb)
  from public, anon, authenticated;
grant execute on function public.external_sync_operational_payload(jsonb)
  to service_role;

create or replace function public.redact_completed_external_sync_payload()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
    and old.payload_redacted_at is not null
    and new.status in ('pending', 'retry_pending', 'processing')
  then
    raise exception 'EXTERNAL_SYNC_PAYLOAD_REDACTED' using errcode = '22023';
  end if;

  if new.payload_redacted_at is not null then
    new.payload_json := public.external_sync_operational_payload(new.payload_json);
  elsif new.status in ('delivered', 'manually_resolved', 'cancelled_due_to_deletion') then
    new.payload_json := public.external_sync_operational_payload(new.payload_json);
    new.payload_redacted_at := now();
  end if;

  return new;
end;
$$;

create or replace function public.redact_expired_external_sync_payloads()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_redacted integer;
begin
  update public.external_sync_events
  set
    payload_json = public.external_sync_operational_payload(payload_json),
    payload_redacted_at = coalesce(payload_redacted_at, now()),
    status = case
      when status in ('pending', 'retry_pending', 'processing') then 'failed_final'
      else status
    end,
    next_retry_at = case
      when status in ('pending', 'retry_pending', 'processing') then null
      else next_retry_at
    end,
    last_error = case
      when status in ('pending', 'retry_pending', 'processing') then 'SYNC_PAYLOAD_EXPIRED'
      else last_error
    end,
    updated_at = now()
  where payload_expires_at <= now()
    and status in ('pending', 'retry_pending', 'processing', 'failed_final')
    and (
      payload_redacted_at is null
      or payload_json is distinct from public.external_sync_operational_payload(payload_json)
    );

  get diagnostics v_redacted = row_count;
  return v_redacted;
end;
$$;

revoke all on function public.redact_expired_external_sync_payloads()
  from public, anon, authenticated;
grant execute on function public.redact_expired_external_sync_payloads()
  to service_role;

-- Normalize rows redacted by the earlier blacklist implementation.
update public.external_sync_events
set
  payload_json = public.external_sync_operational_payload(payload_json),
  updated_at = now()
where payload_redacted_at is not null
  and payload_json is distinct from public.external_sync_operational_payload(payload_json);

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

  perform pg_advisory_xact_lock(
    hashtextextended('chart-provider-call:' || p_request_id, 0)
  );

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
    provider_call_count = greatest(
      coalesce(public.chart_provider_call_events.provider_call_count, 0),
      coalesce(excluded.provider_call_count, 0)
    ),
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

comment on function public.external_sync_operational_payload(jsonb) is
  'Allowlist used after delivery, cancellation, or expiry; all unlisted payload fields are removed by default.';
comment on function public.record_chart_provider_call_event(text, uuid, text, text, text, integer) is
  'Serializes cumulative provider telemetry per request and appends each newly observed attempt exactly once.';
