-- Account-deletion external updates remain backend-only and survive user deletion.

alter table public.external_sync_events
  drop constraint if exists external_sync_events_user_id_fkey;

create table if not exists public.account_deletion_requests (
  request_id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  status varchar(32) not null default 'pending_external_updates'
    check (status in (
      'pending_external_updates',
      'external_updates_complete',
      'needs_manual_review',
      'internally_deleted'
    )),
  requested_at timestamptz not null default now(),
  external_processed_at timestamptz,
  internally_deleted_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.account_deletion_requests enable row level security;
revoke all on table public.account_deletion_requests from anon, authenticated;
grant select, insert, update on table public.account_deletion_requests to service_role;

create or replace function public.block_external_export_after_deletion_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.payload_json->>'operation', 'chart_generation') <> 'account_deletion'
    and exists (
      select 1 from public.account_deletion_requests where user_id = new.user_id
    ) then
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists block_external_export_after_deletion_request_trigger
  on public.external_sync_events;

create trigger block_external_export_after_deletion_request_trigger
before insert on public.external_sync_events
for each row execute function public.block_external_export_after_deletion_request();

create or replace function public.queue_account_deletion_external_sync(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.account_deletion_requests%rowtype;
  v_destination text;
  v_processing_count int;
  v_session_ids jsonb;
  v_salesforce_case_ids jsonb;
  v_salesforce_case_subjects jsonb;
  v_payload jsonb;
  v_inserted_count int := 0;
begin
  select * into v_request
  from public.account_deletion_requests
  where user_id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'DELETION_REQUEST_NOT_FOUND');
  end if;

  select count(*) into v_processing_count
  from public.external_sync_events
  where user_id = p_user_id
    and status = 'processing'
    and coalesce(payload_json->>'operation', 'chart_generation') <> 'account_deletion';

  if v_processing_count > 0 then
    return jsonb_build_object(
      'ok', true,
      'status', 'waiting_for_in_flight_exports',
      'processing_count', v_processing_count,
      'external_event_count', 0
    );
  end if;

  select coalesce(jsonb_agg(id order by chart_version), '[]'::jsonb)
  into v_session_ids
  from public.birth_data_history
  where user_id = p_user_id;

  select coalesce(jsonb_agg(external_record_id order by created_at), '[]'::jsonb)
  into v_salesforce_case_ids
  from public.external_sync_events
  where user_id = p_user_id
    and destination = 'salesforce_case'
    and external_record_id is not null
    and coalesce(payload_json->>'operation', 'chart_generation') <> 'account_deletion';

  select coalesce(
    jsonb_agg('LUMIS-' || payload_json->>'request_id' order by created_at)
      filter (where nullif(payload_json->>'request_id', '') is not null),
    '[]'::jsonb
  )
  into v_salesforce_case_subjects
  from public.external_sync_events
  where user_id = p_user_id
    and destination = 'salesforce_case'
    and coalesce(payload_json->>'operation', 'chart_generation') <> 'account_deletion';

  update public.external_sync_events
  set
    status = case when status = 'delivered' then status else 'cancelled_due_to_deletion' end,
    next_retry_at = null,
    last_error = case
      when status = 'delivered' then last_error
      else 'ACCOUNT_DELETION_CANCELLED_PENDING_DELIVERY'
    end,
    resolved_by = coalesce(resolved_by, 'system:account-deletion'),
    resolved_at = coalesce(resolved_at, now()),
    payload_json = jsonb_build_object(
      'operation', 'account_deleted_audit',
      'request_id', payload_json->>'request_id',
      'user_id', p_user_id,
      'chart_session_id', chart_session_id,
      'deletion_request_id', v_request.request_id,
      'redacted_at', now()
    ),
    updated_at = now()
  where user_id = p_user_id
    and coalesce(payload_json->>'operation', 'chart_generation') <> 'account_deletion';

  v_payload := jsonb_build_object(
    'operation', 'account_deletion',
    'deletion_deferred_action', 'external_cleanup',
    'deletion_request_id', v_request.request_id,
    'request_id', 'delete-' || v_request.request_id::text,
    'user_id', p_user_id,
    'session_ids', v_session_ids,
    'deletion_requested_at', v_request.requested_at,
    'source', 'mobile_app',
    'status', 'external_cleanup_requested',
    'salesforce_case_ids', v_salesforce_case_ids,
    'salesforce_case_subjects', v_salesforce_case_subjects
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
      p_user_id,
      null,
      v_destination,
      'lumis:account-deletion:' || v_request.request_id::text || ':' || v_destination,
      v_payload
    )
    on conflict (idempotency_key) do nothing;

    if found then
      v_inserted_count := v_inserted_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'status', 'external_cleanup_queued',
    'external_event_count', v_inserted_count
  );
end;
$$;

create or replace function public.enqueue_account_deletion_external_sync(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.account_deletion_requests%rowtype;
  v_queue_result jsonb;
begin
  perform 1
  from public.users
  where id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'ACCOUNT_NOT_FOUND');
  end if;

  insert into public.account_deletion_requests (user_id)
  values (p_user_id)
  on conflict (user_id) do update set updated_at = now()
  returning * into v_request;

  update public.external_sync_events
  set
    status = case when status = 'delivered' then status else 'cancelled_due_to_deletion' end,
    next_retry_at = null,
    last_error = case
      when status = 'delivered' then last_error
      else 'ACCOUNT_DELETION_CANCELLED_PENDING_DELIVERY'
    end,
    resolved_by = coalesce(resolved_by, 'system:account-deletion'),
    resolved_at = coalesce(resolved_at, now()),
    payload_json = jsonb_build_object(
      'operation', 'account_deleted_audit',
      'request_id', payload_json->>'request_id',
      'user_id', p_user_id,
      'chart_session_id', chart_session_id,
      'deletion_request_id', v_request.request_id,
      'redacted_at', now()
    ),
    updated_at = now()
  where user_id = p_user_id
    and status <> 'processing'
    and coalesce(payload_json->>'operation', 'chart_generation') <> 'account_deletion';

  v_queue_result := public.queue_account_deletion_external_sync(p_user_id);

  return jsonb_build_object(
    'ok', true,
    'request_id', v_request.request_id,
    'status', coalesce(v_queue_result->>'status', v_request.status),
    'external_event_count', coalesce((v_queue_result->>'external_event_count')::int, 0)
  );
end;
$$;

-- Provider calls time out well before this 15-minute lease. An abandoned claim
-- is therefore bounded, cancelled, and handed to deterministic cleanup lookup.
create or replace function public.claim_external_sync_events(p_limit int default 20)
returns setof public.external_sync_events
language plpgsql
security definer
set search_path = public
as $$
begin
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
  v_event public.external_sync_events%rowtype;
  v_deletion_requested boolean;
  v_status text;
  v_next_retry_at timestamptz;
begin
  select * into v_event
  from public.external_sync_events
  where event_id = p_event_id
    and status = 'processing'
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'SYNC_EVENT_NOT_PROCESSING');
  end if;

  select exists (
    select 1 from public.account_deletion_requests where user_id = v_event.user_id
  ) into v_deletion_requested;

  if p_delivered then
    v_status := 'delivered';
    v_next_retry_at := null;
  elsif v_deletion_requested
    and coalesce(v_event.payload_json->>'operation', 'chart_generation') <> 'account_deletion' then
    v_status := 'cancelled_due_to_deletion';
    v_next_retry_at := null;
  elsif v_event.attempt_count >= 3 then
    v_status := 'failed_final';
    v_next_retry_at := null;
  else
    v_status := 'retry_pending';
    v_next_retry_at := now() + case
      when v_event.attempt_count = 1 then interval '1 hour'
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
    'attempt_count', v_event.attempt_count,
    'next_retry_at', v_next_retry_at
  );
end;
$$;

create or replace function public.continue_account_deletion_after_export()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'processing'
    and new.status <> 'processing'
    and coalesce(new.payload_json->>'operation', 'chart_generation') <> 'account_deletion'
    and exists (
      select 1 from public.account_deletion_requests where user_id = new.user_id
    ) then
    perform public.queue_account_deletion_external_sync(new.user_id);
  end if;

  return new;
end;
$$;

drop trigger if exists continue_account_deletion_after_export_trigger
  on public.external_sync_events;

create trigger continue_account_deletion_after_export_trigger
after update of status on public.external_sync_events
for each row execute function public.continue_account_deletion_after_export();

create or replace function public.refresh_account_deletion_request_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
  v_resolved_count int;
  v_failed_count int;
begin
  if coalesce(new.payload_json->>'operation', '') <> 'account_deletion' then
    return new;
  end if;

  v_request_id := nullif(new.payload_json->>'deletion_request_id', '')::uuid;

  select
    count(*) filter (where status in ('delivered', 'manually_resolved')),
    count(*) filter (where status = 'failed_final')
  into v_resolved_count, v_failed_count
  from public.external_sync_events
  where payload_json->>'deletion_request_id' = v_request_id::text;

  update public.account_deletion_requests
  set
    status = case
      when v_resolved_count = 2 then 'external_updates_complete'
      when v_failed_count > 0 then 'needs_manual_review'
      else 'pending_external_updates'
    end,
    external_processed_at = case when v_resolved_count = 2 then now() else null end,
    last_error = case when v_failed_count > 0 then 'EXT-SYNC-3' else null end,
    updated_at = now()
  where request_id = v_request_id
    and status <> 'internally_deleted';

  return new;
end;
$$;

drop trigger if exists refresh_account_deletion_request_status_trigger
  on public.external_sync_events;

create trigger refresh_account_deletion_request_status_trigger
after update of status on public.external_sync_events
for each row execute function public.refresh_account_deletion_request_status();

revoke all on function public.block_external_export_after_deletion_request() from public;
revoke all on function public.queue_account_deletion_external_sync(uuid) from public;
revoke all on function public.enqueue_account_deletion_external_sync(uuid) from public;
revoke all on function public.continue_account_deletion_after_export() from public;
revoke all on function public.refresh_account_deletion_request_status() from public;
grant execute on function public.queue_account_deletion_external_sync(uuid) to service_role;
grant execute on function public.enqueue_account_deletion_external_sync(uuid) to service_role;
