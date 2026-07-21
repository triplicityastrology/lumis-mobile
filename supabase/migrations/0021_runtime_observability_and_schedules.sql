-- PII-safe runtime observability and database-local schedules. External delivery
-- invocation remains disabled until staging destination credentials pass QA.

create table if not exists public.runtime_request_events (
  id bigint generated always as identity primary key,
  request_id text not null,
  endpoint text not null,
  user_id uuid references auth.users(id) on delete set null,
  outcome text not null check (outcome in ('success', 'rejected', 'failed')),
  status_code integer not null check (status_code between 100 and 599),
  error_code text,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  created_at timestamptz not null default now()
);

alter table public.runtime_request_events enable row level security;
revoke all on table public.runtime_request_events from public, anon, authenticated;
revoke all on sequence public.runtime_request_events_id_seq from public, anon, authenticated;
grant select, insert on table public.runtime_request_events to service_role;
grant usage, select on sequence public.runtime_request_events_id_seq to service_role;

create index if not exists runtime_request_events_endpoint_created_idx
  on public.runtime_request_events (endpoint, created_at desc);
create index if not exists runtime_request_events_error_created_idx
  on public.runtime_request_events (error_code, created_at desc)
  where error_code is not null;

create table if not exists public.runtime_alerts (
  id bigint generated always as identity primary key,
  alert_type text not null,
  window_started_at timestamptz not null,
  severity text not null check (severity in ('warning', 'critical')),
  observed_count integer not null check (observed_count > 0),
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (alert_type, window_started_at)
);

alter table public.runtime_alerts enable row level security;
revoke all on table public.runtime_alerts from public, anon, authenticated;
revoke all on sequence public.runtime_alerts_id_seq from public, anon, authenticated;
grant select, insert, update on table public.runtime_alerts to service_role;
grant usage, select on sequence public.runtime_alerts_id_seq to service_role;

create or replace function public.record_runtime_request_event(
  p_request_id text,
  p_endpoint text,
  p_user_id uuid,
  p_outcome text,
  p_status_code integer,
  p_error_code text default null,
  p_duration_ms integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'RUNTIME_EVENT_ACCESS_DENIED' using errcode = '42501';
  end if;

  insert into public.runtime_request_events (
    request_id, endpoint, user_id, outcome, status_code, error_code, duration_ms
  ) values (
    left(trim(p_request_id), 100),
    left(trim(p_endpoint), 80),
    p_user_id,
    p_outcome,
    p_status_code,
    nullif(left(trim(coalesce(p_error_code, '')), 100), ''),
    p_duration_ms
  );
end;
$$;

revoke all on function public.record_runtime_request_event(
  text, text, uuid, text, integer, text, integer
) from public, anon, authenticated;
grant execute on function public.record_runtime_request_event(
  text, text, uuid, text, integer, text, integer
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
      select coalesce(sum(provider_call_count), 0)
      from public.chart_provider_call_events
      where created_at >= now() - interval '24 hours'
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

create or replace function public.evaluate_runtime_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz := date_trunc('hour', now());
  v_count integer;
  v_inserted integer := 0;
begin
  select count(*) into v_count
  from public.runtime_request_events
  where created_at >= now() - interval '15 minutes' and outcome = 'failed';

  if v_count >= 10 then
    insert into public.runtime_alerts (
      alert_type, window_started_at, severity, observed_count
    ) values ('request_failures', v_window, 'critical', v_count)
    on conflict (alert_type, window_started_at) do update
    set observed_count = greatest(public.runtime_alerts.observed_count, excluded.observed_count);
    v_inserted := v_inserted + 1;
  end if;

  select count(*) into v_count
  from public.chart_provider_call_events
  where status = 'persistence_failed' and compensation_status = 'review_pending';

  if v_count > 0 then
    insert into public.runtime_alerts (
      alert_type, window_started_at, severity, observed_count
    ) values ('provider_calls_pending_review', v_window, 'warning', v_count)
    on conflict (alert_type, window_started_at) do update
    set observed_count = greatest(public.runtime_alerts.observed_count, excluded.observed_count);
    v_inserted := v_inserted + 1;
  end if;

  select count(*) into v_count
  from public.external_sync_events where status = 'failed_final';

  if v_count > 0 then
    insert into public.runtime_alerts (
      alert_type, window_started_at, severity, observed_count
    ) values ('external_sync_failed_final', v_window, 'warning', v_count)
    on conflict (alert_type, window_started_at) do update
    set observed_count = greatest(public.runtime_alerts.observed_count, excluded.observed_count);
    v_inserted := v_inserted + 1;
  end if;

  return v_inserted;
end;
$$;

revoke all on function public.evaluate_runtime_alerts() from public, anon, authenticated;
grant execute on function public.evaluate_runtime_alerts() to service_role;

create or replace function public.purge_runtime_operational_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rate_windows integer;
  v_request_events integer;
  v_provider_events integer;
begin
  perform public.redact_expired_external_sync_payloads();

  delete from public.api_rate_limit_windows
  where window_started_at < now() - interval '2 days';
  get diagnostics v_rate_windows = row_count;

  delete from public.runtime_request_events
  where created_at < now() - interval '90 days';
  get diagnostics v_request_events = row_count;

  delete from public.chart_provider_call_events
  where created_at < now() - interval '180 days'
    and status = 'committed'
    and compensation_status = 'not_required';
  get diagnostics v_provider_events = row_count;

  return jsonb_build_object(
    'rate_windows_deleted', v_rate_windows,
    'request_events_deleted', v_request_events,
    'provider_events_deleted', v_provider_events
  );
end;
$$;

revoke all on function public.purge_runtime_operational_data() from public, anon, authenticated;
grant execute on function public.purge_runtime_operational_data() to service_role;

create extension if not exists pg_cron with schema pg_catalog;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'lumis-runtime-retention';
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  select jobid into v_job_id from cron.job where jobname = 'lumis-external-sync-daily-report';
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  select jobid into v_job_id from cron.job where jobname = 'lumis-runtime-alerts';
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'lumis-runtime-alerts',
    '*/15 * * * *',
    'select public.evaluate_runtime_alerts()'
  );

  perform cron.schedule(
    'lumis-runtime-retention',
    '20 2 * * *',
    'select public.purge_runtime_operational_data()'
  );

  perform cron.schedule(
    'lumis-external-sync-daily-report',
    '30 2 * * *',
    'select public.create_external_sync_daily_report()'
  );
end;
$$;

comment on table public.runtime_request_events is
  'Backend-only, payload-free operational events keyed by request ID. No message or birth-detail content is stored.';
comment on function public.runtime_health_snapshot() is
  'Service-role operational summary suitable for alerts or a lightweight cost/error dashboard.';
