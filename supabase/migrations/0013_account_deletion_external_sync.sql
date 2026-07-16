-- Account-deletion external updates remain backend-only and survive user deletion.

alter table public.external_sync_events
  drop constraint if exists external_sync_events_user_id_fkey;

create table if not exists public.account_deletion_requests (
  request_id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  email_hash text,
  status varchar(32) not null default 'pending_external_updates'
    check (status in (
      'pending_external_updates',
      'external_updates_complete',
      'needs_manual_review'
    )),
  requested_at timestamptz not null default now(),
  external_processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.account_deletion_requests enable row level security;
revoke all on table public.account_deletion_requests from anon, authenticated;
grant select, insert, update on table public.account_deletion_requests to service_role;

create or replace function public.enqueue_account_deletion_external_sync(
  p_user_id uuid,
  p_email_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.account_deletion_requests%rowtype;
  v_destination text;
  v_session_ids jsonb;
  v_salesforce_case_ids jsonb;
  v_payload jsonb;
begin
  perform 1
  from public.users
  where id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'ACCOUNT_NOT_FOUND');
  end if;

  insert into public.account_deletion_requests (user_id, email_hash)
  values (p_user_id, nullif(trim(coalesce(p_email_hash, '')), ''))
  on conflict (user_id) do update set
    email_hash = coalesce(public.account_deletion_requests.email_hash, excluded.email_hash),
    updated_at = now()
  returning * into v_request;

  select coalesce(jsonb_agg(id order by chart_version), '[]'::jsonb)
  into v_session_ids
  from public.birth_data_history
  where user_id = p_user_id;

  select coalesce(jsonb_agg(external_record_id order by created_at), '[]'::jsonb)
  into v_salesforce_case_ids
  from public.external_sync_events
  where user_id = p_user_id
    and destination = 'salesforce_case'
    and status = 'delivered'
    and external_record_id is not null;

  update public.external_sync_events
  set
    status = 'cancelled_due_to_deletion',
    next_retry_at = null,
    last_error = 'ACCOUNT_DELETION_CANCELLED_PENDING_DELIVERY',
    resolved_by = 'system:account-deletion',
    resolved_at = now(),
    updated_at = now()
  where user_id = p_user_id
    and status in ('pending', 'processing', 'retry_pending', 'failed_final')
    and coalesce(payload_json->>'operation', 'chart_generation') <> 'account_deletion';

  update public.external_sync_events
  set
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
    'deletion_request_id', v_request.request_id,
    'request_id', 'delete-' || v_request.request_id::text,
    'user_id', p_user_id,
    'session_ids', v_session_ids,
    'email_hash', v_request.email_hash,
    'deletion_requested_at', v_request.requested_at,
    'source', 'mobile_app',
    'status', 'deletion_requested',
    'salesforce_case_ids', v_salesforce_case_ids
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
  end loop;

  return jsonb_build_object(
    'ok', true,
    'request_id', v_request.request_id,
    'status', v_request.status,
    'external_event_count', 2
  );
end;
$$;

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
  where request_id = v_request_id;

  return new;
end;
$$;

drop trigger if exists refresh_account_deletion_request_status_trigger
  on public.external_sync_events;

create trigger refresh_account_deletion_request_status_trigger
after update of status on public.external_sync_events
for each row execute function public.refresh_account_deletion_request_status();

revoke all on function public.enqueue_account_deletion_external_sync(uuid, text) from public;
revoke all on function public.refresh_account_deletion_request_status() from public;
grant execute on function public.enqueue_account_deletion_external_sync(uuid, text) to service_role;
